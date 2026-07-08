const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { bundleModeMetroConfig } = require('react-native-worklets/bundleMode');

const defaultConfig = getDefaultConfig(__dirname);
const threePackagePath = path.resolve(__dirname, 'node_modules/three');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('three/addons/')) {
        return {
          filePath: path.resolve(
            threePackagePath,
            'examples/jsm/' + moduleName.replace('three/addons/', '') + '.js',
          ),
          type: 'sourceFile',
        };
      }
      if (moduleName === 'three' || moduleName === 'three/webgpu') {
        return {
          filePath: path.resolve(threePackagePath, 'build/three.webgpu.js'),
          type: 'sourceFile',
        };
      }
      if (moduleName === 'three/tsl') {
        return {
          filePath: path.resolve(threePackagePath, 'build/three.tsl.js'),
          type: 'sourceFile',
        };
      }
      return bundleModeMetroConfig.resolver.resolveRequest(
        context,
        moduleName,
        platform,
      );
    },
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'glb',
      'gltf',
      'bin',
      'hdr',
    ],
  },
};

module.exports = mergeConfig(defaultConfig, bundleModeMetroConfig, config);
