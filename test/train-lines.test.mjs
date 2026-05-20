import { describe, it, expect } from "vitest";
import { joinSegments, lineNames } from "../src/lib/train-lines.js";
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
});
