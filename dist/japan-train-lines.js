import { pull, concat, map } from "lodash";

import { lineNames } from "./train-lines.js";
import { svg_from_segments } from "./train-line-svg.js";
import trainLineCorrections from "./train-line-corrections.json";
import {
  tokyoTrainLineNames,
  tokyoTrainCompanies,
} from "./tokyo-train-lines.js";

let _trainLines = {};
let _tokyoTrainLines = {};

let _trainCompanyNames = [];
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
  width = 640
) => {
  if (!viewerEl) {
    console.log("Error: viewerEl is null");
    return;
  }
  let correction =
    trainLineCorrections[companyName] &&
    trainLineCorrections[companyName][lineName];

  console.log(regionName, companyName, lineName);
  let geojson = _trainLines;
  if (regionName === "tokyo") {
    geojson = _tokyoTrainLines;
  }

  let svg = svg_from_segments(
    geojson,
    regionName,
    companyName,
    lineName,
    width,
    correction
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
  // Force a few companies to the at the top.
  companyNames = pull(companyNames, _prioritizedTrainCompanies);
  companyNames = concat(_prioritizedTrainCompanies, companyNames);

  let lines = [];
  for (const company_name of companyNames) {
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
  let tokyoBounds = { min_lat: 0, max_lat: 0, min_lng: 0, max_lng: 0 };

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
        // 35.49847384661725
        // 35.91588996968289
        // 138.91140168309812
        // 139.93047276073878
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
  console.log(companyLines);
  return { features };
};

export const loadTrainLines = async ({ railroadGeoJsonUrl }) => {
  return fetch(railroadGeoJsonUrl)
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      // Store to a global
      _trainLines = json;
      _tokyoTrainLines = getTokyoGeoJson(json);
      let trainLineNames = lineNames(json);
      _trainCompanyNames = getTrainCompanyNames(trainLineNames);

      return {
        trainLines: _trainLines,
        trainCompanyNames: _trainCompanyNames,
      };
    });
};
