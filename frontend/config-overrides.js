/* Copyright Contributors to the Open Cluster Management project */

const { override, addExternalBabelPlugins, removeModuleScopePlugin, addWebpackModuleRule, addWebpackPlugin } = require('customize-cra')

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const path = require('path')

module.exports = override(
    addWebpackModuleRule({
      test: [/\.hbs$/],
      loader: 'handlebars-loader',
      query: {
        precompileOptions: {
          knownHelpersOnly: false
        }
      }
    }),

   addWebpackPlugin(new MonacoWebpackPlugin({
     languages: ['yaml']
   })),
  
  // TO INCLUDE TEMPTIFLY SRC DIRECTLY
  removeModuleScopePlugin(),
  ...addExternalBabelPlugins(
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-class-properties',
    '@babel/plugin-transform-react-jsx',
  ),
  
);
