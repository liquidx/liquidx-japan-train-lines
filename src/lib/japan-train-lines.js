import { pull, concat, map } from "lodash-es";

import { lineNames } from "./train-lines.js";
import { svg_from_segments } from "./train-line-svg.js";
import trainLineCorrections from "./train-line-corrections.json";
import {
  tokyoTrainLineNames,
  tokyoTrainCompanies,
} from "./tokyo-train-lines.js";

let _trainLines = {};
let _regionsGeoJson = {};
let _stationGeoJson = null;
let _regionsStationGeoJson = {};

export const regions = [
  { id: "tokyo", name: "Tokyo", nameJa: "東京", bounds: { min_lng: 138.9114, max_lng: 139.9305, min_lat: 35.498, max_lat: 35.916 } },
  { id: "kansai", name: "Kansai (Osaka/Kyoto)", nameJa: "関西", bounds: { min_lng: 134.8, max_lng: 136.2, min_lat: 34.2, max_lat: 35.4 } },
  { id: "chubu", name: "Chubu (Nagoya)", nameJa: "中部", bounds: { min_lng: 136.2, max_lng: 137.6, min_lat: 34.6, max_lat: 35.6 } },
  { id: "kyushu", name: "Kyushu (Fukuoka)", nameJa: "九州", bounds: { min_lng: 129.8, max_lng: 131.2, min_lat: 32.7, max_lat: 34.2 } },
  { id: "hokkaido", name: "Hokkaido (Sapporo)", nameJa: "北海道", bounds: { min_lng: 140.7, max_lng: 142.1, min_lat: 42.5, max_lat: 43.6 } },
  { id: "tohoku", name: "Tohoku (Sendai)", nameJa: "東北", bounds: { min_lng: 140.3, max_lng: 141.5, min_lat: 37.8, max_lat: 38.8 } },
  { id: "japan", name: "All Japan", nameJa: "全国" }
];

let _prioritizedTrainCompanies = [
  "東京地下鉄",
  "東急電鉄",
  "東京モノレール",
  "東京都",
  "東京臨海高速鉄道",
  "東日本旅客鉄道",
  "西武鉄道",
  "京成電鉄",
  "京王電鉄",
];

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

  let svg = svg_from_segments(
    geojson,
    stationGeoJson,
    regionName,
    companyName,
    lineName,
    width,
    correction,
    options
  );
  viewerEl.innerHTML = svg;

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
};

const getTrainCompanyNames = (train_lines) => {
  let companyNames = Object.keys(train_lines);
  // Force a few companies to be at the top.
  companyNames = pull(companyNames, _prioritizedTrainCompanies);
  companyNames = concat(_prioritizedTrainCompanies, companyNames);

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

const getTokyoGeoJson = (geojson) => {
  let features = [];
  let companyLines = [];

  for (var feature of geojson.features) {
    let line_name = feature.properties["路線名"];
    let company_name = feature.properties["運営会社"];
    if (
      tokyoTrainLineNames.includes(line_name) &&
      tokyoTrainCompanies.includes(company_name)
    ) {
      if (!companyLines[company_name]) {
        companyLines[company_name] = {};
      }
      companyLines[company_name][line_name] = line_name;

      // Remove anything that is outside of Tokyo
      if (feature.geometry.type === "LineString") {
        let p = feature.geometry.coordinates[0];
        if (
          !(
            p[0] >= 138.9114 &&
            p[0] <= 139.9305 &&
            p[1] >= 35.498 &&
            p[1] <= 35.916
          )
        ) {
          continue;
        }
      }
      features.push(feature);
    }
  }
  return { features };
};

const filterGeoJsonByBounds = (geojson, bounds) => {
  let features = [];
  for (var feature of geojson.features) {
    if (feature.geometry.type === "LineString") {
      let p = feature.geometry.coordinates[0];
      if (
        p[0] >= bounds.min_lng &&
        p[0] <= bounds.max_lng &&
        p[1] >= bounds.min_lat &&
        p[1] <= bounds.max_lat
      ) {
        features.push(feature);
      }
    }
  }
  return { features };
};

export const loadTrainLines = async ({ railroadGeoJsonUrl, stationGeoJsonUrl = null }) => {
  return Promise.all([
    fetch(railroadGeoJsonUrl).then((response) => response.json()),
    stationGeoJsonUrl
      ? fetch(stationGeoJsonUrl).then((response) => response.json())
      : Promise.resolve(null),
  ])
    .then(([json, stationJson]) => {
      _trainLines = json;
      _stationGeoJson = stationJson;
      
      // Cache GeoJSON slice for each region
      _regionsGeoJson["japan"] = json;
      _regionsGeoJson["tokyo"] = getTokyoGeoJson(json);
      if (stationJson) {
        _regionsStationGeoJson["japan"] = stationJson;
        _regionsStationGeoJson["tokyo"] = getTokyoGeoJson(stationJson);
      } else {
        _regionsStationGeoJson = {};
      }

      for (const r of regions) {
        if (r.id !== "japan" && r.id !== "tokyo") {
          _regionsGeoJson[r.id] = filterGeoJsonByBounds(json, r.bounds);
          if (stationJson) {
            _regionsStationGeoJson[r.id] = filterGeoJsonByBounds(stationJson, r.bounds);
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
