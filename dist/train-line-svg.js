const segments_for_line = (
  geojson,
  company_name_pattern,
  line_name_pattern
) => {
  let segments = [];
  let line_name_re = new RegExp(line_name_pattern, "i");
  let company_name_re = new RegExp(company_name_pattern, "i");

  for (var feature of geojson.features) {
    let line_name = feature.properties["路線名"];
    let company_name = feature.properties["運営会社"];
    if (!company_name_pattern || company_name_re.test(company_name)) {
      if (!line_name_pattern || line_name_re.test(line_name)) {
        segments.push(feature);
      }
    }
  }
  return segments;
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
  company_name,
  line_name,
  max_dim = 640,
  correction = null
) => {
  let segments = segments_for_line(geojson, company_name, line_name);
  if (correction) {
    for (var include of correction.includes) {
      segments = segments.concat(
        segments_for_line(geojson, include.company, include.line)
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
    }
  }

  let b = bounding_box(segments);
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

  let svg_string = `<svg width="${width_px}px" height="${height_px}px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`;
  svg_string +=
    '  <g stroke="#D5B43C" stroke-width="2" fill="none" fill-rule="evenodd" stroke-linecap="square" stroke-linejoin="square">\n';
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
    n += 1;
    let svg_path = `   <g class="segment" id="${path_id}"><path d="${svg_points}"></path></g>\n`;
    svg_string += svg_path;
  }
  svg_string += "</g>\n";
  svg_string += "</svg>\n";
  return svg_string;
};
