import { lineColorMap } from './line-colors-data.js';

const colorForTheme = (color, mapTheme = "dark") => {
  if (!color) return null;

  if (typeof color === "string") {
    return color;
  }

  if (mapTheme === "light") {
    return color.light || color.dark || null;
  }

  return color.dark || color.light || null;
};

const findLineColorDefinition = (companyName, lineName) => {
  if (!companyName || !lineName) return null;

  // Try exact match
  if (colorMap[companyName] && colorMap[companyName][lineName]) {
    return colorMap[companyName][lineName];
  }

  // Try partial match on line name (e.g. "山手線" might match "山手")
  if (colorMap[companyName]) {
    for (const key of Object.keys(colorMap[companyName])) {
      if (lineName.includes(key) || key.includes(lineName)) {
        return colorMap[companyName][key];
      }
    }
  }

  // Try generic matching across all companies if the company is not found
  for (const comp of Object.keys(colorMap)) {
    if (colorMap[comp][lineName]) {
      return colorMap[comp][lineName];
    }
    for (const key of Object.keys(colorMap[comp])) {
      if (lineName.includes(key) || key.includes(lineName)) {
        return colorMap[comp][key];
      }
    }
  }

  return null;
};

export const getLineColor = (companyName, lineName, mapTheme = "dark") => {
  return colorForTheme(findLineColorDefinition(companyName, lineName), mapTheme);
};
