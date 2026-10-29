// La langue de l'appareil choisit le dictionnaire : francais pour un appareil
// francophone, anglais partout ailleurs.
//
// Ce fichier garde son nom et son export par defaut : les 24 ecrans qui font
// « import languageJSON from '../common/language' » n'ont pas une ligne a
// changer. Seul le contenu a demenage dans language.fr.js.
import en from './language.en';
import fr from './language.fr';

const DICTIONNAIRES = { en, fr };
const DEFAUT = 'fr';

// expo-localization est un module natif : il manque dans Expo Go et dans les
// binaires compiles avant son ajout. On retombe alors sur le francais, c'est a
// dire exactement le comportement d'avant, plutot que de faire planter l'app au
// demarrage sur un import rate.
function langueDeLAppareil() {
    try {
        const { getLocales } = require('expo-localization');
        const locales = getLocales();
        const code = locales && locales[0] && locales[0].languageCode;
        return String(code || '').toLowerCase() === 'fr' ? 'fr' : 'en';
    } catch (error) {
        return DEFAUT;
    }
}

export const langue = langueDeLAppareil();

export default DICTIONNAIRES[langue] || DICTIONNAIRES[DEFAUT];
