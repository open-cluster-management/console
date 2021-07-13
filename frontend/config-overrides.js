/* Copyright Contributors to the Open Cluster Management project */

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
    webpack: function (config, env) {
        for (let _rule of config.module.rules) {
            if (_rule.oneOf) {
                _rule.oneOf.unshift({
                    test: [/\.hbs$/],
                    loader: 'raw-loader',
               })
                break
            }
        }

        config.plugins.push(
            new MonacoWebpackPlugin({
                languages: ['yaml'],
            })
        )

        // Turn off mergeLonghand css minification optimizations
        // This fixes patternfly select input not having borders in production
        for (let plugin of config.optimization.minimizer) {
            if (plugin.pluginDescriptor && plugin.pluginDescriptor.name === 'OptimizeCssAssetsWebpackPlugin') {
                plugin.options.cssProcessorPluginOptions.preset[1].mergeLonghand = false
            }
        }
        return config
    },
    // to add a transform you have to add it to the map at the top
    // because cra has a catchall fileTransform at the bottom to 
    // catch any file BEFORE it would get to yours--and because transform is
    // a map and cra iterates thru the map like an array, you need to unshift
    // using Object assign
    jest: function (config, env) {
        config.transform = Object.assign({
        "^.+\\.hbs$": "jest-raw-loader"
        }, config.transform)
        return config
    }

}
