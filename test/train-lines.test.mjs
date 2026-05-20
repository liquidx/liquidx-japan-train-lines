import { describe, it, expect } from "vitest";
import { joinSegments, lineNames } from "../src/lib/train-lines.js";
import { svg_from_segments } from "../src/lib/train-line-svg.js";
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
      expect(svg).toContain('fill="#ffdaa6"');
      expect(svg).toContain('stroke="#ff9500"');
      expect(svg).toContain("渋谷");
      expect(svg).not.toContain("新宿");
    });
  });
});
