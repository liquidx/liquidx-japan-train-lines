const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
  ]

  return {
    entry,
    plugins
  }
}

module.exports = {
  webpackConfig
}