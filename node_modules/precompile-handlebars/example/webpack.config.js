// This file is only meant to demonstrate the plugin behavior

const webpack = require('webpack');
var HandlebarsPlugin = require("../index");

module.exports = {
    context: __dirname,
    entry: {main: ["./demo.js"]},
    output: {
        path: __dirname + "/dist",
        filename: "bundle.js"
    },
    plugins: [
        new HandlebarsPlugin([
            {
                inputDir: "templates",
                outputFile: "output/compiled-templates.js"
            }
        ])
    ]
};