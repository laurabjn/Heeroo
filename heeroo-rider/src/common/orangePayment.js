// Règlement d'une course par Orange Money.
//
// Même déroulé que Wave, et pour la même raison : au Sénégal, le portefeuille
// mobile est le moyen courant. Orange Money y est l'autre grand réseau, et le
// passager qui n'a pas de compte Wave en a souvent un chez Orange. Les deux
// cohabitent donc, là où Wave et la carte s'excluent.
//
// Deux différences avec Wave, qui expliquent ce que fait ce module.
//
// 1. Orange Money ne s'ouvre qu'avec un compte marchand Sonatel, qui n'existe
//    pas encore. D'où `credit_settings/orangeEnabled` : le bouton reste
//    invisible tant que l'exploitant ne l'a pas posé à `true`. Le pays ne
//    suffit pas, contrairement à Wave — afficher le bouton sans le compte
//    donnerait un échec que le passager ne saurait pas lire.
//
// 2. La notification d'Orange est réputée peu fiable, et le serveur ne la croit
//    pas : il interroge Orange. La vérification au retour dans l'application
//    n'est donc pas un filet ici, c'est le chemin normal, et il faut l'appeler
//    à chaque fois que l'application revient au premier plan.
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { Linking } from 'react-native';
import { appelServeur } from './appelServeur';
import languageJSON from './language';

// Les pays où Orange Money opère et où la société aura un compte marchand.
// La liste ne suffit pas : voir `orangeEnabled` ci-dessous.
const PAYS_ORANGE = ['SN'];

/**
 * Orange Money est-il proposable pour une course partant de ce pays ?
 *
 * @param {string} country  code ISO du pays de départ
 * @param {boolean} actif   valeur de credit_settings/orangeEnabled
 */
export function isOrangeAvailable(country, actif) {
    if (actif !== true) return false;
    return PAYS_ORANGE.includes(String(country || '').trim().toUpperCase());
}

/**
 * Suit `credit_settings/orangeEnabled` et rend la fonction de désabonnement.
 *
 * Sous `credit_settings` et non sous `settings` : ce dernier est un tableau de
 * pays, et y ajouter une clé nommée le convertirait en objet, ce qui casse les
 * parcours de liste dans les écrans.
 */
export function watchOrangeEnabled(onChange) {
    const ref = firebase.database().ref('credit_settings/orangeEnabled');
    const handler = (snapshot) => onChange(snapshot.val() === true);
    ref.on('value', handler);
    return () => ref.off('value', handler);
}

/**
 * Ouvre la page de paiement Orange Money pour une course terminée.
 *
 * Rend l'identifiant de session, à conserver : c'est lui qu'il faudra
 * présenter au retour dans l'application pour savoir si le paiement a abouti.
 * Le montant n'est pas un paramètre — il est lu en base par le serveur, qui
 * seul fait foi sur le prix de la course.
 */
export async function payForRideWithOrange(bookingId) {
    const data = await appelServeur('createOrangeRidePayment', { bookingId }, languageJSON.orange_responded);
    if (!data.launchUrl) throw new Error(languageJSON.orange_no_checkout);
    await Linking.openURL(data.launchUrl);
    return { sessionId: data.sessionId, amount: data.amount, currency: data.currency };
}

/**
 * Demande où en est un paiement Orange. Rend 'completed', 'pending' ou 'failed'.
 *
 * À appeler au retour dans l'application. Un 'pending' n'est pas un échec :
 * c'est le cas le plus courant des premières secondes, Orange n'ayant pas
 * encore arrêté la transaction de son côté.
 */
export async function confirmOrangeRide(sessionId) {
    const data = await appelServeur('confirmOrangeRidePayment', { sessionId }, languageJSON.orange_responded);
    return data.status;
}
