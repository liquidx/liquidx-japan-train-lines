import { pull, concat } from "lodash-es";
import { prioritizedTrainCompanies } from './line-major-data.js'
import { lineNames } from "./train-lines.js";
import { svg_from_segments } from "./train-line-svg.js";
import trainLineCorrections from "./train-line-corrections.json";
import {
  tokyoTrainLineNames,
  tokyoTrainCompanies,
} from "./tokyo-train-lines-data.js";
import { regions } from "./regions.js";

let _trainLines = {};
let _regionsGeoJson = {};
let _stationGeoJson = null;
let _regionsStationGeoJson = {};
let _japanOutlineGeoJson = null;


export const drawTrainLine = (
  regionName,
  companyName,
  lineName,
  viewerEl,
  width = 640,
  options = {}
) => {
  if (!viewerEl) {
    console.log("Error: viewerEl is null");
    return;
  }
  let correction =
    trainLineCorrections[companyName] &&
    trainLineCorrections[companyName][lineName];

  console.log(regionName, companyName, lineName);
  let geojson = _regionsGeoJson[regionName] || _trainLines;
  let stationGeoJson = _regionsStationGeoJson[regionName] || _stationGeoJson;

  let result = svg_from_segments(
    geojson,
    stationGeoJson,
    regionName,
    companyName,
    lineName,
    width,
    correction,
    { ...options, japanOutlineGeoJson: _japanOutlineGeoJson }
  );
  // result.svg is generated from trusted GeoJSON data fetched from a known URL
  viewerEl.innerHTML = result.svg; // nosec

  for (var p of document.querySelectorAll("g.segment")) {
    p.addEventListener("mouseover", (e) => {
      e.target.setAttribute("stroke-width", "4");
      e.target.setAttribute("stroke", "red");
    });
    p.addEventListener("mouseout", (e) => {
      e.target.removeAttribute("stroke-width");
      e.target.removeAttribute("stroke");
    });
  }

  return { bounds: result.bounds, svgWidth: result.svgWidth, svgHeight: result.svgHeight };
};

const getTrainCompanyNames = (train_lines) => {
  let companyNames = Object.keys(train_lines);

  // Force a few companies to be at the top.
  companyNames = pull(companyNames, ...prioritizedTrainCompanies);
  companyNames = concat(prioritizedTrainCompanies, companyNames);

  let lines = [];
  for (const company_name of companyNames) {
    if (!train_lines[company_name]) continue;
    let lineNames = Object.keys(train_lines[company_name]);
    lines.push({
      company: company_name,
      lines: lineNames,
    });
  }

  return lines;
};

// --- Coordinate containment (used only for Tokyo special-case filtering) ---

const isCoordinateInBounds = (coord, bounds) => {
  return (
    coord &&
    coord[0] >= bounds.min_lng &&
    coord[0] <= bounds.max_lng &&
    coord[1] >= bounds.min_lat &&
    coord[1] <= bounds.max_lat
  );
};

const hasCoordinateInBounds = (geometry, bounds) => {
  if (!geometry) return false;
  if (geometry.type === "Point") {
    return isCoordinateInBounds(geometry.coordinates, bounds);
  }
  if (geometry.type === "LineString") {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.some(coord => isCoordinateInBounds(coord, bounds));
  }
  if (geometry.type === "MultiLineString") {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.some(lineCoords =>
      Array.isArray(lineCoords) && lineCoords.some(coord => isCoordinateInBounds(coord, bounds))
    );
  }
  return false;
};

// _lineRegionIndex: "company::line" → string[] of region IDs, precomputed at build time.
let _lineRegionIndex = null;

export const getTokyoGeoJson = (geojson, railroadGeojson) => {
  const matchingLines = new Set();
  const sourceGeojson = railroadGeojson || geojson;

  for (const feature of sourceGeojson.features) {
    const line_name = feature.properties?.["路線名"];
    const company_name = feature.properties?.["運営会社"];
    if (!line_name || !company_name) continue;

    if (
      tokyoTrainLineNames.includes(line_name) &&
      tokyoTrainCompanies.includes(company_name)
    ) {
      const bounds = { min_lng: 138.9114, max_lng: 139.9305, min_lat: 35.498, max_lat: 35.916 };
      if (hasCoordinateInBounds(feature.geometry, bounds)) {
        matchingLines.add(`${company_name}::${line_name}`);
      }
    }
  }

  const features = geojson.features.filter(feature => {
    const line_name = feature.properties?.["路線名"];
    const company_name = feature.properties?.["運営会社"];
    return matchingLines.has(`${company_name}::${line_name}`);
  });

  return { features };
};

export const filterGeoJsonByRegion = (geojson, region) => {
  return {
    features: geojson.features.filter(feature => {
      const line = feature.properties?.["路線名"];
      const company = feature.properties?.["運営会社"];
      if (!line || !company) return false;
      const key = `${company}::${line}`;
      return _lineRegionIndex?.[key]?.includes(region.id) ?? false;
    }),
  };
};

export const loadTrainLines = async ({ railroadGeoJsonUrl, stationGeoJsonUrl = null, japanOutlineGeoJsonUrl = null }) => {
  return Promise.all([
    fetch(railroadGeoJsonUrl).then((response) => response.json()),
    stationGeoJsonUrl
      ? fetch(stationGeoJsonUrl).then((response) => response.json())
      : Promise.resolve(null),
    japanOutlineGeoJsonUrl
      ? fetch(japanOutlineGeoJsonUrl).then((response) => response.json())
      : Promise.resolve(null),
    fetch("/line-region-index.json").then((r) => r.json()),
  ])
    .then(([json, stationJson, japanOutlineJson, lineRegionIndex]) => {
      _trainLines = json;
      _stationGeoJson = stationJson;
      _japanOutlineGeoJson = japanOutlineJson;
      _lineRegionIndex = lineRegionIndex;

      // Cache GeoJSON slice for each region
      _regionsGeoJson["japan"] = json;
      _regionsGeoJson["tokyo"] = getTokyoGeoJson(json);
      if (stationJson) {
        _regionsStationGeoJson["japan"] = stationJson;
        _regionsStationGeoJson["tokyo"] = getTokyoGeoJson(stationJson, json);
      } else {
        _regionsStationGeoJson = {};
      }

      for (const r of regions) {
        if (r.id !== "japan" && r.id !== "tokyo") {
          _regionsGeoJson[r.id] = filterGeoJsonByRegion(json, r);
          if (stationJson) {
            _regionsStationGeoJson[r.id] = filterGeoJsonByRegion(stationJson, r);
          }
        }
      }

      // Precalculate companies and lines lists per region
      const regionData = {};
      for (const r of regions) {
        let rGeoJson = _regionsGeoJson[r.id];
        let rLineNames = lineNames(rGeoJson);
        regionData[r.id] = getTrainCompanyNames(rLineNames);
      }

      return {
        regions,
        regionData,
      };
    });
};
