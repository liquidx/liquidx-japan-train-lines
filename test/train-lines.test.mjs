import { joinSegments } from "../src/lib/train-lines.js";
import fs from "fs";
import assert from "assert";

it("should join segments", () => {
  const segments = JSON.parse(
    fs.readFileSync("test/fixtures/asakusa-line.json")
  );

  const joinedSegments = joinSegments(segments);
  assert.equal(joinedSegments.length, 1);
});
