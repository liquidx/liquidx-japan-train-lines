export const lineNames = (geojson) => {
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

// Merge segments into a continuous paths.
export const joinSegments = (segments) => {
  let remainingSegments = segments;

  let paths = [];
  let path = [];
  let head = null;
  let tail = null;

  if (true) {
    // Get the first segment.
    let firstSegment = remainingSegments.shift();
    let initialPoints = firstSegment.geometry.coordinates;
    path = path.concat(initialPoints);
    head = initialPoints[0];
    tail = initialPoints[initialPoints.length - 1];

    let lastRemainingCount = remainingSegments.length;
    while (remainingSegments.length > 0) {
      for (let segment of remainingSegments) {
        let points = segment.geometry.coordinates;
        let segmentHead = points[0];
        let segmentTail = points[points.length - 1];
        if (segmentHead[0] === tail[0] && segmentHead[1] === tail[1]) {
          path = path.concat(points.slice(1));
          tail = segmentTail;
          remainingSegments = remainingSegments.filter((s) => s !== segment);
          break;
        } else if (segmentTail[0] === head[0] && segmentTail[1] === head[1]) {
          path = points.concat(path.slice(1));
          head = segmentHead;
          remainingSegments = remainingSegments.filter((s) => s !== segment);
          break;
        } else if (segmentTail[0] == tail[0] && segmentTail[1] == tail[1]) {
          // Reverse the segment and add it to the path.
          path = path.concat(points.slice(1).reverse());
          tail = segmentHead;
          remainingSegments = remainingSegments.filter((s) => s !== segment);
        } else if (segmentHead[0] == head[0] && segmentHead[1] == head[1]) {
          // Reverse the segment and add it to the path.
          path = points.reverse().concat(path.slice(1));
          head = segmentTail;
          remainingSegments = remainingSegments.filter((s) => s !== segment);
        }
      }

      // We went through the whole thing but couldn't find a match.
      if (lastRemainingCount === remainingSegments.length) {
        paths.push(path);
        //console.log(head, tail);

        let nextSegment = remainingSegments.shift();
        let points = nextSegment.geometry.coordinates;
        path = [];
        path = path.concat(points);
        head = points[0];
        tail = points[points.length - 1];
      }
      lastRemainingCount = remainingSegments.length;
    }

    if (path && path.length) {
      paths.push(path);
    }
  } else {
    paths = segments.map((segment) => {
      return segment.geometry.coordinates;
    });
  }

  let joinedSegments = paths.map((path) => {
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: path,
      },
    };
  });
  return joinedSegments;
};
