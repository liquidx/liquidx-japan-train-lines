
let segments_for_line = (geojson, line_name_pattern, company_name_pattern) => {
  let segments = [];
  let line_name_re = new RegExp(line_name_pattern, 'i');
  let company_name_re = new RegExp(company_name_pattern, 'i');

  for (var feature of geojson.features) {
    let line_name = feature.properties['N02_003'];
    let company_name = feature.properties['N02_004'];
    //if (!line_name_pattern || line_name_re.test(line_name)) {
    if (!line_name_pattern || line_name == line_name_pattern) {
      if (!company_name_pattern || company_name_re.test(company_name)) {
        segments.push(feature);
      }
    }
  };
  return segments;
};

let svg_from_segments = (geojson, line_name_pattern, company_name_pattern) => {
  let segments = segments_for_line(geojson, line_name_pattern, company_name_pattern);

  let min_x, min_y, max_x, max_y;
  for (var i = 0; i < segments.length; i++) {
    let coordinates = segments[i]['geometry']['coordinates'];
    if (i == 0) {
      min_x = coordinates[0][0];
      min_y = coordinates[0][1];
      max_x = coordinates[0][0];
      max_y = coordinates[0][1];
    }
    for (var c of coordinates) {
      if (c[0] < min_x) { min_x = c[0]; }
      if (c[0] > max_x) { max_x = c[0]; }
      if (c[1] < min_y) { min_y = c[1]; }
      if (c[1] > max_y) { max_y = c[1]; }
    }
  }

  let width = max_x - min_x;
  let height = max_y - min_y;
  let width_px = 640;
  let height_px = width_px / width * height;

  let svg_string = `<svg width="${width_px}px" height="${height_px}px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`;
  svg_string += '  <g stroke="#D5B43C" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="square" stroke-linejoin="bevel">\n';
  for (var segment of segments) {
    let svg_points = '';
    for (var point of segment.geometry.coordinates) {
      var x = (point[0] - min_x) * width_px / width;
      var y = height_px - ((point[1] - min_y) * height_px / height);
      if (!svg_points) {
        svg_points += `M${x},${y} `
      } else {
        svg_points += `L${x},${y} `
      }
    }
    let svg_path = `   <path d="${svg_points}"></path>\n`;
    svg_string += svg_path;
  }
  svg_string += '</g>\n';
  svg_string += '</svg>\n';
  return svg_string;
};

module.exports = svg_from_segments;