import { describe, it, expect } from "vitest";
import { joinSegments, lineNames } from "../src/lib/train-lines.js";
import { svg_from_segments } from "../src/lib/train-line-svg.js";
import { filterGeoJsonByBounds, getTokyoGeoJson } from "../src/lib/japan-train-lines.js";
import fs from "fs";

describe("train-lines", () => {
  describe("joinSegments", () => {
    it("should join segments", () => {
      const segments = JSON.parse(
        fs.readFileSync("test/fixtures/asakusa-line.json")
      );

      const joinedSegments = joinSegments(segments);
      expect(joinedSegments.length).toBe(1);
    });
  });

  describe("lineNames", () => {
    it("should extract unique line and company names from geojson", () => {
      const mockGeojson = {
        features: [
          {
            properties: {
              "路線名": "山手線",
              "運営会社": "東日本旅客鉄道"
            }
          },
          {
            properties: {
              "路線名": "山手線",
              "運営会社": "東日本旅客鉄道"
            }
          },
          {
            properties: {
              "路線名": "中央線",
              "運営会社": "東日本旅客鉄道"
            }
          },
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄"
            }
          }
        ]
      };

      const result = lineNames(mockGeojson);
      expect(result).toEqual({
        "東日本旅客鉄道": {
          "山手線": 1,
          "中央線": 1
        },
        "東京地下鉄": {
          "銀座線": 1
        }
      });
    });

    it("should handle empty geojson features array", () => {
      const mockGeojson = {
        features: []
      };
      const result = lineNames(mockGeojson);
      expect(result).toEqual({});
    });
  });

  describe("svg_from_segments", () => {
    it("renders station dots only for the selected line", () => {
      const railroadGeojson = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.1, 35.1],
                [139.2, 35.2]
              ]
            }
          }
        ]
      };
      const stationGeojson = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄",
              "駅名": "渋谷"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.1, 35.1],
                [139.12, 35.12]
              ]
            }
          },
          {
            properties: {
              "路線名": "丸ノ内線",
              "運営会社": "東京地下鉄",
              "駅名": "新宿"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.2, 35.2],
                [139.22, 35.22]
              ]
            }
          }
        ]
      };

      const svg = svg_from_segments(
        railroadGeojson,
        stationGeojson,
        "tokyo",
        "東京地下鉄",
        "銀座線",
        640
      );

      expect(svg).toContain('class="station-dot"');
      expect(svg).toContain('fill="#ff9500"');
      expect(svg).toContain('stroke="#ff9500"');
      expect(svg).toContain("渋谷");
      expect(svg).not.toContain("新宿");
    });

    it("renders multiple lines with their correct colors when line_name is null", () => {
      const railroadGeojson = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.1, 35.1],
                [139.2, 35.2]
              ]
            }
          },
          {
            properties: {
              "路線名": "丸ノ内線",
              "運営会社": "東京地下鉄"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.3, 35.3],
                [139.4, 35.4]
              ]
            }
          }
        ]
      };
      const stationGeojson = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄",
              "駅名": "渋谷"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.1, 35.1],
                [139.12, 35.12]
              ]
            }
          },
          {
            properties: {
              "路線名": "丸ノ内線",
              "運営会社": "東京地下鉄",
              "駅名": "新宿"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.3, 35.3],
                [139.32, 35.32]
              ]
            }
          }
        ]
      };

      const svg = svg_from_segments(
        railroadGeojson,
        stationGeojson,
        "tokyo",
        "東京地下鉄",
        null,
        640
      );

      // Check that Ginza line path has its color (#ff9500)
      expect(svg).toContain('stroke="#ff9500"');
      // Check that Marunouchi line path has its color (#f30100)
      expect(svg).toContain('stroke="#f30100"');
      // Check that both stations are rendered with their respective line colors
      expect(svg).toContain('fill="#ff9500"');
      // Check that both stations are rendered with their respective line colors
      expect(svg).toContain('fill="#f30100"');
    });

    it("can hide the base map outline", () => {
      const railroadGeojson = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄"
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [139.1, 35.1],
                [139.2, 35.2]
              ]
            }
          }
        ]
      };
      const japanOutlineGeoJson = {
        geometries: [
          {
            type: "LineString",
            coordinates: [
              [139.0, 35.0],
              [139.3, 35.0],
              [139.3, 35.3]
            ]
          }
        ]
      };

      const visibleSvg = svg_from_segments(
        railroadGeojson,
        null,
        "tokyo",
        "東京地下鉄",
        "銀座線",
        640,
        null,
        { japanOutlineGeoJson }
      );
      const hiddenSvg = svg_from_segments(
        railroadGeojson,
        null,
        "tokyo",
        "東京地下鉄",
        "銀座線",
        640,
        null,
        { japanOutlineGeoJson, showBaseMapOutline: false }
      );

      expect(visibleSvg).toContain('class="japan-outline-path"');
      expect(hiddenSvg).not.toContain('class="japan-outline-path"');
    });
  });

  describe("filterGeoJsonByBounds & getTokyoGeoJson", () => {
    const mockGeojson = {
      features: [
        {
          properties: {
            "路線名": "銀座線",
            "運営会社": "東京地下鉄"
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [139.1, 35.1],
              [139.2, 35.2]
            ]
          }
        },
        {
          properties: {
            "路線名": "銀座線",
            "運営会社": "東京地下鉄"
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [142.1, 38.1],
              [142.2, 38.2]
            ]
          }
        },
        {
          properties: {
            "路線名": "丸ノ内線",
            "運営会社": "東京地下鉄"
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [142.1, 38.1],
              [142.2, 38.2]
            ]
          }
        }
      ]
    };

    const kantoBounds = { min_lng: 138.3, max_lng: 141.0, min_lat: 34.8, max_lat: 37.2 };

    it("should retain all segments of a line if at least one segment is in the region", () => {
      const result = filterGeoJsonByBounds(mockGeojson, kantoBounds);
      
      const lines = result.features.map(f => `${f.properties["運営会社"]}::${f.properties["路線名"]}`);
      
      expect(result.features.length).toBe(2);
      expect(lines).toEqual([
        "東京地下鉄::銀座線",
        "東京地下鉄::銀座線"
      ]);
    });

    it("should correctly filter stations using the railroad GeoJSON to match lines", () => {
      const mockStations = {
        features: [
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄",
              "駅名": "渋谷"
            },
            geometry: {
              type: "Point",
              coordinates: [139.1, 35.1]
            }
          },
          {
            properties: {
              "路線名": "銀座線",
              "運営会社": "東京地下鉄",
              "駅名": "浅草"
            },
            geometry: {
              type: "Point",
              coordinates: [142.1, 38.1]
            }
          },
          {
            properties: {
              "路線名": "丸ノ内線",
              "運営会社": "東京地下鉄",
              "駅名": "新宿"
            },
            geometry: {
              type: "Point",
              coordinates: [142.1, 38.1]
            }
          }
        ]
      };

      const result = filterGeoJsonByBounds(mockStations, kantoBounds, mockGeojson);
      
      const stations = result.features.map(f => f.properties["駅名"]);
      
      expect(result.features.length).toBe(2);
      expect(stations).toContain("渋谷");
      expect(stations).toContain("浅草");
      expect(stations).not.toContain("新宿");
    });
  });
});
