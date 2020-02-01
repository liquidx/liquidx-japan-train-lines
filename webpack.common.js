
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',  
  entry: { 
    index: './src/index.js'
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
    new HtmlWebpackPlugin({
      title: 'Japan Train',
      filename: 'index.html',
      template: 'src/index.html',
      chunks: ['index']
    }),
    new CopyPlugin([
      { from: 'data', to: 'data' },
      { from: 'config', to: 'config' },
    ]),
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
          test: /\.scss$/,
          use: [
            'style-loader',
            'css-loader', 
            'sass-loader'
          ]
      }
    ]
  }
};