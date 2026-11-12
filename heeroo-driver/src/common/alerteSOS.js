// Le signalement à Heeroo d'un appel d'urgence passé par un chauffeur.
//
// Demandé par le client le 11 nov. 2026 : quand un chauffeur appuie sur le
// bouton SOS et appelle, Heeroo doit en être averti par courriel, avec de
// quoi comprendre et agir.
//
// RÈGLE ABSOLUE, héritée de common/sos.js : le signalement ne doit JAMAIS
// retarder ni empêcher l'appel. Il part donc APRÈS l'ouverture du composeur,
// il n'est jamais attendu, et il n'échoue jamais bruyamment. Un chauffeur
// agressé ne doit pas voir une erreur de réseau pendant qu'il compose le 112.
//
// Pourquoi une écriture en base plutôt qu'un appel direct à une fonction :
// le SDK Firebase met les écritures EN FILE quand le réseau manque et les
// rejoue tout seul au retour. Une agression se produit rarement là où la
// couverture est bonne ; un appel HTTPS raté, lui, serait perdu pour de bon.
//
// On écrit ici le strict minimum, et rien que ce que l'app est seule à
// savoir : qui, quel numéro, quelle course, depuis quel téléphone. Tout ce
// que le serveur peut retrouver tout seul — le nom, le téléphone, la
// position, le passager — est laissé au serveur, qui lit la base avec les
// droits d'administration. Moins l'app a de travail à faire à cet instant,
// plus l'alerte a de chances de partir.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

// La version de l'application, pour savoir sur quel binaire le chauffeur
// était au moment de l'appel. Lue sans jamais lever : un signalement ne
// tombe pas parce qu'un champ de configuration manque.
export function versionApplication() {
    try {
        const c = Constants || {};
        const e = c.expoConfig || c.manifest || {};
        return e.version ? String(e.version) : null;
    } catch (erreur) {
        return null;
    }
}

// L'identifiant de la course en cours, s'il y en a une. Les écrans passent
// l'objet de course tel qu'ils l'ont ; on n'en retient que la clé, et on
// accepte aussi bien l'objet que l'identifiant déjà extrait.
export function identifiantCourse(course) {
    if (!course) { return null; }
    if (typeof course === 'string') { return course || null; }
    if (typeof course === 'object' && course.bookingId) { return String(course.bookingId); }
    return null;
}

// Ce qui part en base. Fonction pure, donc vérifiable : c'est elle qui
// décide de la forme exacte de l'alerte, et les règles de sécurité valident
// cette forme-là.
export function contenuAlerte(details) {
    const d = details || {};
    return {
        driver: d.uid,
        // « secours » ou « heeroo » : le courriel ne dit pas la même chose
        // selon que le chauffeur a appelé la police ou la plateforme.
        destinataire: d.destinataire === 'heeroo' ? 'heeroo' : 'secours',
        numero: d.numero ? String(d.numero) : null,
        pays: d.pays ? String(d.pays) : null,
        bookingId: identifiantCourse(d.course),
        plateforme: Platform.OS,
        version: versionApplication(),
        at: firebase.database.ServerValue.TIMESTAMP,
    };
}

// Le signalement lui-même. Ne rejette jamais, ne lève jamais, et n'est
// jamais attendu par l'appelant. Rend true si l'écriture a été remise au
// SDK — ce qui ne veut pas dire qu'elle est déjà partie, et c'est voulu :
// hors réseau, elle partira plus tard.
export function signalerAppel(details) {
    try {
        const utilisateur = firebase.auth().currentUser;
        // Sans session, il n'y a personne à signaler. L'appel, lui, a déjà
        // été lancé : c'est le seul point qui compte.
        //
        // On exige l'identifiant et pas seulement la session : une session
        // sans uid écrirait « driver: undefined », que les règles refusent
        // en silence. Mieux vaut ne rien envoyer que croire avoir envoyé.
        if (!utilisateur || !utilisateur.uid) { return false; }

        const alerte = contenuAlerte(Object.assign({}, details, { uid: utilisateur.uid }));
        const ref = firebase.database().ref('sos_alerts').push();
        // Volontairement SANS await ni then bloquant : on rend la main tout
        // de suite. Le catch n'existe que pour qu'une promesse rejetée ne
        // remonte pas en avertissement.
        ref.set(alerte).catch((erreur) => {
            console.log('signalement SOS non parti : ' + (erreur && erreur.message));
        });
        return true;
    } catch (erreur) {
        console.log('signalement SOS impossible : ' + (erreur && erreur.message));
        return false;
    }
}
