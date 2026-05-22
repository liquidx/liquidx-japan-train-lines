#!/usr/bin/env node
// Precomputes which regions each (company, line) pair belongs to.
// Reads:
//   static/N02-19_RailroadSection.geojson  — railroad features
//   static/prefecture-polygons.json        — simplified prefecture shapes
//   src/lib/regions.js                     — region → prefecture mappings
// Writes:
//   static/line-region-index.json          — { "company::line": ["kanto", ...] }

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// --- Load data ---
console.log("Loading GeoJSON...");
const railroad = JSON.parse(readFileSync(join(root, "static/N02-19_RailroadSection.geojson"), "utf8"));
const prefPolygons = JSON.parse(readFileSync(join(root, "static/prefecture-polygons.json"), "utf8"));

const { regions } = await import(join(root, "src/lib/regions.js"));
const REGIONS = regions.filter(r => r.prefectures);

// --- Ray-casting point-in-polygon ---
function pointInRing(coord, ring) {
  const [x, y] = coord;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInGeometry(coord, geom) {
  if (!geom) return false;
  if (geom.type === "Polygon") return pointInRing(coord, geom.coordinates[0]);
  if (geom.type === "MultiPolygon") return geom.coordinates.some(poly => pointInRing(coord, poly[0]));
  return false;
}

// Precompute per-region set of prefecture geometries for fast lookup
const regionPrefGeoms = REGIONS.map(r => ({
  id: r.id,
  geoms: r.prefectures.map(code => prefPolygons[code]).filter(Boolean),
}));

function coordInRegion(coord, regionGeoms) {
  return regionGeoms.geoms.some(geom => pointInGeometry(coord, geom));
}

// Sample coordinates from a feature (every Nth point to balance speed vs accuracy)
function sampleCoords(geometry, stride = 3) {
  const coords = [];
  if (geometry.type === "LineString") {
    for (let i = 0; i < geometry.coordinates.length; i += stride) {
      coords.push(geometry.coordinates[i]);
    }
    // Always include last point
    const last = geometry.coordinates[geometry.coordinates.length - 1];
    if (coords[coords.length - 1] !== last) coords.push(last);
  } else if (geometry.type === "MultiLineString") {
    for (const line of geometry.coordinates) {
      for (let i = 0; i < line.length; i += stride) {
        coords.push(line[i]);
      }
      const last = line[line.length - 1];
      if (coords[coords.length - 1] !== last) coords.push(last);
    }
  }
  return coords;
}

// --- Build index ---
console.log("Building index...");
const index = {}; // "company::line" → Set<regionId>
let featureCount = 0;

for (const feature of railroad.features) {
  const line = feature.properties?.["路線名"];
  const company = feature.properties?.["運営会社"];
  if (!line || !company) continue;

  const key = `${company}::${line}`;
  if (!index[key]) index[key] = new Set();

  // Skip if already assigned to all regions (nothing new to discover)
  const entry = index[key];
  if (entry.size === regionPrefGeoms.length) continue;

  const coords = sampleCoords(feature.geometry);
  for (const coord of coords) {
    for (const region of regionPrefGeoms) {
      if (!entry.has(region.id) && coordInRegion(coord, region)) {
        entry.add(region.id);
      }
    }
    // Early exit if all regions found
    if (entry.size === regionPrefGeoms.length) break;
  }

  featureCount++;
  if (featureCount % 5000 === 0) process.stdout.write(`  ${featureCount} features...\r`);
}

// Serialize Sets to arrays
const result = {};
for (const [key, regionSet] of Object.entries(index)) {
  result[key] = [...regionSet];
}

const outPath = join(root, "static/line-region-index.json");
writeFileSync(outPath, JSON.stringify(result));

const lineCount = Object.keys(result).length;
const fileSize = (JSON.stringify(result).length / 1024).toFixed(0);
console.log(`\nProcessed ${featureCount} features, ${lineCount} unique lines`);
console.log(`Wrote ${outPath} (${fileSize} KB)`);
