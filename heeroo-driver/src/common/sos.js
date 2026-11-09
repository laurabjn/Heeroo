// La mécanique de l'appel d'urgence, séparée du bouton qui la déclenche.
//
// Elle est partagée parce qu'il y a maintenant plusieurs façons d'appeler à
// l'aide — l'entrée du menu latéral, le bouton de l'écran d'accueil, ceux des
// écrans de course — et qu'il n'y a qu'une seule bonne façon de le faire.
// Trois copies du même dialogue, c'est trois occasions de diverger.
//
// Règle qui gouverne tout ce fichier : RIEN ne doit pouvoir empêcher l'appel.
// Pas une erreur réseau, pas une session expirée, pas un pays manquant. Les
// deux fonctions ci-dessous ne rejettent jamais et ne lèvent jamais ; au pire
// elles aboutissent au 112.
import { Alert, Linking } from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import languageJSON from './language';
import { numeroUrgence, numeroHeeroo, numeroAppelable, sosActif } from './urgences';

// À appeler au MONTAGE de l'écran, jamais à l'appui : au moment d'appuyer, il
// n'y a plus de temps pour attendre le réseau. La promesse n'est jamais
// rejetée — en cas d'échec elle rend { pays: null, operateur: null,
// actif: true }, ce que ouvrirSOS() sait traiter.
export function chargerSOS() {
    return new Promise(resolve => {
        const fini = (pays, operateur, actif) => resolve({
            pays: pays || null,
            operateur: operateur || null,
            // Indéterminé vaut ACTIF. Tous les chemins d'échec ci-dessous
            // passent ici sans troisième argument : session absente, réseau
            // coupé, firebase qui lève. Dans tous ces cas le bouton reste.
            actif: actif !== false,
        });
        try {
            const utilisateur = firebase.auth().currentUser;
            if (!utilisateur) { fini(null, null); return; }
            firebase.database().ref('users/' + utilisateur.uid + '/country').once('value')
                .then(instantane => {
                    const pays = instantane.val();
                    if (!pays) { fini(null, null); return; }
                    firebase.database().ref('settings/').once('value')
                        .then(reglages => {
                            const r = reglages.val();
                            fini(pays, numeroHeeroo(r, pays), sosActif(r, pays));
                        })
                        .catch(() => fini(pays, null));
                })
                .catch(() => fini(null, null));
        } catch (e) {
            fini(null, null);
        }
    });
}

function appeler(numero) {
    const propre = numeroAppelable(numero);
    if (!propre) { return; }
    // Le numéro est répété dans le message d'échec : si le composeur refuse de
    // s'ouvrir, il reste lisible à l'écran et compostable à la main.
    Linking.openURL('tel:' + propre).catch(() => {
        Alert.alert('', languageJSON.panic_echec + ' ' + propre);
    });
}

// `etat` est ce que chargerSOS() a rendu, ou null s'il n'a pas eu le temps
// d'aboutir. Dans ce cas on perd le choix « Heeroo », jamais les secours.
export function ouvrirSOS(etat) {
    const pays = etat && etat.pays ? etat.pays : null;
    const operateur = etat && etat.operateur ? etat.operateur : null;
    const secours = numeroUrgence(pays);

    // L'ordre n'est pas esthétique. Sur Android, React Native suit la
    // convention du système : avec trois boutons, le premier est le « neutre »
    // (à gauche) et le dernier le « positif » (à droite, mis en avant). Les
    // secours sont donc EN DERNIER dans ce tableau pour être le bouton le plus
    // visible. Sur iOS, « cancel » est de toute façon renvoyé en bas.
    const choix = [
        { text: languageJSON.cancel, style: 'cancel' },
    ];
    if (operateur) {
        choix.push({
            text: languageJSON.panic_operateur,
            onPress: () => appeler(operateur),
        });
    }
    choix.push({
        text: languageJSON.panic_secours + ' (' + secours + ')',
        style: 'destructive',
        onPress: () => appeler(secours),
    });

    Alert.alert(languageJSON.panic_text, languageJSON.panic_question, choix);
}
