
const path = require('path');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const project = require('./webpack.embed.js')

module.exports = merge.merge(
  project.webpackConfig('./src', './src/index.hbs', 'index.html'),
  {
  mode: 'development',  
  entry: { 
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js',
    publicPath: '/'
  },

  devServer: {
    contentBase: './public'
  },

  plugins: [
    new CleanWebpackPlugin(),
   
    new MiniCssExtractPlugin({
      filename: '[name].css'
    })
  ],
  
  module: {
    rules:[
      {
        test:  /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.hbs$/,
        loader: 'handlebars-loader',
      },
      {
        test: /\.[s]?css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader'},
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sassOptions: {
                includePaths: [
                  'node_modules/liquidx-base',
                  path.resolve(__dirname, 'src')
                ]
              }
            }
          }
        ]
      }
    ]
  }
});