const { parse, stringify } = require('svgson')
const fs = require('fs');

let combiner = (svg) => {
  svg.then(json => { 
    // traverse until we get paths and polylines.
    var n = json;
    while (n.children) {
      // check if children are paths or polylines.
      if (n.children[0].name == 'path' || n.children[0].name == 'polyline') {
        break;
      }
      n = n.children[0];
    }

    // find the start and end of <path> 
    // assumptions: paths are simply straight lines.
    var path_start_regex = new RegExp('^M([0-9\.]+),([0-9\.]+)');
    var path_end_regex = new RegExp('([0-9\.]+),([0-9\.]+)$');

    var paths = [];
    console.log(`segments: ${n.children.length}`);
    for (var i = 0; i < n.children.length; i++) {
      var child = n.children[i];
      if (child.name == 'path') {
        var path = child.attributes.d;
        var start = path_start_regex.exec(path);
        var end = path_end_regex.exec(path);
        if (!start || !end) {
          console.log(`Could not parse segment: ${child}`);
        }
        if (start && end) {
          paths.push({
            name: 'path',
            id: child.attributes.id,
            path: path,
            points: [{x: start[1], y: start[2]}, {x:end[1], y:end[2]}],
            start: {x: start[1], y:start[2]},
            end: {x: end[1], y: end[2]}
          })
        }
      } else if (child.name == 'polyline') {
        var polyline = child.attributes.points;
        var poly_points = polyline.split(' ');
        var points = [];
        for (var j = 0; j < poly_points.length / 2; j++) {
          points.push({x: poly_points[j*2], y: poly_points[j*2 + 1]});
        }
        paths.push({
          name: 'polyline',
          id: child.attributes.id,
          polyline: polyline,
          points: points,
          start: points[0],
          end: points[points.length - 1]
        });
      }
    }

    // match each path with other paths.
    let point_equal = (a, b) => {
      return a.x == b.x && a.y == b.y;
    };

    // find all the connection points.
    for (var i = 0; i < paths.length; i++) {
      var current_path = paths[i];
      current_path.start_joins = [];
      current_path.end_joins = [];
      for (var j = 0; j < paths.length; j++) {
        if (i == j) { continue; }
        var matching_path = paths[j];
        if (point_equal(current_path.start, matching_path.start)) {
          current_path.start_joins.push(matching_path);
        } else if (point_equal(current_path.end, matching_path.end)) {
          current_path.end_joins.push(matching_path);
        } else if (point_equal(current_path.start, matching_path.end)) {
          current_path.start_joins.push(matching_path);
        } else if (point_equal(current_path.end, matching_path.start)) {
          current_path.end_joins.push(matching_path);
        }
      }
    }

    console.log('Before :::');
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var starts = p.start_joins.map(x => x.id);
      var ends = p.end_joins.map(x => x.id);
      console.log(`path: ${p.id} starts: ${starts} ends: ${ends} `);
    }
    console.log('After :::');


    // start and join all paths until they fork.
    var start_terminals = [];
    var end_terminals = [];
    var joined_paths = [];

    let join_path = (n, prev_point) => {
      var next = null;
      var points_at_this_node = n.points;
      var last_point_at_this_node = null;

      var is_fork = false;

      // just mark this as crawled.
      n.crawled = true;
      console.log(n.id);

      if (prev_point == null) {
        if (n.start_joins.length == 0 && n.end_joins.length > 0) {
          next = n.end_joins[0];
          points_at_this_node = n.points;
          if (n.end_joins.length > 1) {
            is_fork = 'end';
          }
        } else if (n.end_joins.length == 0 && n.start_joins.length > 0) {
          next = n.start_joins[0];
          points_at_this_node = n.points.reverse();
          if (n.start_joins.length > 1) {
            is_fork = 'start';
          }
        }
      } else if (point_equal(prev_point, n.points[0])) {
        // first point is connected to the previous point.
        next = n.end_joins[0];
        points_at_this_node = n.points;
        if (n.end_joins.length > 1) {
          is_fork = 'end';
        }
      } else if (point_equal(prev_point, n.points[n.points.length - 1])) {
        next = n.start_joins[0];
        points_at_this_node = n.points.reverse();
        if (n.start_joins.length > 1) {
          is_fork = 'start';
        }
      } else {
        console.log('cannot connect');
      }

      if (is_fork) {
        // remove connection to forks and treat them as terminals.
        if (is_fork == 'end') {
          for (var i = 0; i < n.end_joins.length; i++) {
            var next = n.end_joins[i];
            var at_start = next.start_joins.indexOf(n);
            if (at_start != -1) { next.start_joins = next.start_joins.splice(at_start, 1); }
            var at_end = next.end_joins.indexOf(n);
            if (at_end != -1) { next.end_joins = next.end_joins.splice(at_end, 1); }
          }
          n.end_joins = [];
        } else {
          for (var i = 0; i < n.start_joins.length; i++) {
            var next = n.start_joins[i];
            var at_start = next.start_joins.indexOf(n);
            if (at_start != -1) { next.start_joins = next.start_joins.splice(at_start, 1); }
            var at_end = next.end_joins.indexOf(n);
            if (at_end != -1) { next.end_joins = next.end_joins.splice(at_end, 1); }          }
          n.start_joins = [];
        }
        console.log('--> forked at ' + is_fork + ' ' + n.id);
        console.log(points_at_this_node);
        return {chain: [n.id], points: points_at_this_node};
      }

      if (!next) {
        console.log('no next ' + n.id);
        console.log(points_at_this_node);
        return {chain: [n.id], points: points_at_this_node}; // reached the end.
      }

      last_point_at_this_node = points_at_this_node[points_at_this_node.length - 1];
      var results = join_path(next, last_point_at_this_node);
      return {chain: results.chain.concat(n.id), points: points_at_this_node.concat(results.points)};
    };

    
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (p.crawled) { continue; }
      if (p.start_joins.length == 0 || p.end_joins.length == 0) {
        console.log('start --> ' + p.id);
        var results = join_path(p, null);
        console.log('-> chain: ' + results.chain);
        p.combined = true;
        p.points = results.points;
      }    
    }

    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (p.combined) {
        var starts = p.start_joins.map(x => x.id);
        var ends = p.end_joins.map(x => x.id);
        console.log(`path: ${p.id} starts: ${starts} ends: ${ends} `);
      }
    }

    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (p.combined) {
        var path = `M${p.points[0].x},${p.points[0].y}`;
        for (var j = 0; j < p.points.length; j++) {
          path = path + ` L${p.points[j].x},${p.points[j].y}`;
        }
        console.log(`<path d="${path}" id="path-${i}"></path>`);
      }
    }


    // var lines = [];
    // let find_line = (prev, n) => {
    //   var points = n.points;
    //   for (var path of n.end_joins) {

    //   }
    // };

    // for (var i = 0; i < start_terminals.length; i++) {
    //   var line = [];
    //   var p = start_terminals[i];
    //   while (true) {
    //     var next = p.ends;
    //     if 
    //   }
    // }



    // for (var i = 0; i < paths.length; i++) {
    //   var l = paths[i];
    //   var found_next = false;
    //   for (var j = 0; j < paths.length; j++) {
    //     if (i == j) { continue; }
    //     var other_l = paths[j];
    //     if (l.end.x == other_l.start.x && l.end.y == other_l.start.y) {
    //       console.log(`${i} (${paths[i].id}) connects to ${j} (${paths[j].id})`);
    //       connections.push([i, j]);
    //       found_next = true;
    //     }
    //     // todo: the paths are bidirectional, so i need to check also
    //     // that the starts match the starts and ends match the ends.
    //     // - maybe this algorithm needs to be modified so that it greedily
    //     // - matches and combines until it can't combine any more together.
    //   }
    //   if (!found_next) {
    //     ends.push(i);
    //   }
    // }

    // // find all the ends.
    // for (var i = 0; i < connections.length; i++) {
    //   var is_start = true;
    //   for (var j = 0; j < connections.length; j++) {
    //     if (connections[j][1] == connections[i][0]) {
    //       is_start = false;
    //       break;
    //     }
    //   }
    //   if (is_start) {
    //     starts.push(connections[i][0]);
    //   }
    // }

    // if (end.length == 0) {
    //   // circle??
    //   console.error('loop');
    //   return;
    // }

    // var lines = [];
    // for (var i = 0; i < starts.length; i++) {
    //   var line = [];
    //   var next = starts[i];
    //   var current_path = paths[next];
    //   while (current_path) {
    //     line = line.concat(current_path.points);
    //     current_path = null;
    //     for (var j = 0; j < connections.length; j++) {
    //       if (connections[j][0] == next) {
    //         next = connections[j][1];
    //         current_path = paths[next];
    //         break;
    //       }
    //     }
    //   }
    //   lines.push(line);
    // }

    //console.log(paths);
    //console.log(n.children);
  });
};

fs.readFile('tokyu_toyoko.svg', {encoding: 'utf-8'}, (err, data) => {
  let svg = parse(data);
  combiner(svg);
});