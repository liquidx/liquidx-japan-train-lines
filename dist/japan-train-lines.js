import { pull, concat, map } from "lodash";

import { line_names } from "./train-lines.js";
import { svg_from_segments } from "./train-line-svg.js";
import trainLineCorrections from "./train-line-corrections.json";

let _trainLines = {};
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

export const drawTrainLine = (companyName, lineName, viewerEl, width = 640) => {
  if (!viewerEl) {
    console.log("Error: viewerEl is null");
    return;
  }
  let correction =
    trainLineCorrections[companyName] &&
    trainLineCorrections[companyName][lineName];
  let svg = svg_from_segments(
    _trainLines,
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

export const loadTrainLines = async ({ railroadGeoJsonUrl }) => {
  return fetch(railroadGeoJsonUrl)
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      // Store to a global
      _trainLines = json;
      let trainLineNames = line_names(json);
      _trainCompanyNames = getTrainCompanyNames(trainLineNames);

      return {
        trainLines: _trainLines,
        trainCompanyNames: _trainCompanyNames,
      };
    });
};
