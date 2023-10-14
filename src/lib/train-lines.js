export const line_names = (geojson) => {
  let lines = {};
  for (var feature of geojson.features) {
    let line_name = feature.properties["路線名"];
    let company_name = feature.properties["運営会社"];
    if (!lines[company_name]) {
      lines[company_name] = {};
    }

    lines[company_name][line_name] = 1;
  }
  return lines;
};
