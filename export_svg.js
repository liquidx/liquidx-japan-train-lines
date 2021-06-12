const fs = require('fs');
const process = require('process');
const commander = require('commander');

const train_lines = require('./train_lines');
const train_line_svg = require('./train_line_svg');




let main = () => {
  const program = new commander.Command();

  program
    .version('1.0')
    .option('--show-lines', 'Output all lines')
    .option('-l, --line <line_name>', 'Line', '東横線')
    .option('-o, --output <output>', 'Output');

  program.parse(process.argv);

  fs.readFile('data-raw/N02-19_GML/N02-19_RailroadSection.geojson', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    const geojson = JSON.parse(data)
    if (!geojson) {
      console.error('Unable to parse');
      return;
    }

    if (program.showLines) {
      console.log(train_lines(geojson));
      return;
    }

    const svg_path = train_line_svg(geojson, program.line);
    fs.writeFileSync(program.output, svg_path);
  });
};

main();
