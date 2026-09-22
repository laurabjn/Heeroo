// Greffon de configuration Expo : désactive Swift Package Manager pour
// react-native-firebase sur iOS.
//
// Expo demande une liaison statique des frameworks pour react-native-firebase
// (expo-build-properties : useFrameworks "static"). Or, depuis que
// react-native-firebase résout Firebase via Swift Package Manager, cette
// combinaison est refusée : chaque module embarquerait sa propre copie du SDK.
// La bibliothèque fournit un interrupteur pour revenir à CocoaPods ; il doit
// être déclaré dans le Podfile avant tout bloc « target ».
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FLAG = '$RNFirebaseDisableSPM = true';

module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, ['ios', (cfg) => {
    const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
    let contents = fs.readFileSync(podfile, 'utf8');
    if (!contents.includes(FLAG)) {
      const anchor = contents.indexOf('target ');
      const insertion = `${FLAG}\n\n`;
      contents = anchor === -1 ? insertion + contents : contents.slice(0, anchor) + insertion + contents.slice(anchor);
      fs.writeFileSync(podfile, contents);
    }
    return cfg;
  }]);
};
