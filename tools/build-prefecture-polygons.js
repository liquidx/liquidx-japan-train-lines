#!/usr/bin/env node
// Reads the high-resolution prefecture GeoJSON from open-data-jp-prefectures-geojson,
// simplifies each polygon ring with Douglas-Peucker, and writes a compact
// static/prefecture-polygons.json keyed by 2-digit ISO prefecture code.

import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TOLERANCE = 0.01; // degrees (~1 km) — enough for accurate point-in-polygon
const MIN_RING_POINTS = 4; // drop degenerate rings after simplification
const MIN_RING_AREA = 0.0001; // drop tiny island polygons (sq degrees)

// --- Douglas-Peucker ---
function perpDist(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(lenSq);
}

function douglasPeucker(pts, tol) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tol) {
    const L = douglasPeucker(pts.slice(0, idx + 1), tol);
    const R = douglasPeucker(pts.slice(idx), tol);
    return [...L.slice(0, -1), ...R];
  }
  return [pts[0], pts[pts.length - 1]];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

function simplifyRing(ring) {
  const simplified = douglasPeucker(ring, TOLERANCE);
  // Ensure the ring is closed
  if (simplified.length >= MIN_RING_POINTS) {
    if (simplified[0][0] !== simplified[simplified.length - 1][0] ||
        simplified[0][1] !== simplified[simplified.length - 1][1]) {
      simplified.push(simplified[0]);
    }
  }
  return simplified;
}

function simplifyPolygon(rings) {
  // rings[0] = outer ring, rings[1..] = holes (we discard holes for simplicity)
  const outer = simplifyRing(rings[0]);
  if (outer.length < MIN_RING_POINTS) return null;
  if (ringArea(outer) < MIN_RING_AREA) return null;
  return [outer];
}

function simplifyGeometry(geom) {
  if (geom.type === "Polygon") {
    const rings = simplifyPolygon(geom.coordinates);
    if (!rings) return null;
    return { type: "Polygon", coordinates: rings };
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates
      .map(simplifyPolygon)
      .filter(Boolean);
    if (polys.length === 0) return null;
    return { type: "MultiPolygon", coordinates: polys };
  }
  return null;
}

// --- Prefecture code lookup ---
const PREFECTURE_CODES = {
  "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04",
  "秋田県": "05", "山形県": "06", "福島県": "07", "茨城県": "08",
  "栃木県": "09", "群馬県": "10", "埼玉県": "11", "千葉県": "12",
  "東京都": "13", "神奈川県": "14", "新潟県": "15", "富山県": "16",
  "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
  "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24",
  "滋賀県": "25", "京都府": "26", "大阪府": "27", "兵庫県": "28",
  "奈良県": "29", "和歌山県": "30", "鳥取県": "31", "島根県": "32",
  "岡山県": "33", "広島県": "34", "山口県": "35", "徳島県": "36",
  "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
  "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44",
  "宮崎県": "45", "鹿児島県": "46", "沖縄県": "47",
};

// --- Main ---
const pkgPath = require.resolve("open-data-jp-prefectures-geojson/output/prefectures.geojson");
console.log("Reading", pkgPath);
const raw = JSON.parse(readFileSync(pkgPath, "utf8"));

const result = {};
let totalPointsBefore = 0;
let totalPointsAfter = 0;

for (const feature of raw.features) {
  const name = feature.properties.P;
  const code = PREFECTURE_CODES[name];
  if (!code) { console.warn("Unknown prefecture:", name); continue; }

  const countPoints = (geom) => {
    if (geom.type === "Polygon") return geom.coordinates.reduce((n, r) => n + r.length, 0);
    if (geom.type === "MultiPolygon") return geom.coordinates.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
    return 0;
  };

  totalPointsBefore += countPoints(feature.geometry);
  const simplified = simplifyGeometry(feature.geometry);
  if (!simplified) { console.warn("Dropped:", name); continue; }
  totalPointsAfter += countPoints(simplified);

  result[code] = simplified;
  console.log(`${code} ${name}: simplified`);
}

const outPath = join(__dirname, "../static/prefecture-polygons.json");
writeFileSync(outPath, JSON.stringify(result));
console.log(`\nWrote ${outPath}`);
console.log(`Points: ${totalPointsBefore.toLocaleString()} → ${totalPointsAfter.toLocaleString()} (${((1 - totalPointsAfter / totalPointsBefore) * 100).toFixed(1)}% reduction)`);
console.log(`File size: ${(JSON.stringify(result).length / 1024).toFixed(0)} KB`);
