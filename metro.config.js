const path = require('path');
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Force Metro to resolve this package from the app root. This avoids occasional
// nested-resolution issues (e.g., swr -> use-sync-external-store) that can
// result in ENOENT for shim/index.native.js.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'use-sync-external-store': path.resolve(__dirname, 'node_modules/use-sync-external-store'),
};

module.exports = withRorkMetro(config);
