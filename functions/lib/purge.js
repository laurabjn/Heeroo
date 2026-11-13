'use strict';

// Purge des données dont la politique de confidentialité promet la suppression.
//
// « Les messages et les positions relevées pendant les courses sont supprimés
// dans un délai de douze mois. » Cette phrase est publiée depuis octobre 2026,
// et rien ne l'exécutait : les conversations de 2022 étaient toujours là, et
// 253 profils portaient encore une position précise — adresse formatée
// comprise. Une promesse de conservation non tenue n'est pas une maladresse de
// rédaction, c'est un manquement.
//
// Deux principes gouvernent ce fichier :
//
// 1. On ne supprime jamais sur une supposition. Une conversation sans la
//    moindre date, un profil sans aucun repère de temps : on garde. Mieux vaut
//    une donnée de trop qu'une donnée détruite à tort, car la seconde erreur
//    est irréversible et la première se rattrape au passage suivant.
//
// 2. On ne touche qu'à ce que la politique annonce. Les courses, les comptes et
//    les justificatifs comptables ont leur propre durée, imposée par la loi :
//    ils ne sont pas du ressort de cette purge. Seuls `chat/{course}` et
//    `users/{uid}/location` sont concernés.
//
// Supprimer la position d'un compte inactif est sans conséquence : les
// applications la réécrivent en continu tant qu'elles sont à l'écran
// (DriverTripAccept.js, watchPosition). Elle revient donc dès la prochaine
// connexion, à jour, au lieu de dater d'un an.

const DOUZE_MOIS = 365 * 24 * 60 * 60 * 1000;

// La date du message le plus récent d'une conversation. Les messages sont
// rangés sous une paire d'identifiants, elle-même sous la course :
//   chat/{course}/message/{uidA,uidB}/{idMessage} = { msgDate, msgTime, ... }
// Rend 0 si aucune date n'est lisible — ce qui, plus haut, veut dire « garder ».
function dernierMessage(conversation) {
    const paires = (conversation && conversation.message) || {};
    let dernier = 0;
    for (const paire of Object.keys(paires)) {
        const messages = paires[paire] || {};
        for (const identifiant of Object.keys(messages)) {
            const m = messages[identifiant] || {};
            const quand = Number(m.msgDate || m.msgTime || 0);
            if (Number.isFinite(quand) && quand > dernier) { dernier = quand; }
        }
    }
    return dernier;
}

// Les conversations dont le dernier message dépasse le délai.
function conversationsAPurger(chat, maintenant, delai) {
    const limite = maintenant - (delai || DOUZE_MOIS);
    const aPurger = [];
    for (const course of Object.keys(chat || {})) {
        const quand = dernierMessage(chat[course]);
        if (!quand) { continue; }
        if (quand < limite) { aPurger.push(course); }
    }
    return aPurger;
}

// La dernière trace d'activité de chaque personne, lue dans les courses.
// Une course date son passager comme son chauffeur : c'est le seul repère
// fiable dont la base dispose, l'historique de connexion vivant côté
// authentification et non ici.
function derniereActivite(bookings) {
    const activite = new Map();
    for (const identifiant of Object.keys(bookings || {})) {
        const course = bookings[identifiant] || {};
        const dates = [course.tripdate, course.trip_start_time, course.trip_end_time, course.cancel_date]
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!dates.length) { continue; }
        const quand = Math.max.apply(null, dates);
        for (const uid of [course.customer, course.driver, course.requestedDriver]) {
            if (typeof uid !== 'string' || !uid) { continue; }
            if (!activite.has(uid) || activite.get(uid) < quand) { activite.set(uid, quand); }
        }
    }
    return activite;
}

// Les profils dont la position doit disparaître : ceux qui en portent une et
// dont rien, ni course ni inscription, ne remonte à moins de douze mois.
function positionsAPurger(users, activite, maintenant, delai) {
    const limite = maintenant - (delai || DOUZE_MOIS);
    const vue = activite instanceof Map ? activite : new Map(Object.entries(activite || {}));
    const aPurger = [];
    for (const uid of Object.keys(users || {})) {
        const profil = users[uid] || {};
        if (!profil.location) { continue; }
        const reperes = [vue.get(uid), Number(profil.createdAt)]
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!reperes.length) { continue; }
        if (Math.max.apply(null, reperes) < limite) { aPurger.push(uid); }
    }
    return aPurger;
}

// Les chemins à effacer, prêts pour une écriture multiple. Les regrouper en
// paquets borne la taille de chaque requête : une base qui aurait pris du
// retard ne doit pas produire une écriture démesurée d'un seul tenant.
function cheminsAEffacer(courses, uids) {
    const chemins = {};
    for (const course of courses) { chemins['chat/' + course] = null; }
    for (const uid of uids) { chemins['users/' + uid + '/location'] = null; }
    return chemins;
}

function paquets(chemins, taille) {
    const max = taille || 200;
    const cles = Object.keys(chemins);
    const lots = [];
    for (let i = 0; i < cles.length; i += max) {
        const lot = {};
        for (const cle of cles.slice(i, i + max)) { lot[cle] = chemins[cle]; }
        lots.push(lot);
    }
    return lots;
}

module.exports = {
    DOUZE_MOIS,
    dernierMessage,
    conversationsAPurger,
    derniereActivite,
    positionsAPurger,
    cheminsAEffacer,
    paquets,
};
