#!/usr/bin/env node
// Ce que la purge supprimerait, sans rien supprimer.
//
//   node tools/purge-simulation.js                       # la derniere sauvegarde
//   node tools/purge-simulation.js <dossier-sauvegarde>  # une sauvegarde precise
//
// La simulation tourne sur une SAUVEGARDE LOCALE, jamais sur la production :
// elle ne se connecte à rien et n'écrit rien. Elle emploie exactement les
// mêmes fonctions que la tâche de nuit (functions/lib/purge.js), si bien que
// ce qu'elle annonce est ce qui arrivera.
//
// À lancer avant le premier déploiement : une purge se juge sur ce qu'elle
// s'apprête à détruire, pas sur ce qu'elle rapporte une fois que c'est fait.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SAUVEGARDES = path.join(RACINE, '..', 'heeroo-sauvegardes-base');

const {
    DOUZE_MOIS,
    conversationsAPurger,
    derniereActivite,
    positionsAPurger,
    cheminsAEffacer,
    paquets,
} = require(path.join(RACINE, 'functions', 'lib', 'purge'));

function derniereSauvegarde() {
    if (!fs.existsSync(SAUVEGARDES)) { return null; }
    const dossiers = fs.readdirSync(SAUVEGARDES, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith('prod-'))
        .map((e) => e.name)
        .sort();
    return dossiers.length ? path.join(SAUVEGARDES, dossiers[dossiers.length - 1]) : null;
}

const dossier = process.argv[2] || derniereSauvegarde();
if (!dossier) {
    console.error('Aucune sauvegarde trouvée. Lancez d abord : bash tools/sauvegarder-base.sh prod');
    process.exit(1);
}

function lire(nom) {
    const chemin = path.join(dossier, nom + '.json');
    if (!fs.existsSync(chemin)) {
        console.error('Fichier manquant dans la sauvegarde : ' + chemin);
        process.exit(1);
    }
    const brut = fs.readFileSync(chemin, 'utf8').trim();
    return brut && brut !== 'null' ? JSON.parse(brut) : {};
}

const chat = lire('chat');
const bookings = lire('bookings');
const users = lire('users');
const maintenant = Date.now();

const conversations = conversationsAPurger(chat, maintenant, DOUZE_MOIS);
const activite = derniereActivite(bookings);
const positions = positionsAPurger(users, activite, maintenant, DOUZE_MOIS);

const totalChat = Object.keys(chat).length;
const avecPosition = Object.keys(users).filter((uid) => users[uid] && users[uid].location).length;

console.log('Sauvegarde : ' + dossier);
console.log('Délai      : douze mois (avant le ' + new Date(maintenant - DOUZE_MOIS).toISOString().slice(0, 10) + ')\n');

console.log('Conversations : ' + conversations.length + ' à supprimer sur ' + totalChat);
console.log('Positions     : ' + positions.length + ' à effacer sur ' + avecPosition + ' profils qui en portent une');
console.log('               (' + (avecPosition - positions.length) + ' gardées : activité récente, ou aucun repère de date)\n');

// Le détail, pour que la décision se prenne sur des faits et non sur un total.
const age = (quand) => (quand ? Math.round((maintenant - quand) / (30 * 24 * 3600 * 1000)) + ' mois' : 'sans date');
console.log('Conversations visées :');
for (const course of conversations.slice(0, 10)) {
    console.log('   ' + course);
}
if (conversations.length > 10) { console.log('   ... et ' + (conversations.length - 10) + ' autres'); }

console.log('\nProfils dont la position partirait :');
for (const uid of positions.slice(0, 10)) {
    const profil = users[uid] || {};
    const repere = activite.get(uid) || Number(profil.createdAt) || 0;
    console.log('   ' + uid + '   ' + String(profil.usertype || '?').padEnd(8) + '  dernière trace : ' + age(repere));
}
if (positions.length > 10) { console.log('   ... et ' + (positions.length - 10) + ' autres'); }

const chemins = cheminsAEffacer(conversations, positions);
const lots = paquets(chemins);
console.log('\n' + Object.keys(chemins).length + ' chemins au total, en ' + lots.length + ' écriture(s).');

// Dernière vérification, celle qui compte : rien en dehors du périmètre promis.
const hors = Object.keys(chemins).filter((c) => !/^chat\/[^/]+$/.test(c) && !/^users\/[^/]+\/location$/.test(c));
if (hors.length) {
    console.log('\nATTENTION : ' + hors.length + ' chemin(s) hors du périmètre !');
    for (const c of hors.slice(0, 20)) { console.log('   ' + c); }
    process.exit(1);
}
console.log('Tous les chemins visent une conversation ou une position, rien d autre.');
console.log('\nAucune donnée n a été modifiée : ceci est une simulation.');
