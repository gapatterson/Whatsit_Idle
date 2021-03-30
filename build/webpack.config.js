const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const autoprefixer = require('autoprefixer');
const Handlebars = require('handlebars');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

module.exports = {
    entry: {
        bundle: './src/index.js'
    } ,
    output: {
        path: path.resolve(__dirname, '../dist')
    },
    devtool: "source-map",
    devServer: {
      port: 3000,
      open: true,
      contentBase: path.join(__dirname, '../src'),
    },

    module: {
        rules: [
            {
              test: /\.(handlebars|hbs|html)$/,
              loader: "handlebars-loader"
            },
            {
              test: /\.(jpg|png|gif)$/,
              use: [
                'file-loader',
              ]
            },
            {
              test: /\.(scss|css)$/,
              use: [
                MiniCssExtractPlugin.loader,
                {
                  loader: "css-loader",
                  options: {
                    sourceMap: true
                  }
                },
                {
                  loader: 'postcss-loader',
                  options: {
                    sourceMap: true,
                    postcssOptions: {
                      plugins: function() {
                        return [
                          require('precss'),
                          require('autoprefixer')
                        ];
                      }
                    }
                  }
                },
                {
                  loader: "sass-loader",
                  options: {}
                }
              ]
            }
        ]
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
          options: {
            handlebarsLoader: {}
          }
        }),
        new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery'
        }),
        new MiniCssExtractPlugin({
          filename: "[name]-styles.css",
          chunkFilename: "[id].css"
        }),
        new HtmlWebpackPlugin({
            title: 'Whatsit, again.',
            template: './src/index.html'
        }),
        new FaviconsWebpackPlugin('./src/img/log.png')
      ]
  };
