
  cordova.define('cordova/plugin_list', function(require, exports, module) {
    module.exports = [
      {
          "id": "cordova-plugin-wifi.WifiAdmin",
          "file": "plugins/cordova-plugin-wifi/www/WifiAdmin.js",
          "pluginId": "cordova-plugin-wifi",
        "clobbers": [
          "window.plugins.WifiAdmin"
        ]
        }
    ];
    module.exports.metadata =
    // TOP OF METADATA
    {
      "cordova-plugin-wifi": "0.5.0"
    };
    // BOTTOM OF METADATA
    });
    