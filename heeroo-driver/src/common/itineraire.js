// L'ouverture d'un itinéraire dans l'application de navigation du chauffeur.
//
// Pourquoi ce fichier existe. Les deux écrans de course ouvraient Waze, et
// rien d'autre, par une adresse écrite en dur dans chacun d'eux :
//
//     Linking.openURL('https://waze.com/ul?ll=…&navigate=yes')
//
// Sur un téléphone où Waze n'est pas installé — c'est-à-dire la quasi-totalité
// des iPhone — cette adresse n'ouvre pas un GPS : elle ouvre la page web de
// Waze dans le navigateur. Le choix entre plusieurs applications existait dans
// le code d'origine, mais il était commenté et la bibliothèque qu'il employait
// n'a jamais été installée. Le client l'a signalé le 11 nov. 2026.
//
// Deux stratégies, parce que les deux systèmes ne se ressemblent pas :
//
//   Android sait déjà le faire. L'adresse « geo: » est une intention que
//   TOUTES les applications de navigation déclarent savoir traiter : le
//   système affiche lui-même sa liste — Maps, Waze, celle du constructeur — et
//   retient le choix si le chauffeur le demande. On ne réécrit pas ce
//   sélecteur, et surtout on n'a pas à deviner ce qui est installé.
//
//   iOS n'a pas de sélecteur. On construit donc le nôtre, en ne proposant que
//   les applications réellement présentes, ce que canOpenURL sait dire — à
//   condition que leurs schémas soient déclarés dans LSApplicationQueriesSchemes
//   (voir app.json). Sans cette déclaration, canOpenURL répond toujours faux
//   et le dialogue serait vide. Les schémas d'Apple, dont « maps », n'ont pas
//   à y figurer : le système les autorise d'office.
//
// Dans tous les cas il reste une issue : le plan web de Google, qui s'ouvre
// dans le navigateur. Un chauffeur attendu par un client ne doit jamais rester
// devant un bouton qui ne fait rien.
import { Alert, Linking, Platform } from 'react-native';
import languageJSON from './language';

// Une coordonnée absente arrive presque toujours sous la forme 0,0 — le point
// nul, au large du golfe de Guinée. Y envoyer un chauffeur est pire que de lui
// dire que l'adresse manque.
export function coordonneesValides(destination) {
    if (!destination) { return false; }
    const lat = Number(destination.lat);
    const lng = Number(destination.lng);
    if (!isFinite(lat) || !isFinite(lng)) { return false; }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { return false; }
    if (lat === 0 && lng === 0) { return false; }
    return true;
}

export function adresses(lat, lng) {
    const point = lat + ',' + lng;
    return {
        // Android : laisse le système poser la question.
        choixAndroid: 'geo:' + point + '?q=' + point,
        plans: 'maps://?daddr=' + point + '&dirflg=d',
        google: 'comgooglemaps://?daddr=' + point + '&directionsmode=driving',
        waze: 'waze://?ll=' + point + '&navigate=yes',
        // Le dernier recours, qui marche partout où il y a un navigateur.
        web: 'https://www.google.com/maps/dir/?api=1&destination=' + point + '&travelmode=driving',
    };
}

export function ouvrirItineraire(destination) {
    if (!coordonneesValides(destination)) {
        Alert.alert('', languageJSON.itineraire_sans_adresse);
        return Promise.resolve(false);
    }

    const lat = Number(destination.lat);
    const lng = Number(destination.lng);
    const url = adresses(lat, lng);

    const versLeWeb = () => Linking.openURL(url.web).then(() => true).catch(() => {
        Alert.alert('', languageJSON.itineraire_echec);
        return false;
    });

    if (Platform.OS === 'android') {
        return Linking.openURL(url.choixAndroid).then(() => true).catch(versLeWeb);
    }

    const candidats = [
        { libelle: languageJSON.itineraire_plans, url: url.plans },
        { libelle: languageJSON.itineraire_google, url: url.google },
        { libelle: languageJSON.itineraire_waze, url: url.waze },
    ];

    // canOpenURL peut rejeter, notamment si le schéma n'est pas déclaré : on
    // traite ce cas comme « application absente » plutôt que comme une panne.
    return Promise.all(candidats.map(c =>
        Promise.resolve()
            .then(() => Linking.canOpenURL(c.url))
            .then(present => (present ? c : null))
            .catch(() => null)
    )).then(resultats => {
        const presents = resultats.filter(c => c);

        if (presents.length === 0) { return versLeWeb(); }

        // Une seule application installée : lui poser la question n'apporte
        // rien, et le chauffeur est au volant.
        if (presents.length === 1) {
            return Linking.openURL(presents[0].url).then(() => true).catch(versLeWeb);
        }

        const choix = presents.map(c => ({
            text: c.libelle,
            onPress: () => { Linking.openURL(c.url).catch(versLeWeb); },
        }));
        choix.push({ text: languageJSON.directionscancelText, style: 'cancel' });
        Alert.alert(languageJSON.directionsdialogTitle, languageJSON.directionsdialogMessage, choix);
        return true;
    });
}
