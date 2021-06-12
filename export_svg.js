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
  const options = program.opts();

  if (!options.line) {
    return;
  }

  fs.readFile('data/N02-19_GML/N02-19_RailroadSection.geojson', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    const geojson = JSON.parse(data)
    if (!geojson) {
      console.error('Unable to parse');
      return;
    }

    if (options.showLines) {
      console.log(train_lines(geojson));
      return;
    }

    const companies = train_lines(geojson);
    let companyForLine = ''
    for (let company of Object.keys(companies)) {
      const companyLines = companies[company];
      if (Object.keys(companyLines).includes(options.line)) {
        console.log('Found line', options.line, 'in ', company);
        companyForLine = company;
        break;
      }
    }

    if (!companyForLine) {
      console.log('Unable to find company for line', options.line)
      return;
    }

    const svg_path = train_line_svg(geojson, companyForLine, options.line);
    fs.writeFileSync(options.output, svg_path)
    console.log('Output', options.output)
  });
};

main();
