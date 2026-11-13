'use strict';

// Essais de lib/purge.js.
//
//   node --test test/purge.test.js
//
// Ce qui est vérifié ici n'est pas « la purge supprime bien », mais surtout
// « la purge ne supprime pas ce qu'elle ne doit pas ». Une suppression est
// irréversible : un essai qui passe à tort coûte des données, pas un
// avertissement.

const test = require('node:test');
const assert = require('node:assert');

const {
    DOUZE_MOIS,
    dernierMessage,
    conversationsAPurger,
    derniereActivite,
    positionsAPurger,
    cheminsAEffacer,
    paquets,
} = require('../lib/purge');

const MAINTENANT = Date.UTC(2026, 10, 13, 9, 0, 0);
const VIEUX = MAINTENANT - 400 * 24 * 3600 * 1000;   // treize mois
const RECENT = MAINTENANT - 30 * 24 * 3600 * 1000;   // un mois

function conversation(dates, champ) {
    const messages = {};
    dates.forEach((d, i) => {
        const m = {};
        m[champ || 'msgDate'] = d;
        messages['-msg' + i] = m;
    });
    return { message: { 'uidA,uidB': messages } };
}

// --- la date d'une conversation -----------------------------------------

test('le dernier message est le plus recent de tous', () => {
    assert.strictEqual(dernierMessage(conversation([VIEUX, MAINTENANT, RECENT])), MAINTENANT);
});

test('msgTime sert quand msgDate manque', () => {
    assert.strictEqual(dernierMessage(conversation([RECENT], 'msgTime')), RECENT);
});

test('toutes les paires d interlocuteurs sont regardees', () => {
    // Une conversation peut porter plusieurs paires ; n'en lire qu'une
    // ferait passer pour ancienne une conversation encore vivante.
    const c = { message: { 'a,b': { '-1': { msgDate: VIEUX } }, 'c,d': { '-2': { msgDate: RECENT } } } };
    assert.strictEqual(dernierMessage(c), RECENT);
});

test('une conversation sans date rend zero', () => {
    assert.strictEqual(dernierMessage({ message: { 'a,b': { '-1': { from: 'x' } } } }), 0);
});

test('une conversation vide ou absente ne leve pas', () => {
    assert.strictEqual(dernierMessage(null), 0);
    assert.strictEqual(dernierMessage({}), 0);
    assert.strictEqual(dernierMessage({ message: null }), 0);
});

// --- le choix des conversations -----------------------------------------

test('seules les conversations de plus de douze mois sont purgees', () => {
    const chat = { vieille: conversation([VIEUX]), fraiche: conversation([RECENT]) };
    assert.deepStrictEqual(conversationsAPurger(chat, MAINTENANT, DOUZE_MOIS), ['vieille']);
});

test('une conversation sans aucune date est GARDEE', () => {
    // La regle qui compte : on ne supprime pas sur une supposition.
    const chat = { inconnue: { message: { 'a,b': { '-1': { from: 'x' } } } } };
    assert.deepStrictEqual(conversationsAPurger(chat, MAINTENANT, DOUZE_MOIS), []);
});

test('une conversation pile a la limite est gardee', () => {
    const chat = { limite: conversation([MAINTENANT - DOUZE_MOIS]) };
    assert.deepStrictEqual(conversationsAPurger(chat, MAINTENANT, DOUZE_MOIS), []);
});

test('un chat vide ne leve pas', () => {
    assert.deepStrictEqual(conversationsAPurger(null, MAINTENANT, DOUZE_MOIS), []);
});

// --- la derniere activite ------------------------------------------------

test('une course date son passager et son chauffeur', () => {
    const a = derniereActivite({ c1: { customer: 'passager', driver: 'chauffeur', tripdate: RECENT } });
    assert.strictEqual(a.get('passager'), RECENT);
    assert.strictEqual(a.get('chauffeur'), RECENT);
});

test('c est la course la plus recente qui compte', () => {
    const a = derniereActivite({
        vieille: { driver: 'chauffeur', tripdate: VIEUX },
        fraiche: { driver: 'chauffeur', tripdate: RECENT },
    });
    assert.strictEqual(a.get('chauffeur'), RECENT);
});

test('la fin de course compte aussi, pas seulement la date de reservation', () => {
    const a = derniereActivite({ c1: { driver: 'x', tripdate: VIEUX, trip_end_time: RECENT } });
    assert.strictEqual(a.get('x'), RECENT);
});

test('le chauffeur sollicite mais sans course compte comme actif', () => {
    const a = derniereActivite({ c1: { requestedDriver: 'y', tripdate: RECENT } });
    assert.strictEqual(a.get('y'), RECENT);
});

test('une course sans date n apporte aucune activite', () => {
    const a = derniereActivite({ c1: { customer: 'z', tripdate: 'hier' } });
    assert.strictEqual(a.has('z'), false);
});

// --- le choix des positions ---------------------------------------------

const PROFIL = { location: { lat: 1, lng: 2, add: 'quelque part' }, createdAt: VIEUX };

test('la position d un compte inactif depuis plus d un an est purgee', () => {
    const uids = positionsAPurger({ dormant: PROFIL }, new Map(), MAINTENANT, DOUZE_MOIS);
    assert.deepStrictEqual(uids, ['dormant']);
});

test('une course recente protege la position', () => {
    const activite = new Map([['actif', RECENT]]);
    const uids = positionsAPurger({ actif: PROFIL }, activite, MAINTENANT, DOUZE_MOIS);
    assert.deepStrictEqual(uids, []);
});

test('une inscription recente protege la position, meme sans course', () => {
    // Un compte cree la semaine derniere n'a pas encore de course : sans ce
    // repere, sa position serait supprimee des la premiere nuit.
    const profil = { location: { lat: 1, lng: 2 }, createdAt: RECENT };
    assert.deepStrictEqual(positionsAPurger({ neuf: profil }, new Map(), MAINTENANT, DOUZE_MOIS), []);
});

test('un profil sans position n est pas concerne', () => {
    assert.deepStrictEqual(positionsAPurger({ sansPosition: { createdAt: VIEUX } }, new Map(), MAINTENANT, DOUZE_MOIS), []);
});

test('un profil sans aucun repere de date est GARDE', () => {
    // Ni course ni inscription : on ne devine pas.
    const profil = { location: { lat: 1, lng: 2 } };
    assert.deepStrictEqual(positionsAPurger({ mystere: profil }, new Map(), MAINTENANT, DOUZE_MOIS), []);
});

test('l activite peut arriver en objet plutot qu en Map', () => {
    assert.deepStrictEqual(positionsAPurger({ actif: PROFIL }, { actif: RECENT }, MAINTENANT, DOUZE_MOIS), []);
});

// --- les chemins ---------------------------------------------------------

test('les chemins visent la conversation entiere et la seule position', () => {
    const chemins = cheminsAEffacer(['course1'], ['uid1']);
    assert.deepStrictEqual(chemins, { 'chat/course1': null, 'users/uid1/location': null });
});

test('aucun chemin ne sort de chat et de users/<uid>/location', () => {
    // Le garde-fou le plus important du fichier : si une regle derapait, elle
    // ne pourrait pas emporter un profil ou une course.
    const chemins = cheminsAEffacer(['c1', 'c2'], ['u1', 'u2']);
    for (const chemin of Object.keys(chemins)) {
        const permis = /^chat\/[^/]+$/.test(chemin) || /^users\/[^/]+\/location$/.test(chemin);
        assert.ok(permis, 'chemin interdit : ' + chemin);
        assert.strictEqual(chemins[chemin], null);
    }
});

test('rien a purger donne aucun chemin', () => {
    assert.deepStrictEqual(cheminsAEffacer([], []), {});
});

// --- les paquets ---------------------------------------------------------

test('les chemins sont decoupes en paquets bornes', () => {
    const chemins = {};
    for (let i = 0; i < 450; i++) { chemins['chat/c' + i] = null; }
    const lots = paquets(chemins, 200);
    assert.strictEqual(lots.length, 3);
    assert.strictEqual(Object.keys(lots[0]).length, 200);
    assert.strictEqual(Object.keys(lots[2]).length, 50);
});

test('le decoupage ne perd ni ne duplique aucun chemin', () => {
    const chemins = {};
    for (let i = 0; i < 37; i++) { chemins['chat/c' + i] = null; }
    const vus = new Set();
    for (const lot of paquets(chemins, 10)) {
        for (const cle of Object.keys(lot)) {
            assert.ok(!vus.has(cle), 'chemin en double : ' + cle);
            vus.add(cle);
        }
    }
    assert.strictEqual(vus.size, 37);
});

test('aucun chemin ne donne aucun paquet', () => {
    assert.deepStrictEqual(paquets({}, 200), []);
});
