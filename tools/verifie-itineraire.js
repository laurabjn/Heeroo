#!/usr/bin/env node
// Essais de l'ouverture d'un itineraire depuis les ecrans de course.
//
//   node tools/verifie-itineraire.js            # une ligne de resume
//   node tools/verifie-itineraire.js --details  # le detail de chaque essai
//
// Pourquoi ces essais existent. Les deux ecrans de course ouvraient Waze, et
// rien d'autre, par une adresse ecrite en dur. Sur un telephone sans Waze —
// la quasi-totalite des iPhone — le bouton « Itineraire » n'ouvrait pas un
// GPS mais la page web de Waze dans le navigateur. Le client l'a signale le
// 11 nov. 2026 : « il n'y avait pas le GPS, Waze, Maps ou Plans integre ».
//
// Trois parties :
//
//   1. Android. L'adresse « geo: » laisse le SYSTEME poser la question, donc
//      on verifie qu'elle est bien celle-la, au caractere pres, et qu'on ne
//      cherche jamais a deviner quelles applications sont installees.
//   2. iOS. Pas de selecteur systeme : on construit le notre. On verifie le
//      dialogue reellement construit et l'adresse reellement ouverte quand on
//      appuie sur chaque bouton — pas une intention.
//   3. Les coordonnees absentes. Le cas 0,0 compte double : c'est la forme
//      que prend une adresse manquante, et elle designe un point au large du
//      golfe de Guinee. Envoyer un chauffeur la-bas est pire que de lui dire
//      que l'adresse est incomplete.
//
// Le module est transforme par le Babel du projet puis execute, avec
// react-native remplace par des doublures qui ENREGISTRENT ce qu'on leur
// demande.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DRIVER = path.join(RACINE, 'heeroo-driver');

const details = process.argv.includes('--details');
let essais = 0;
const echecs = [];

function essai(nom, obtenu, attendu) {
    essais++;
    const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
    if (!ok) {
        echecs.push(nom + '  ->  ' + JSON.stringify(obtenu) + '   (attendu ' + JSON.stringify(attendu) + ')');
    }
    if (details) { console.log((ok ? '  OK    ' : '  ECHEC ') + nom); }
}
function vrai(nom, condition) { essai(nom, !!condition, true); }
function faux(nom, condition) { essai(nom, !!condition, false); }
function titre(t) { if (details) { console.log('\n--- ' + t + ' ---'); } }
function lire(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }
function sansCommentaires(src) {
    return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
}

function trouverBabel() {
    const p = path.join(DRIVER, 'node_modules', '@babel', 'core');
    if (fs.existsSync(p)) { return { babel: require(p), cwd: DRIVER }; }
    return null;
}

function charger(fichier, outil, fausses) {
    const { babel, cwd } = outil;
    const { code } = babel.transformSync(fs.readFileSync(fichier, 'utf8'), {
        presets: ['babel-preset-expo'],
        babelrc: false,
        configFile: false,
        cwd: cwd,
        filename: fichier,
    });
    const mod = { exports: {} };
    const faussaire = (nom) => (nom in fausses)
        ? fausses[nom]
        : require(require.resolve(nom, { paths: [cwd] }));
    new Function('require', 'module', 'exports', code)(faussaire, mod, mod.exports);
    return mod.exports;
}

const PARIS = { lat: 48.8566, lng: 2.3522 };
const GEO_PARIS = 'geo:48.8566,2.3522?q=48.8566,2.3522';
const WEB_PARIS = 'https://www.google.com/maps/dir/?api=1&destination=48.8566,2.3522&travelmode=driving';
const WAZE_PARIS = 'waze://?ll=48.8566,2.3522&navigate=yes';
const PLANS_PARIS = 'maps://?daddr=48.8566,2.3522&dirflg=d';
const GOOGLE_PARIS = 'comgooglemaps://?daddr=48.8566,2.3522&directionsmode=driving';

const LANGUE = {
    itineraire_plans: 'Plans',
    itineraire_google: 'Google Maps',
    itineraire_waze: 'Waze',
    itineraire_sans_adresse: 'Adresse incomplete',
    itineraire_echec: 'Aucune application',
    directionsdialogTitle: 'Lancer l itineraire',
    directionsdialogMessage: 'Merci de choisir l application',
    directionscancelText: 'Annuler',
};

// Le banc d'essai : on choisit le systeme, les applications installees, et si
// l'ouverture echoue. Tout ce que le module demande est enregistre.
function banc(outil) {
    const journal = { ouvertures: [], interrogations: [], alertes: [] };
    const etat = { os: 'android', installees: [], refuse: [], interrogationCasse: [] };

    const reactNative = {
        Platform: { get OS() { return etat.os; } },
        Alert: { alert: (t, message, boutons) => { journal.alertes.push({ titre: t, message: message, boutons: boutons || null }); } },
        Linking: {
            openURL: (url) => {
                journal.ouvertures.push(url);
                if (etat.refuse.indexOf(url) >= 0) { return Promise.reject(new Error('refus')); }
                return Promise.resolve(true);
            },
            canOpenURL: (url) => {
                journal.interrogations.push(url);
                if (etat.interrogationCasse.indexOf(url) >= 0) { return Promise.reject(new Error('schema non declare')); }
                return Promise.resolve(etat.installees.indexOf(url) >= 0);
            },
        },
    };

    const I = charger(path.join(DRIVER, 'src', 'common', 'itineraire.js'), outil, {
        'react-native': reactNative,
        './language': LANGUE,
    });

    const remettre = () => {
        journal.ouvertures.length = 0;
        journal.interrogations.length = 0;
        journal.alertes.length = 0;
        etat.refuse = [];
        etat.interrogationCasse = [];
    };
    return { I, journal, etat, remettre };
}

// =====================================================================
// 1. Android : le systeme pose la question lui-meme
// =====================================================================
async function partieUn(b) {
    const { I, journal, etat, remettre } = b;
    etat.os = 'android';

    titre('Android : une adresse geo:, et le systeme affiche sa propre liste');
    remettre();
    const rendu = await I.ouvrirItineraire(PARIS);
    essai('une seule adresse ouverte', journal.ouvertures, [GEO_PARIS]);
    essai('et c est bien celle que le systeme sait distribuer', journal.ouvertures[0], GEO_PARIS);
    essai('aucune alerte', journal.alertes.length, 0);
    vrai('la fonction dit que c est parti', rendu);
    // Deviner les applications installees est justement ce qu'on evite sur
    // Android : le systeme le sait mieux que nous.
    essai('aucune application n a ete interrogee', journal.interrogations, []);

    titre('Android : si rien ne sait ouvrir geo:, il reste le plan web');
    remettre();
    etat.refuse = [GEO_PARIS];
    const rendu2 = await I.ouvrirItineraire(PARIS);
    essai('on a essaye geo: puis le web', journal.ouvertures, [GEO_PARIS, WEB_PARIS]);
    essai('aucune alerte, puisque le web a marche', journal.alertes.length, 0);
    vrai('et la fonction dit que c est parti', rendu2);

    titre('Android : si meme le web echoue, le chauffeur est prevenu');
    remettre();
    etat.refuse = [GEO_PARIS, WEB_PARIS];
    const rendu3 = await I.ouvrirItineraire(PARIS);
    essai('les deux tentatives ont eu lieu', journal.ouvertures, [GEO_PARIS, WEB_PARIS]);
    essai('une alerte, et une seule', journal.alertes.length, 1);
    essai('elle dit ce qui s est passe', journal.alertes[0].message, LANGUE.itineraire_echec);
    faux('et la fonction ne pretend pas avoir reussi', rendu3);
}

// =====================================================================
// 2. iOS : notre propre selecteur, avec les applications reellement presentes
// =====================================================================
async function partieDeux(b) {
    const { I, journal, etat, remettre } = b;
    etat.os = 'ios';

    titre('iOS sans aucune application de navigation : le plan web');
    remettre();
    etat.installees = [];
    const rendu = await I.ouvrirItineraire(PARIS);
    essai('les trois applications ont ete interrogees',
        journal.interrogations, [PLANS_PARIS, GOOGLE_PARIS, WAZE_PARIS]);
    essai('et on ouvre le web', journal.ouvertures, [WEB_PARIS]);
    essai('sans poser de question', journal.alertes.length, 0);
    vrai('la fonction dit que c est parti', rendu);

    titre('iOS avec une seule application : on ne pose pas la question');
    remettre();
    etat.installees = [WAZE_PARIS];
    await I.ouvrirItineraire(PARIS);
    essai('Waze est ouvert directement', journal.ouvertures, [WAZE_PARIS]);
    // Le chauffeur est au volant : un dialogue a un seul choix est une
    // manipulation de plus pour rien.
    essai('aucun dialogue', journal.alertes.length, 0);

    titre('iOS avec deux applications : le dialogue, et ce qu il ouvre vraiment');
    remettre();
    etat.installees = [PLANS_PARIS, WAZE_PARIS];
    await I.ouvrirItineraire(PARIS);
    essai('rien n est ouvert avant le choix', journal.ouvertures, []);
    essai('un dialogue', journal.alertes.length, 1);
    const d = journal.alertes[0];
    essai('avec son titre', d.titre, LANGUE.directionsdialogTitle);
    essai('et sa question', d.message, LANGUE.directionsdialogMessage);
    essai('trois boutons : les deux applications, puis Annuler',
        d.boutons.map(x => x.text), ['Plans', 'Waze', 'Annuler']);
    essai('Google Maps absent, puisqu il n est pas installe',
        d.boutons.filter(x => x.text === 'Google Maps').length, 0);
    const annuler = d.boutons[d.boutons.length - 1];
    essai('Annuler porte bien le style du systeme', annuler.style, 'cancel');
    faux('et ne fait rien', annuler.onPress);

    d.boutons[0].onPress();
    essai('appuyer sur Plans ouvre Plans', journal.ouvertures, [PLANS_PARIS]);
    d.boutons[1].onPress();
    essai('appuyer sur Waze ouvre Waze', journal.ouvertures, [PLANS_PARIS, WAZE_PARIS]);

    titre('iOS avec les trois : les trois sont proposees, dans cet ordre');
    remettre();
    etat.installees = [PLANS_PARIS, GOOGLE_PARIS, WAZE_PARIS];
    await I.ouvrirItineraire(PARIS);
    essai('quatre boutons', journal.alertes[0].boutons.map(x => x.text),
        ['Plans', 'Google Maps', 'Waze', 'Annuler']);

    titre('iOS : une interrogation qui echoue vaut application absente');
    remettre();
    etat.installees = [PLANS_PARIS, WAZE_PARIS];
    etat.interrogationCasse = [PLANS_PARIS];
    await I.ouvrirItineraire(PARIS);
    // Un schema non declare dans LSApplicationQueriesSchemes fait rejeter
    // canOpenURL : ca ne doit pas faire tomber tout le selecteur.
    essai('il reste Waze, ouvert directement', journal.ouvertures, [WAZE_PARIS]);
    essai('et aucun dialogue', journal.alertes.length, 0);

    titre('iOS : si l application refuse de s ouvrir, il reste le web');
    remettre();
    etat.installees = [WAZE_PARIS];
    etat.refuse = [WAZE_PARIS];
    await I.ouvrirItineraire(PARIS);
    essai('on a essaye Waze puis le web', journal.ouvertures, [WAZE_PARIS, WEB_PARIS]);
}

// =====================================================================
// 3. Les coordonnees qui n'en sont pas
// =====================================================================
async function partieTrois(b) {
    const { I, journal, etat, remettre } = b;

    titre('aucune adresse valable : on ne lance rien, on le dit');
    const mauvaises = [
        null, undefined, {}, { lat: 0, lng: 0 }, { lat: null, lng: null },
        { lat: 'abc', lng: 'def' }, { lat: 91, lng: 2 }, { lat: 48, lng: 181 },
        { lat: NaN, lng: 2 }, { lat: Infinity, lng: 2 }, { lng: 2 }, { lat: 48 },
    ];
    for (const os of ['android', 'ios']) {
        etat.os = os;
        for (const mauvaise of mauvaises) {
            remettre();
            const rendu = await I.ouvrirItineraire(mauvaise);
            const quoi = os + ' / ' + JSON.stringify(mauvaise);
            essai('rien ouvert pour ' + quoi, journal.ouvertures, []);
            essai('une alerte pour ' + quoi, journal.alertes.length, 1);
            essai('qui parle d adresse incomplete pour ' + quoi,
                journal.alertes[0].message, LANGUE.itineraire_sans_adresse);
            faux('et la fonction ne pretend rien pour ' + quoi, rendu);
        }
    }

    titre('0,0 merite son propre essai : c est la forme d une adresse absente');
    faux('le point nul est refuse', I.coordonneesValides({ lat: 0, lng: 0 }));
    vrai('mais une longitude nulle seule reste valable', I.coordonneesValides({ lat: 48.85, lng: 0 }));
    vrai('et une latitude nulle seule aussi', I.coordonneesValides({ lat: 0, lng: 2.35 }));

    titre('les coordonnees arrivent parfois en texte : on les accepte');
    etat.os = 'android';
    remettre();
    await I.ouvrirItineraire({ lat: '48.8566', lng: '2.3522' });
    essai('et on construit la meme adresse', journal.ouvertures, [GEO_PARIS]);
}

// =====================================================================
// 4. Les ecrans s'en servent, et plus rien n'ouvre Waze en dur
// =====================================================================
function partieQuatre() {
    titre('les deux ecrans de course passent par le module');
    const ECRANS = [
        { nom: 'prise en charge', fichier: 'src/screens/DriverStartTrip.js', point: 'pickup' },
        { nom: 'course en cours', fichier: 'src/screens/CompleteTrip.js', point: 'drop' },
    ];
    ECRANS.forEach(({ nom, fichier, point }) => {
        const src = lire(path.join(DRIVER, fichier)) || '';
        const vif = sansCommentaires(src);
        vrai(nom + ' : importe ouvrirItineraire',
            /import\s*\{\s*ouvrirItineraire\s*\}\s*from\s*'\.\.\/common\/itineraire'/.test(vif));
        vrai(nom + ' : l appelle, hors commentaire', /ouvrirItineraire\(/.test(vif));
        // Le bon point : la prise en charge avant le depart, la depose apres.
        vrai(nom + ' : avec le point « ' + point + ' »',
            new RegExp('ouvrirItineraire\\([^)]*\\.' + point).test(vif));
        faux(nom + ' : plus de code mort du selecteur d origine',
            /showLocation|appsWhiteList|directionPopupVisible/.test(src));
    });

    titre('plus aucune adresse Waze ecrite en dur dans toute l application');
    const coupables = [];
    (function parcourir(dossier) {
        if (!fs.existsSync(dossier)) { return; }
        fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
            const p = path.join(dossier, e.name);
            if (e.isDirectory()) { parcourir(p); return; }
            if (!/\.js$/.test(e.name)) { return; }
            const src = sansCommentaires(fs.readFileSync(p, 'utf8'));
            if (/waze\.com/.test(src)) { coupables.push(path.relative(DRIVER, p).split('\\').join('/')); }
        });
    })(path.join(DRIVER, 'src'));
    essai('aucun fichier', coupables, []);

    titre('iOS : sans les schemas declares, le selecteur serait vide');
    const app = JSON.parse(lire(path.join(DRIVER, 'app.json')) || '{}');
    const schemas = ((app.expo || {}).ios || {}).infoPlist || {};
    const liste = schemas.LSApplicationQueriesSchemes || [];
    vrai('waze est declare', liste.indexOf('waze') >= 0);
    vrai('comgooglemaps est declare', liste.indexOf('comgooglemaps') >= 0);
    // Les schemas d'Apple sont autorises d'office : les declarer ne sert a
    // rien et consomme une des cinquante places disponibles.
    faux('maps n est pas declare, Apple l autorise d office', liste.indexOf('maps') >= 0);

    titre('les libelles existent dans les deux langues');
    const fr = lire(path.join(DRIVER, 'src/common/language.fr.js')) || '';
    const en = lire(path.join(DRIVER, 'src/common/language.en.js')) || '';
    ['itineraire_plans', 'itineraire_google', 'itineraire_waze',
        'itineraire_sans_adresse', 'itineraire_echec',
        'directionsdialogTitle', 'directionsdialogMessage', 'directionscancelText',
        'get_direction'].forEach((cle) => {
        vrai(cle + ' : en francais', new RegExp('^\\s*' + cle + '\\s*:', 'm').test(fr));
        vrai(cle + ' : en anglais', new RegExp('^\\s*' + cle + '\\s*:', 'm').test(en));
    });
    faux('la coquille « itiniéraire » a disparu', /itiniéraire/.test(fr));
}

function terminer() {
    if (echecs.length) {
        console.log('\n' + echecs.length + ' ECHEC(S) sur ' + essais + ' essais :');
        echecs.forEach(e => console.log('  - ' + e));
        process.exit(1);
    }
    console.log('verifie-itineraire : ' + essais + ' essais, tous passent.');
    process.exit(0);
}

(async () => {
    const outil = trouverBabel();
    if (outil) {
        const b = banc(outil);
        await partieUn(b);
        await partieDeux(b);
        await partieTrois(b);
    } else {
        console.log('verifie-itineraire : node_modules de heeroo-driver absent, les parties 1 a 3 sont sautees.');
    }
    partieQuatre();
    terminer();
})();
