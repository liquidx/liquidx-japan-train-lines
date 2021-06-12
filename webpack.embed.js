const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const webpackConfig = (srcPath, templatePath, htmlOutputPath) => {
  const chunkName = 'japan-train-lines'

  const entry = {}
  entry[chunkName] = {
    import: [
      path.resolve(srcPath, `${chunkName}.js`),
      path.resolve(srcPath, `${chunkName}.scss`),
    ],
  }

  const plugins = [
    new HtmlWebpackPlugin({
      filename: htmlOutputPath || 'index.html',
      template: templatePath || path.join(srcPath, 'index.hbs'),
      chunks: [chunkName]
    }),
    new CopyPlugin({
      patterns: [
        { from: path.join(__dirname, 'config', 'train-line-corrections.json'), to: './data/train-line-corrections.json' },
      ],
    })
  ]

  const trainlineData = path.join(__dirname, 'data', 'N02-19_GML', 'N02-19_RailroadSection.geojson')
  if (fs.existsSync(trainlineData)) {
    plugins.push(new CopyPlugin({
      patterns: [
        { from: trainlineData, to: './data/N02-19_RailroadSection.geojson' },
      ]
    }))
  }

  return {
    entry,
    plugins
  }
}

module.exports = {
  webpackConfig
}