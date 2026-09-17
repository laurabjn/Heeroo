// Plugin de configuration Expo : icône et couleur des notifications Firebase
// Cloud Messaging sur Android (petite icône monochrome, teintée par le système).
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFcmNotificationIcon(config, { icon, color = '#2EBD6B' } = {}) {
  config = withDangerousMod(config, ['android', async (cfg) => {
    const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
    fs.copyFileSync(path.resolve(cfg.modRequest.projectRoot, icon), path.join(res, 'drawable', 'ic_notification.png'));
    fs.mkdirSync(path.join(res, 'values'), { recursive: true });
    fs.writeFileSync(path.join(res, 'values', 'colors_notification.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="notification_icon_color">${color}</color>\n</resources>\n`);
    return cfg;
  }]);
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.firebase.messaging.default_notification_icon', '@drawable/ic_notification', 'resource');
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.firebase.messaging.default_notification_color', '@color/notification_icon_color', 'resource');
    return cfg;
  });
  return config;
};
