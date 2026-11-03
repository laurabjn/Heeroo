// Règlement d'une course par Wave.
//
// Au Sénégal, Wave est le moyen de paiement courant : la carte y est rare, et
// l'espèce oblige le chauffeur à rendre la monnaie. Le passager choisit Wave à
// la réservation et paie à la fin de la course.
//
// Wave ne connaît pas l'empreinte bancaire : rien ne peut être bloqué à la
// commande, et le montant n'est de toute façon connu qu'une fois la course
// terminée. Le déroulé est donc celui des espèces ; c'est l'argent qui suit le
// chemin de la carte, encaissé par la société puis porté au crédit du chauffeur.
//
// Le paiement lui-même se fait dans l'application Wave, où le passager est
// redirigé. L'application Heeroo ne voit jamais ses identifiants, et c'est le
// webhook Wave qui marque la course payée — la vérification au retour ne sert
// qu'à ne pas faire attendre le passager devant un écran qui ne bouge pas.
import { Linking } from 'react-native';
import { appelServeur } from './appelServeur';
import languageJSON from './language';

// Les pays où Wave opère et où la société a un compte marchand. Y ajouter un
// pays sans ce compte afficherait un bouton qui échoue à l'ouverture.
const PAYS_WAVE = ['SN'];

/** Wave est-il proposable pour une course partant de ce pays ? */
export function isWaveAvailable(country) {
    return PAYS_WAVE.includes(String(country || '').trim().toUpperCase());
}

/**
 * Ouvre la page de paiement Wave pour une course terminée.
 *
 * Rend l'identifiant de session, à conserver : c'est lui qu'il faudra
 * présenter au retour dans l'application pour savoir si le paiement a abouti.
 * Le montant n'est pas un paramètre — il est lu en base par le serveur, qui
 * seul fait foi sur le prix de la course.
 */
export async function payForRideWithWave(bookingId) {
    const data = await appelServeur('createWaveRidePayment', { bookingId }, languageJSON.wave_responded);
    if (!data.launchUrl) throw new Error(languageJSON.wave_no_checkout);
    await Linking.openURL(data.launchUrl);
    return { sessionId: data.sessionId, amount: data.amount, currency: data.currency };
}

/**
 * Demande où en est un paiement Wave. Rend 'completed', 'pending' ou 'failed'.
 *
 * À appeler au retour dans l'application. Un 'pending' n'est pas un échec :
 * Wave a pu accepter le paiement sans que son appel au serveur soit arrivé.
 */
export async function confirmWaveRide(sessionId) {
    const data = await appelServeur('confirmWaveRidePayment', { sessionId }, languageJSON.wave_responded);
    return data.status;
}
