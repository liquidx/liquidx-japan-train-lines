import { joinSegments } from "./train-lines.js";
import { regions } from "./regions.js";
import trainLineCorrections from "./train-line-corrections.json";
import {
  features_for_line,
  segments_for_line,
  point_for_feature,
  bounding_box
} from "./train-line-svg.js";

// Helper to project a point onto a line segment
export function projectPointOnSegment(p, a, b) {
  const ax = a[0], ay = a[1];
  const bx = b[0], by = b[1];
  const px = p[0], py = p[1];
  
  const abx = bx - ax;
  const aby = by - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) {
    return {
      point: a,
      t: 0,
      dist2: (px - ax) ** 2 + (py - ay) ** 2
    };
  }
  
  let t = ((px - ax) * abx + (py - ay) * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dist2 = (px - cx) ** 2 + (py - cy) ** 2;
  
  return {
    point: [cx, cy],
    t,
    dist2
  };
}

// Order stations sequentially along a list of joined paths (LineStrings)
export function orderStationsAlongLine(joinedPaths, stations) {
  const orderedStations = [];
  
  for (const station of stations) {
    const sPos = point_for_feature(station);
    if (!sPos) continue;
    
    let minProj = null;
    let minPathIdx = 0;
    let minSegIdx = 0;
    
    for (let pIdx = 0; pIdx < joinedPaths.length; pIdx++) {
      const path = joinedPaths[pIdx].geometry.coordinates;
      for (let sIdx = 0; sIdx < path.length - 1; sIdx++) {
        const a = path[sIdx];
        const b = path[sIdx + 1];
        const proj = projectPointOnSegment(sPos, a, b);
        if (minProj === null || proj.dist2 < minProj.dist2) {
          minProj = proj;
          minPathIdx = pIdx;
          minSegIdx = sIdx;
        }
      }
    }
    
    if (minProj !== null) {
      let distanceAlong = 0;
      for (let pIdx = 0; pIdx < minPathIdx; pIdx++) {
        const path = joinedPaths[pIdx].geometry.coordinates;
        for (let sIdx = 0; sIdx < path.length - 1; sIdx++) {
          distanceAlong += Math.hypot(
            path[sIdx + 1][0] - path[sIdx][0],
            path[sIdx + 1][1] - path[sIdx][1]
          );
        }
        distanceAlong += 0.5; // Gap offset between disjoint segments
      }
      const activePath = joinedPaths[minPathIdx].geometry.coordinates;
      for (let sIdx = 0; sIdx < minSegIdx; sIdx++) {
        distanceAlong += Math.hypot(
          activePath[sIdx + 1][0] - activePath[sIdx][0],
          activePath[sIdx + 1][1] - activePath[sIdx][1]
        );
      }
      const segLen = Math.hypot(
        activePath[minSegIdx + 1][0] - activePath[minSegIdx][0],
        activePath[minSegIdx + 1][1] - activePath[minSegIdx][1]
      );
      distanceAlong += minProj.t * segLen;
      
      orderedStations.push({
        station,
        distanceAlong
      });
    }
  }
  
  orderedStations.sort((a, b) => a.distanceAlong - b.distanceAlong);
  return orderedStations.map((item) => item.station);
}

function stitchPathsIntoSinglePath(paths) {
  if (paths.length <= 1) return paths;
  
  const remaining = [...paths];
  const mainPath = [...remaining.shift()];
  
  while (remaining.length > 0) {
    const tail = mainPath[mainPath.length - 1];
    const head = mainPath[0];
    
    let bestIdx = -1;
    let minD = Infinity;
    let reverse = false;
    let append = true;
    
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const pHead = p[0];
      const pTail = p[p.length - 1];
      
      const d1 = Math.hypot(pHead[0] - tail[0], pHead[1] - tail[1]);
      if (d1 < minD) {
        minD = d1;
        bestIdx = i;
        reverse = false;
        append = true;
      }
      const d2 = Math.hypot(pTail[0] - tail[0], pTail[1] - tail[1]);
      if (d2 < minD) {
        minD = d2;
        bestIdx = i;
        reverse = true;
        append = true;
      }
      const d3 = Math.hypot(pTail[0] - head[0], pTail[1] - head[1]);
      if (d3 < minD) {
        minD = d3;
        bestIdx = i;
        reverse = false;
        append = false;
      }
      const d4 = Math.hypot(pHead[0] - head[0], pHead[1] - head[1]);
      if (d4 < minD) {
        minD = d4;
        bestIdx = i;
        reverse = true;
        append = false;
      }
    }
    
    if (bestIdx !== -1) {
      const bestPath = remaining.splice(bestIdx, 1)[0];
      if (append) {
        if (reverse) {
          mainPath.push(...[...bestPath].reverse().slice(1));
        } else {
          mainPath.push(...bestPath.slice(1));
        }
      } else {
        if (reverse) {
          mainPath.unshift(...bestPath.slice(0, -1));
        } else {
          mainPath.unshift(...[...bestPath].reverse().slice(0, -1));
        }
      }
    } else {
      break;
    }
  }
  
  return [mainPath];
}

// Group and process lines and stations, computing the layout representation
export const getTrainLinesLayout = (
  geojson,
  station_geojson,
  region_name,
  company_name,
  line_name,
  options = {}
) => {
  let segments = [];
  let stations = [];
  
  if (company_name) {
    segments = segments_for_line(geojson, company_name, line_name);
    stations = features_for_line(station_geojson, company_name, line_name);
  } else if (region_name) {
    segments = geojson.features;
    stations = station_geojson?.features || [];
  }
  
  // Apply corrections
  const correction =
    trainLineCorrections[company_name] &&
    trainLineCorrections[company_name][line_name];
  if (correction) {
    for (const include of correction.includes) {
      segments = segments.concat(
        segments_for_line(geojson, include.company, include.line)
      );
      stations = stations.concat(
        features_for_line(station_geojson, include.company, include.line)
      );
    }
    for (const filter of correction.filters) {
      const filter_segments = segments_for_line(geojson, filter.company, filter.line);
      const filter_b = bounding_box(filter_segments);
      segments = segments.filter((v) => {
        const p = v.geometry.coordinates[0];
        return (
          (!filter.within_x || p[0] <= filter_b.max_x) &&
          (!filter.within_y || p[1] <= filter_b.max_y) &&
          (!filter.within_x || p[0] >= filter_b.min_x) &&
          (!filter.within_y || p[1] >= filter_b.min_y)
        );
      });
      stations = stations.filter((station) => {
        const p = point_for_feature(station);
        if (!p) return false;
        return (
          (!filter.within_x || p[0] <= filter_b.max_x) &&
          (!filter.within_y || p[1] <= filter_b.max_y) &&
          (!filter.within_x || p[0] >= filter_b.min_x) &&
          (!filter.within_y || p[1] >= filter_b.min_y)
        );
      });
    }
  }

  // Group segments by company::line and join them to form clean continuous paths
  const lineGroups = {};
  for (const segment of segments) {
    const comp = segment.properties ? segment.properties["運営会社"] : (company_name || "");
    const line = segment.properties ? segment.properties["路線名"] : (line_name || "");
    if (!comp || !line) continue;
    const key = `${comp}::${line}`;
    if (!lineGroups[key]) {
      lineGroups[key] = { company: comp, line: line, segments: [] };
    }
    lineGroups[key].segments.push(segment);
  }

  const linesList = [];
  for (const key in lineGroups) {
    const group = lineGroups[key];
    const joined = joinSegments(group.segments);
    
    // Stitch paths together ONLY for sequencing and relative distance mapping
    const joinedCoords = joined.map((f) => f.geometry.coordinates);
    const stitchedCoords = stitchPathsIntoSinglePath(joinedCoords);
    const stitchedFeatures = stitchedCoords.map((coords) => ({
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    }));

    // Precalculate cumulative distances along the stitched path
    const stitchedPoints = [];
    let stitchedLen = 0;
    const sCoords = stitchedCoords[0] || [];
    for (let i = 0; i < sCoords.length; i++) {
      if (i > 0) {
        stitchedLen += Math.hypot(sCoords[i][0] - sCoords[i - 1][0], sCoords[i][1] - sCoords[i - 1][1]);
      }
      stitchedPoints.push({
        coord: sCoords[i],
        dist: stitchedLen
      });
    }

    const findDistInStitched = (coord) => {
      let minDist = Infinity;
      let matchedDist = 0;
      for (const spt of stitchedPoints) {
        const d = Math.hypot(spt.coord[0] - coord[0], spt.coord[1] - coord[1]);
        if (d < minDist) {
          minDist = d;
          matchedDist = spt.dist;
        }
      }
      return matchedDist;
    };

    // Map original paths with correct distances along the stitched line
    const paths = joined.map((f) => {
      const coords = f.geometry.coordinates;
      const points = coords.map((c) => {
        return {
          coord: c,
          distanceAlong: findDistInStitched(c)
        };
      });
      
      return {
        points
      };
    });

    linesList.push({
      key,
      company: group.company,
      line: group.line,
      paths,
      totalLength: stitchedLen,
      stitchedFeatures
    });
  }

  // Sort linesList to have a consistent visual order in the schematic view
  linesList.sort((a, b) => {
    if (a.company !== b.company) {
      return a.company.localeCompare(b.company);
    }
    return a.line.localeCompare(b.line);
  });

  // Group stations by company::line
  const stationGroups = {};
  for (const st of stations) {
    const comp = st.properties ? st.properties["運営会社"] : (company_name || "");
    const line = st.properties ? st.properties["路線名"] : (line_name || "");
    if (!comp || !line) continue;
    const key = `${comp}::${line}`;
    if (!stationGroups[key]) {
      stationGroups[key] = [];
    }
    stationGroups[key].push(st);
  }

  // Order stations along their lines
  const finalStations = [];
  linesList.forEach((line) => {
    const joinedPaths = line.stitchedFeatures;
    
    const lineStations = stationGroups[line.key] || [];
    const orderedStFeatures = orderStationsAlongLine(joinedPaths, lineStations);
    
    const orderedStations = orderedStFeatures.map((st, index) => {
      const coord = point_for_feature(st);
      const name = st.properties ? st.properties["駅名"] : "";
      return {
        id: `station-${line.key}-${index}`,
        name,
        companyName: line.company,
        lineName: line.line,
        coord,
        index,
        numStations: orderedStFeatures.length
      };
    });
    
    line.stations = orderedStations;
    finalStations.push(...orderedStations);
  });


  // Compute bounds
  let b;
  if (!company_name && region_name && region_name !== "japan") {
    const region = regions.find((r) => r.id === region_name);
    if (region && region.bounds) {
      b = {
        min_x: region.bounds.min_lng,
        max_x: region.bounds.max_lng,
        min_y: region.bounds.min_lat,
        max_y: region.bounds.max_lat
      };
    }
  }
  if (!b) {
    b = bounding_box(segments);
  }
  
  if (b) {
    const paddingFraction = options.padding ?? 0.05;
    const bw = b.max_x - b.min_x;
    const bh = b.max_y - b.min_y;
    b = {
      min_x: b.min_x - bw * paddingFraction,
      max_x: b.max_x + bw * paddingFraction,
      min_y: b.min_y - bh * paddingFraction,
      max_y: b.max_y + bh * paddingFraction
    };
  } else {
    // Fallback bounds
    b = { min_x: 130, max_x: 145, min_y: 30, max_y: 45 };
  }

  return {
    lines: linesList,
    stations: finalStations,
    bounds: b
  };
};
