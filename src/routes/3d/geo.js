import { joinSegments } from "$lib/train-lines.js";

const METERS_PER_DEG_LAT = 110540;

// Project lon/lat to local meters around a center. Three.js convention:
// x = east, z = south (so north points away from the default camera), y = up.
export const makeProjector = (center) => {
  const metersPerDegLon =
    111320 * Math.cos((center.lat * Math.PI) / 180);
  return (lon, lat) => [
    (lon - center.lon) * metersPerDegLon,
    -(lat - center.lat) * METERS_PER_DEG_LAT,
  ];
};

const midpointOf = (coords) => coords[Math.floor(coords.length / 2)];

// Cumulative arc length for a projected path [[x,z], ...].
const cumulativeLengths = (pts) => {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    cum[i] = cum[i - 1] + Math.hypot(dx, dz);
  }
  return cum;
};

// Nearest path vertex index to a point (paths are dense enough that
// vertex-level snapping is fine for station placement).
const nearestVertex = (pts, x, z) => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, distSq: bestD };
};

// Smoothstep interpolation between depth anchors sorted by arc position.
const depthInterpolator = (anchors, base = 0) => {
  // anchors: [{s, depth}] sorted by s (arc length in meters)
  return (s) => {
    if (anchors.length === 0) return base;
    if (s <= anchors[0].s) return anchors[0].depth;
    const last = anchors[anchors.length - 1];
    if (s >= last.s) return last.depth;
    for (let i = 1; i < anchors.length; i++) {
      if (s <= anchors[i].s) {
        const a = anchors[i - 1];
        const b = anchors[i];
        const t = (s - a.s) / Math.max(1, b.s - a.s);
        const smooth = t * t * (3 - 2 * t);
        return a.depth + (b.depth - a.depth) * smooth;
      }
    }
    return last.depth;
  };
};

// Build the render/animation model for one metro line.
//
// Returns:
// {
//   meta, stations: [{name, x, y, z, s, isTransfer}],
//   paths: [{positions: Float32Array (xyz triples), cum: Float64Array, total}],
//   mainPath: <index of longest path>,
//   depthAt: (s) => meters   (for the main path)
// }
export const buildLineModel = (meta, railFeatures, stationFeatures, project) => {
  const joined = joinSegments(railFeatures);
  if (joined.length === 0) return null;

  // Project all paths.
  const projected = joined.map((f) =>
    f.geometry.coordinates.map(([lon, lat]) => project(lon, lat))
  );
  const cums = projected.map(cumulativeLengths);
  let mainPath = 0;
  for (let i = 1; i < projected.length; i++) {
    if (cums[i][cums[i].length - 1] > cums[mainPath][cums[mainPath].length - 1])
      mainPath = i;
  }
  const mainPts = projected[mainPath];
  const mainCum = cums[mainPath];

  // Place stations along the main path.
  const stations = [];
  for (const f of stationFeatures) {
    const name = f.properties["駅名"];
    if (!name) continue;
    const [lon, lat] = midpointOf(f.geometry.coordinates);
    const [x, z] = project(lon, lat);
    const { index, distSq } = nearestVertex(mainPts, x, z);
    // Stations more than ~1.5km from the main path belong to a branch.
    const onMain = distSq < 1500 * 1500;
    stations.push({ name, x, z, s: onMain ? mainCum[index] : null });
  }

  // Depth anchors: station name -> depth, resolved to arc positions.
  const anchors = [];
  for (const [name, depth] of Object.entries(meta.depth?.anchors || {})) {
    const st = stations.find((s) => s.name === name && s.s !== null);
    if (st) anchors.push({ s: st.s, depth });
  }
  anchors.sort((a, b) => a.s - b.s);
  const depthAt = depthInterpolator(anchors, meta.depth?.base ?? 0);

  // Bake xyz positions (y = depth in real meters; vertical exaggeration is
  // applied by scaling the parent group, not the geometry).
  const paths = projected.map((pts, pi) => {
    const cum = cums[pi];
    const positions = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      // Branch paths inherit the depth of their nearest main-path vertex.
      const s =
        pi === mainPath ? cum[i] : mainCum[nearestVertex(mainPts, pts[i][0], pts[i][1]).index];
      positions[i * 3] = pts[i][0];
      positions[i * 3 + 1] = depthAt(s);
      positions[i * 3 + 2] = pts[i][1];
    }
    return { positions, cum, total: cum[cum.length - 1] };
  });

  for (const st of stations) {
    st.y = st.s !== null ? depthAt(st.s) : depthAt(0);
  }

  return { meta, stations, paths, mainPath, depthAt };
};

// Position (xyz) at arc length s along a path, via binary search.
export const pointAt = (path, s, out) => {
  const { positions, cum, total } = path;
  const clamped = Math.max(0, Math.min(total, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= clamped) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const t = (clamped - cum[lo]) / span;
  out[0] = positions[lo * 3] + (positions[hi * 3] - positions[lo * 3]) * t;
  out[1] =
    positions[lo * 3 + 1] + (positions[hi * 3 + 1] - positions[lo * 3 + 1]) * t;
  out[2] =
    positions[lo * 3 + 2] + (positions[hi * 3 + 2] - positions[lo * 3 + 2]) * t;
  return out;
};
