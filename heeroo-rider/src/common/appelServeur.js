// Appel d'une fonction serveur au nom du passager connecté.
//
// Extrait de wavePayment.js, qui en portait la seule copie, parce qu'Orange
// Money en avait besoin mot pour mot. Deux copies d'un appel authentifié dans
// du code d'argent finissent par diverger : l'une gagne un contrôle que l'autre
// n'a pas, et c'est celle qui ne l'a pas qu'on appelle.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { base_url } from './key';
import languageJSON from './language';

/**
 * Appelle une fonction serveur en POST, jeton d'identité en en-tête.
 *
 * @param {string} nom        nom de la fonction (createWaveRidePayment, …)
 * @param {object} corps      corps JSON de la requête
 * @param {string} [gabarit]  message d'erreur portant « {status} », employé
 *                            quand le serveur répond sans message à lui. Le
 *                            prestataire y est nommé : « Wave a répondu 502 »
 *                            dit au passager à qui s'en prendre, là où une
 *                            erreur anonyme laisserait croire à une panne de
 *                            Heeroo.
 */
export async function appelServeur(nom, corps, gabarit) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error(languageJSON.session_expired);
    const idToken = await user.getIdToken();
    const response = await fetch(base_url + nom, {
        method: 'post',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify(corps || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const repli = gabarit
            ? gabarit.replace('{status}', response.status)
            : String(response.status);
        throw new Error(data.error || repli);
    }
    return data;
}
