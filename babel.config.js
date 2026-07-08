/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  bundleMode: true,
  strictGlobal: true,
  importForwarding: {
    moduleNames: ['axios', 'three', 'three/tsl', '@apollo/client', 'remend'],
  },
};

/** @type {import('@babel/core').TransformOptions} */
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    '@babel/plugin-transform-class-static-block',
    ['react-native-worklets/plugin', workletsPluginOptions],
  ],
};
