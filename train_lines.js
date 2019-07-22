let line_names = (geojson) => {
  let lines = {};
  for (var feature of geojson.features) {
    let line_name = feature.properties['N02_003'];
    let company_name = feature.properties['N02_004'];
    if (!lines[company_name]) {
      lines[company_name] = {}
    }

    lines[company_name][line_name] = 1;
  }
  return lines;
};

module.exports = line_names;
