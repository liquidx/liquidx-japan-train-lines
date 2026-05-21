import { joinSegments } from "./train-lines.js";
import { getLineColor } from "./line-colors.js";
import { regions } from "./regions.js";

const colors = ["8da1b9", "95adb6", "cbb3bf", "dbc7be", "ef959c"];

const escape_xml = (value) => {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
};

const fallback_color_for_line = (company_name, line_name) => {
  let key = `${company_name || ""}:${line_name || ""}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % colors.length;
  }
  return colors[hash];
};

const svg_paint = (color) => {
  if (color.startsWith("#") || color.startsWith("var(") || color.startsWith("rgb")) {
    return color;
  }
  return `#${color}`;
};

const color_for_line = (company_name, line_name, options = {}) => {
  if (options.showLineColors === false) {
    return "var(--color-map-line-mono)";
  }

  const lineColor =
    getLineColor(company_name, line_name, options.mapTheme) ||
    fallback_color_for_line(company_name, line_name);

  if (options.mapTheme === "light" && lineColor.toLowerCase() === "ffffff") {
    return "var(--color-map-line-mono)";
  }

  return lineColor;
};

const features_for_line = (
  geojson,
  company_name_pattern,
  line_name_pattern
) => {
  let features = [];
  if (!geojson?.features) {
    return features;
  }

  let line_name_re = line_name_pattern ? new RegExp(line_name_pattern, "i") : null;
  let company_name_re = company_name_pattern ? new RegExp(company_name_pattern, "i") : null;

  for (var feature of geojson.features) {
    let line_name = feature.properties["路線名"];
    let company_name = feature.properties["運営会社"];
    if (company_name_re && !company_name_re.test(company_name)) {
      continue;
    }
    if (line_name_re && !line_name_re.test(line_name)) {
      continue;
    }
    features.push(feature);
  }

  return features;
};

const segments_for_line = (
  geojson,
  company_name_pattern,
  line_name_pattern
) => {
  let segments = features_for_line(
    geojson,
    company_name_pattern,
    line_name_pattern
  );

  // Group segments by company and line name to join segments of each line separately
  let groups = {};
  for (let segment of segments) {
    let company = segment.properties ? segment.properties["運営会社"] : "";
    let line = segment.properties ? segment.properties["路線名"] : "";
    let key = `${company}::${line}`;
    if (!groups[key]) {
      groups[key] = {
        company,
        line,
        segments: []
      };
    }
    groups[key].segments.push(segment);
  }

  let joinedSegments = [];
  for (let key in groups) {
    let group = groups[key];
    let joined = joinSegments(group.segments);
    // Add properties back to the joined segments
    for (let j of joined) {
      j.properties = {
        "運営会社": group.company,
        "路線名": group.line
      };
    }
    joinedSegments = joinedSegments.concat(joined);
  }

  return joinedSegments;
};

const coordinates_for_feature = (feature) => {
  if (!feature?.geometry) {
    return [];
  }

  if (feature.geometry.type === "Point") {
    return [feature.geometry.coordinates];
  }

  if (feature.geometry.type === "LineString") {
    return feature.geometry.coordinates;
  }

  if (feature.geometry.type === "MultiLineString") {
    return feature.geometry.coordinates.flat();
  }

  return [];
};

const point_for_feature = (feature) => {
  let coordinates = coordinates_for_feature(feature);
  if (!coordinates.length) {
    return null;
  }

  let total = coordinates.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0]
  );
  return [total[0] / coordinates.length, total[1] / coordinates.length];
};

const bounding_box = (segments) => {
  let min_x, min_y, max_x, max_y;
  for (var i = 0; i < segments.length; i++) {
    let coordinates = segments[i]["geometry"]["coordinates"];
    if (i == 0) {
      min_x = coordinates[0][0];
      min_y = coordinates[0][1];
      max_x = coordinates[0][0];
      max_y = coordinates[0][1];
      max_y = coordinates[0][1];
    }
    for (var c of coordinates) {
      if (c[0] < min_x) {
        min_x = c[0];
      }
      if (c[0] > max_x) {
        max_x = c[0];
      }
      if (c[1] < min_y) {
        min_y = c[1];
      }
      if (c[1] > max_y) {
        max_y = c[1];
      }
    }
  }
  return { min_x: min_x, min_y: min_y, max_x: max_x, max_y: max_y };
};

export const svg_from_segments = (
  geojson,
  station_geojson,
  region_name,
  company_name,
  line_name,
  max_dim = 2000,
  correction = null,
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
  if (correction) {
    for (var include of correction.includes) {
      segments = segments.concat(
        segments_for_line(geojson, include.company, include.line)
      );
      stations = stations.concat(
        features_for_line(station_geojson, include.company, include.line)
      );
    }
    for (var filter of correction.filters) {
      let filter_segments = segments_for_line(
        geojson,
        filter.company,
        filter.line
      );
      let filter_b = bounding_box(filter_segments);
      segments = segments.filter((v, i, s) => {
        let p = v.geometry.coordinates[0];
        return (
          true &&
          (!filter.within_x || p[0] <= filter_b.max_x) &&
          (!filter.within_y || p[1] <= filter_b.max_y) &&
          (!filter.within_x || p[0] >= filter_b.min_x) &&
          (!filter.within_y || p[1] >= filter_b.min_y)
        );
      });
      stations = stations.filter((station) => {
        let p = point_for_feature(station);
        if (!p) {
          return false;
        }
        return (
          true &&
          (!filter.within_x || p[0] <= filter_b.max_x) &&
          (!filter.within_y || p[1] <= filter_b.max_y) &&
          (!filter.within_x || p[0] >= filter_b.min_x) &&
          (!filter.within_y || p[1] >= filter_b.min_y)
        );
      });
    }
  }
  let b;
  if (!company_name && region_name && region_name !== "japan") {
    const region = regions.find((r) => r.id === region_name);
    if (region && region.bounds) {
      b = {
        min_x: region.bounds.min_lng,
        max_x: region.bounds.max_lng,
        min_y: region.bounds.min_lat,
        max_y: region.bounds.max_lat,
      };
    }
  }

  if (!b) {
    b = bounding_box(segments);
  }
  let width = b.max_x - b.min_x;
  let height = b.max_y - b.min_y;
  let width_px, height_px;
  if (width > height) {
    width_px = max_dim;
    height_px = (width_px / width) * height;
  } else {
    height_px = max_dim;
    width_px = (height_px / height) * width;
  }

  let svg_string = `<svg width="${width_px}px" height="${height_px}px" viewBox="0 0 ${width_px} ${height_px}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`;
  svg_string +=
    '  <g data-map-layer fill="none" fill-rule="evenodd" stroke-linecap="square" stroke-linejoin="square">\n';

  if (options.japanOutlineGeoJson && options.showBaseMapOutline !== false) {
    const geometries = options.japanOutlineGeoJson.geometries || [];
    const segments = geometries.map((geom) => ({ geometry: geom }));
    const joined = joinSegments(segments);

    let combined_d = "";
    for (const feature of joined) {
      let svg_points = "";
      for (const point of feature.geometry.coordinates) {
        const x = ((point[0] - b.min_x) * width_px) / width;
        const y = height_px - ((point[1] - b.min_y) * height_px) / height;
        if (!svg_points) {
          svg_points += `M${x},${y} `;
        } else {
          svg_points += `L${x},${y} `;
        }
      }
      if (svg_points) {
        svg_points += "Z";
        combined_d += svg_points + " ";
      }
    }

    if (combined_d) {
      svg_string += `    <path class="japan-outline-path" fill="var(--color-map-land-fill)" stroke="var(--color-map-land-stroke)" stroke-width="1" vector-effect="non-scaling-stroke" fill-rule="evenodd" d="${combined_d.trim()}"></path>\n`;
    }
  }

  let n = 1;
  for (var segment of segments) {
    let svg_points = "";
    for (var point of segment.geometry.coordinates) {
      var x = ((point[0] - b.min_x) * width_px) / width;
      var y = height_px - ((point[1] - b.min_y) * height_px) / height;
      if (!svg_points) {
        svg_points += `M${x},${y} `;
      } else {
        svg_points += `L${x},${y} `;
      }
    }
    let path_id = `path-${n}`;
    let segLine = segment.properties ? segment.properties["路線名"] : line_name;
    let segCompany = segment.properties ? segment.properties["運営会社"] : company_name;
    let strokeColor = color_for_line(segCompany, segLine, options);
    n += 1;
    let svg_path = `  <path id="${path_id}" stroke="${svg_paint(strokeColor)}" stroke-width="2" vector-effect="non-scaling-stroke" d="${svg_points}"></path>\n`;
    svg_string += svg_path;
  }

  let station_n = 1;
  for (var station of stations) {
    let point = point_for_feature(station);
    if (!point) {
      continue;
    }

    var station_x = ((point[0] - b.min_x) * width_px) / width;
    var station_y = height_px - ((point[1] - b.min_y) * height_px) / height;
    let station_name = escape_xml(station.properties ? station.properties["駅名"] : "");
    let station_id = `station-${station_n}`;
    let station_line = station.properties ? station.properties["路線名"] : line_name;
    let station_company = station.properties ? station.properties["運営会社"] : company_name;
    let station_color = color_for_line(station_company, station_line, options);
    station_n += 1;
    let station_svg = `  <circle id="${station_id}" class="station-dot" cx="${station_x}" cy="${station_y}" r="2" fill="${svg_paint(station_color)}" stroke="${svg_paint(station_color)}" stroke-width="0.2" vector-effect="non-scaling-stroke" pointer-events="all" data-station-name="${station_name}" data-line-name="${escape_xml(station_line)}" data-company-name="${escape_xml(station_company)}"></circle>\n`;
    svg_string += station_svg;
  }
  svg_string += "</g>\n";
  svg_string += "</svg>\n";
  return { svg: svg_string, bounds: b, svgWidth: width_px, svgHeight: height_px };
};
