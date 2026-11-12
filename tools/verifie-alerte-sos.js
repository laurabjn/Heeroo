#!/usr/bin/env node
// Essais du signalement a Heeroo d'un appel d'urgence.
//
//   node tools/verifie-alerte-sos.js            # une ligne de resume
//   node tools/verifie-alerte-sos.js --details  # le detail de chaque essai
//
// Ce que cette suite protege, et pourquoi :
//
//   1. alerteSOS.js — ce qui part en base, exactement. Les regles de securite
//      valident cette forme-la : un champ renomme ici et l'ecriture est
//      refusee par Firebase, en silence, au pire moment.
//   2. sos.js — l'ORDRE. L'appel doit etre lance avant le signalement, et le
//      signalement ne doit jamais etre attendu. Un chauffeur agresse ne doit
//      pas attendre le reseau pour composer le 112. C'est l'essai le plus
//      important du fichier.
//   3. Les sources — que le bouton transporte bien la course, que le serveur
//      ait son declencheur et son secret, et que le back-office ait la case
//      ou saisir l'adresse. Le 10 nov. 2026, le bouton SOS etait pose sur le
//      mauvais ecran pendant que 65 essais passaient au vert : la logique
//      juste ne prouve pas le branchement.
//
// Les modules sont transformes par le Babel du projet puis executes avec des
// doublures qui ENREGISTRENT ce qu'on leur demande.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DRIVER = path.join(RACINE, 'heeroo-driver');
const RIDER = path.join(RACINE, 'heeroo-rider');
const ADMIN = path.join(RACINE, 'heeroo-admin');
const FONCTIONS = path.join(RACINE, 'functions');

const details = process.argv.includes('--details');
let essais = 0;
const echecs = [];

// Plusieurs essais provoquent EXPRES une panne — session cassee, reseau
// coupe — et le module trace alors sur la sortie standard, parfois apres
// coup puisqu'une promesse rejetee se resout au tour suivant. Ce bruit
// venait se melanger au resume, et la derniere ligne du script n'etait plus
// son verdict. On le filtre ici plutot que de rendre le module muet : en
// production, cette trace est utile.
const journalOriginal = console.log;
console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('signalement SOS')) { return; }
    journalOriginal.apply(console, args);
};

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
    for (const app of [DRIVER, RIDER]) {
        const p = path.join(app, 'node_modules', '@babel', 'core');
        if (fs.existsSync(p)) { return { babel: require(p), cwd: app }; }
    }
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

// Une doublure de firebase qui enregistre tout ce qu'on lui ecrit.
function fauxFirebase(options) {
    const o = options || {};
    const journal = { pousses: [], ecrits: [] };
    let cle = 0;
    const firebase = {
        auth: () => {
            if (o.authLeve) { throw new Error('auth cassee'); }
            return { currentUser: o.utilisateur || null };
        },
        database: () => ({
            ref: (chemin) => ({
                push: () => {
                    cle++;
                    const id = '-cle' + cle;
                    journal.pousses.push({ chemin: chemin, id: id });
                    return {
                        key: id,
                        set: (valeur) => {
                            journal.ecrits.push({ chemin: chemin + '/' + id, valeur: valeur });
                            return o.setRejette
                                ? Promise.reject(new Error('reseau coupe'))
                                : Promise.resolve();
                        },
                    };
                },
            }),
        }),
    };
    firebase.database.ServerValue = { TIMESTAMP: '<<HORODATAGE>>' };
    return { firebase, journal };
}

function chargerAlerte(outil, options) {
    const { firebase, journal } = fauxFirebase(options);
    const o = options || {};
    const A = charger(path.join(DRIVER, 'src', 'common', 'alerteSOS.js'), outil, {
        'react-native': { Platform: { OS: o.plateforme || 'android' } },
        // Passee TELLE QUELLE, sans l'envelopper dans { default }. Babel
        // applique deja son interop aux modules sans __esModule : envelopper
        // ici la rendrait accessible sous Constants.default, et le module
        // lirait une version toujours nulle.
        'expo-constants': o.constants === undefined ? { expoConfig: { version: '1.6.4' } } : o.constants,
        'firebase/compat/app': firebase,
        'firebase/compat/auth': {},
        'firebase/compat/database': {},
    });
    return { A, journal };
}

// =====================================================================
// 1. alerteSOS.js — ce qui part en base
// =====================================================================
function partieUn(outil) {
    titre('identifiantCourse : on n en retient que la cle');
    const { A } = chargerAlerte(outil, {});
    essai('un objet de course donne son bookingId', A.identifiantCourse({ bookingId: '-Nabc' }), '-Nabc');
    essai('un identifiant deja extrait passe tel quel', A.identifiantCourse('-Nabc'), '-Nabc');
    essai('une course sans bookingId ne vaut rien', A.identifiantCourse({ pickup: {} }), null);
    essai('rien du tout vaut null', A.identifiantCourse(null), null);
    essai('une chaine vide vaut null', A.identifiantCourse(''), null);
    essai('un bookingId numerique est rendu en texte', A.identifiantCourse({ bookingId: 42 }), '42');

    titre('versionApplication : lue sans jamais lever');
    essai('expoConfig porte la version', A.versionApplication(), '1.6.4');
    essai('un ancien manifest est accepte',
        chargerAlerte(outil, { constants: { manifest: { version: '1.5.0' } } }).A.versionApplication(), '1.5.0');
    essai('sans configuration, null plutot qu une erreur',
        chargerAlerte(outil, { constants: {} }).A.versionApplication(), null);
    essai('un module absent ne fait pas lever',
        chargerAlerte(outil, { constants: null }).A.versionApplication(), null);

    titre('contenuAlerte : la forme exacte que les regles valident');
    const contenu = A.contenuAlerte({
        uid: 'u1', destinataire: 'secours', numero: '112', pays: 'FR',
        course: { bookingId: '-Nabc' },
    });
    essai('les clefs sont exactement celles attendues', Object.keys(contenu).sort(),
        ['at', 'bookingId', 'destinataire', 'driver', 'numero', 'pays', 'plateforme', 'version'].sort());
    essai('le chauffeur est le proprietaire de l alerte', contenu.driver, 'u1');
    essai('le numero est rendu en texte', contenu.numero, '112');
    essai('la plateforme est celle du telephone', contenu.plateforme, 'android');
    essai('l horodatage est celui du serveur, pas celui du telephone', contenu.at, '<<HORODATAGE>>');
    essai('la course est citee', contenu.bookingId, '-Nabc');

    titre('contenuAlerte : le destinataire ne prend que deux valeurs');
    essai('« heeroo » est conserve', A.contenuAlerte({ destinataire: 'heeroo' }).destinataire, 'heeroo');
    essai('« secours » est conserve', A.contenuAlerte({ destinataire: 'secours' }).destinataire, 'secours');
    essai('tout le reste devient « secours »', A.contenuAlerte({ destinataire: 'autre' }).destinataire, 'secours');
    essai('rien du tout devient « secours »', A.contenuAlerte({}).destinataire, 'secours');
    // Les regles refusent une chaine vide la ou elles attendent un texte :
    // null fait disparaitre la clef, ce qui est accepte.
    essai('un numero absent vaut null, pas une chaine vide', A.contenuAlerte({}).numero, null);
    essai('un pays absent vaut null', A.contenuAlerte({}).pays, null);
    essai('une course absente vaut null', A.contenuAlerte({}).bookingId, null);
    essai('des details absents ne font pas lever', typeof A.contenuAlerte(null), 'object');

    titre('contenuAlerte sur iOS');
    essai('la plateforme suit le telephone',
        chargerAlerte(outil, { plateforme: 'ios' }).A.contenuAlerte({}).plateforme, 'ios');

    titre('signalerAppel : ce qui est reellement ecrit');
    {
        const { A: A2, journal } = chargerAlerte(outil, { utilisateur: { uid: 'u9' } });
        const rendu = A2.signalerAppel({ destinataire: 'secours', numero: '17', pays: 'SN', course: { bookingId: '-Nxyz' } });
        essai('le signalement est remis au SDK', rendu, true);
        essai('une seule ecriture', journal.ecrits.length, 1);
        essai('elle va sous sos_alerts', journal.pousses[0].chemin, 'sos_alerts');
        essai('la clef est engendree par push, pas choisie', journal.ecrits[0].chemin, 'sos_alerts/-cle1');
        essai('le chauffeur ecrit est celui de la session', journal.ecrits[0].valeur.driver, 'u9');
        essai('le numero compose est celui transmis', journal.ecrits[0].valeur.numero, '17');
        essai('le pays est celui transmis', journal.ecrits[0].valeur.pays, 'SN');
        essai('la course est celle transmise', journal.ecrits[0].valeur.bookingId, '-Nxyz');
    }

    titre('signalerAppel : les cas ou rien ne doit casser');
    {
        const { A: A2, journal } = chargerAlerte(outil, { utilisateur: null });
        essai('sans session, on ne signale rien', A2.signalerAppel({}), false);
        essai('et on n ecrit rien', journal.ecrits.length, 0);
    }
    {
        // Une session sans identifiant ecrirait « driver: undefined », que
        // les regles refusent en silence : on croirait avoir alerte Heeroo.
        const { A: A2, journal } = chargerAlerte(outil, { utilisateur: {} });
        essai('une session sans identifiant ne signale rien', A2.signalerAppel({}), false);
        essai('et surtout, elle n ecrit pas une alerte sans chauffeur', journal.ecrits.length, 0);
    }
    {
        const { A: A2 } = chargerAlerte(outil, { authLeve: true });
        essai('une session cassee rend false au lieu de lever', A2.signalerAppel({}), false);
    }
    {
        const { A: A2, journal } = chargerAlerte(outil, { utilisateur: { uid: 'u9' }, setRejette: true });
        essai('un reseau coupe rend quand meme true : l ecriture est en file',
            A2.signalerAppel({}), true);
        essai('l ecriture a bien ete tentee', journal.ecrits.length, 1);
    }
}

// =====================================================================
// 2. sos.js — l'ordre, qui est tout
// =====================================================================
function partieDeux(outil) {
    const journal = [];
    let dialogue = null;
    const reactNative = {
        Alert: { alert: (t, m, boutons) => { dialogue = { boutons: boutons }; } },
        Linking: {
            openURL: (url) => { journal.push({ quoi: 'appel', url: url }); return Promise.resolve(); },
        },
    };
    const faussAlerte = {
        signalerAppel: (d) => { journal.push({ quoi: 'signalement', details: d }); return true; },
    };
    const langue = {
        cancel: 'Annuler', panic_text: 'Appel SOS', panic_question: 'Qui ?',
        panic_secours: 'Appeler les secours', panic_operateur: 'Appeler Heeroo',
        panic_echec: 'Impossible',
    };
    const urgences = {
        numeroUrgence: (p) => (p === 'SN' ? '17' : '112'),
        numeroHeeroo: () => null,
        numeroAppelable: (n) => (n ? String(n).replace(/[^+0-9]/g, '') : null),
        sosActif: () => true,
    };
    const SOS = charger(path.join(DRIVER, 'src', 'common', 'sos.js'), outil, {
        'react-native': reactNative,
        'firebase/compat/app': { auth: () => ({ currentUser: null }), database: () => ({}) },
        'firebase/compat/auth': {},
        'firebase/compat/database': {},
        './language': langue,
        './urgences': urgences,
        './alerteSOS': faussAlerte,
    });

    const appuyer = (texte) => {
        journal.length = 0;
        const bouton = dialogue.boutons.find(b => b.text === texte);
        if (!bouton) {
            echecs.push('bouton introuvable : ' + texte);
            essais++;
            return;
        }
        // « Annuler » n'a volontairement pas d'action : ne rien appeler est
        // le comportement attendu, pas une anomalie du banc.
        if (typeof bouton.onPress === 'function') { bouton.onPress(); }
    };

    titre('appel aux secours : l appel D ABORD, le signalement ENSUITE');
    SOS.ouvrirSOS({ pays: 'FR', operateur: null, actif: true, course: { bookingId: '-Nabc' } });
    appuyer('Appeler les secours (112)');
    essai('deux actions, et deux seulement', journal.length, 2);
    essai('la premiere est l appel', journal[0] && journal[0].quoi, 'appel');
    essai('le composeur recoit le numero', journal[0] && journal[0].url, 'tel:112');
    essai('la seconde est le signalement', journal[1] && journal[1].quoi, 'signalement');
    essai('le signalement dit « secours »', journal[1] && journal[1].details.destinataire, 'secours');
    essai('le signalement porte le numero reellement compose', journal[1] && journal[1].details.numero, '112');
    essai('le signalement porte le pays', journal[1] && journal[1].details.pays, 'FR');
    essai('le signalement porte la course', journal[1] && journal[1].details.course.bookingId, '-Nabc');

    titre('appel a Heeroo : meme ordre, autre destinataire');
    SOS.ouvrirSOS({ pays: 'SN', operateur: '+221 77 000 00 00', actif: true, course: null });
    appuyer('Appeler Heeroo');
    essai('l appel precede le signalement', journal.map(e => e.quoi), ['appel', 'signalement']);
    essai('le composeur recoit le numero de Heeroo', journal[0] && journal[0].url, 'tel:+221770000000');
    essai('le signalement dit « heeroo »', journal[1] && journal[1].details.destinataire, 'heeroo');
    essai('sans course, rien n est invente', journal[1] && journal[1].details.course, null);
    essai('le pays du Senegal est transmis', journal[1] && journal[1].details.pays, 'SN');

    titre('le numero des secours suit le pays');
    SOS.ouvrirSOS({ pays: 'SN', operateur: null, actif: true });
    appuyer('Appeler les secours (17)');
    essai('le Senegal compose le 17', journal[0] && journal[0].url, 'tel:17');
    essai('et le signalement porte le 17', journal[1] && journal[1].details.numero, '17');

    titre('annuler n appelle rien et ne signale rien');
    SOS.ouvrirSOS({ pays: 'FR', operateur: null, actif: true });
    appuyer('Annuler');
    essai('aucune action', journal.length, 0);

    titre('un etat vide : les secours restent joignables, et signales');
    SOS.ouvrirSOS(null);
    appuyer('Appeler les secours (112)');
    essai('l appel part', journal[0] && journal[0].url, 'tel:112');
    essai('le signalement aussi', journal[1] && journal[1].quoi, 'signalement');
    essai('sans pays connu, on ne l invente pas', journal[1] && journal[1].details.pays, null);
}

// =====================================================================
// 3. les sources : le branchement, pas seulement la logique
// =====================================================================
function partieTrois() {
    titre('sos.js : le signalement ne doit jamais retarder l appel');
    const sos = lire(path.join(DRIVER, 'src', 'common', 'sos.js'));
    vrai('sos.js existe', sos);
    if (sos) {
        const net = sansCommentaires(sos);
        vrai('signalerAppel est importe', /import \{ signalerAppel \} from '\.\/alerteSOS'/.test(net));
        essai('il n est appele qu a un seul endroit', (net.match(/signalerAppel\(/g) || []).length, 1);
        faux('il n est jamais attendu', /await signalerAppel/.test(net));
        faux('on n enchaine rien derriere', /signalerAppel\([^;]*\)\s*\.then/.test(net));
        vrai('l ouverture du composeur precede le signalement',
            net.indexOf("Linking.openURL('tel:'") < net.indexOf('signalerAppel('));
    }

    titre('alerteSOS.js : il n appelle rien de bloquant');
    const alerte = lire(path.join(DRIVER, 'src', 'common', 'alerteSOS.js'));
    vrai('alerteSOS.js existe', alerte);
    if (alerte) {
        const net = sansCommentaires(alerte);
        faux('aucun await', /\bawait\b/.test(net));
        vrai('l ecriture va sous sos_alerts', /ref\('sos_alerts'\)/.test(net));
        vrai('la clef vient de push', /\.push\(\)/.test(net));
        vrai('l horodatage est celui du serveur', /ServerValue\.TIMESTAMP/.test(net));
        vrai('un rejet est rattrape', /\.catch\(/.test(net));
    }

    titre('le bouton transporte la course jusqu au signalement');
    const bouton = lire(path.join(DRIVER, 'src', 'components', 'BoutonSOS.js'));
    vrai('BoutonSOS.js existe', bouton);
    if (bouton) {
        vrai('la course du parent est jointe a l etat SOS',
            /ouvrirSOS\(Object\.assign\(\{\}, this\.state\.sos, \{ course: this\.props\.course \}\)\)/.test(sansCommentaires(bouton)));
    }
    for (const ecran of ['DriverStartTrip.js', 'CompleteTrip.js']) {
        const src = lire(path.join(DRIVER, 'src', 'screens', ecran));
        vrai(ecran + ' existe', src);
        if (src) {
            vrai(ecran + ' passe sa course au bouton',
                /<BoutonSOS[^>]*course=\{this\.state\.rideDetails\}/.test(sansCommentaires(src)));
        }
    }
    // Les ecrans sans course n'en passent pas : c'est voulu, pas un oubli.
    const menu = lire(path.join(DRIVER, 'src', 'components', 'SideMenu.js'));
    if (menu) { faux('le menu lateral ne pretend pas connaitre de course', /course=/.test(menu)); }

    titre('les regles de securite protegent les alertes');
    const regles = JSON.parse(lire(path.join(RACINE, 'database.rules.json')));
    const noeud = regles.rules.sos_alerts;
    vrai('le noeud sos_alerts est declare', !!noeud);
    if (noeud) {
        vrai('la lecture est reservee aux administrateurs', /isAdmin/.test(noeud['.read']));
        const un = noeud.$alerteId;
        vrai('une alerte ne se cree que par un chauffeur connecte', /auth != null/.test(un['.write']));
        vrai('une alerte ne se modifie pas apres coup', /!data\.exists\(\)/.test(un['.write']));
        vrai('on ne signale que pour soi', /newData\.child\('driver'\)\.val\(\) === auth\.uid/.test(un['.write']));
        vrai('le destinataire est borne a deux valeurs',
            /'secours'/.test(un.destinataire['.validate']) && /'heeroo'/.test(un.destinataire['.validate']));
        vrai('un champ inconnu est refuse', un.$autre['.validate'] === false);
        vrai('le compte rendu d envoi est refuse a l application', un.mail['.validate'] === false);
    }
    vrai('la racine de la base reste fermee', regles.rules['.read'] === false && regles.rules['.write'] === false);

    titre('le serveur a son declencheur, son secret et sa dependance');
    const index = lire(path.join(FONCTIONS, 'index.js'));
    vrai('functions/index.js existe', index);
    if (index) {
        const net = sansCommentaires(index);
        vrai('le declencheur existe', /exports\.onSosAlert = onValueCreated\(/.test(net));
        vrai('il ecoute sos_alerts', /ref: '\/sos_alerts\/\{alerteId\}'/.test(net));
        vrai('il recoit le secret de messagerie', /secrets: \[SOS_SMTP\]/.test(net));
        vrai('le secret est declare', /defineSecret\('SOS_SMTP'\)/.test(net));
        vrai('il ecrit un compte rendu dans l alerte', /child\('mail'\)/.test(net));
    }
    const paquet = JSON.parse(lire(path.join(FONCTIONS, 'package.json')));
    vrai('nodemailer est declare', !!paquet.dependencies.nodemailer);
    const verrou = JSON.parse(lire(path.join(FONCTIONS, 'package-lock.json')));
    vrai('nodemailer est verrouille', !!(verrou.packages && verrou.packages['node_modules/nodemailer']));

    titre('le back-office permet de saisir l adresse');
    const reglages = lire(path.join(ADMIN, 'src', 'views', 'Settings.js'));
    vrai('Settings.js existe', reglages);
    if (reglages) {
        vrai('la colonne E-mail SOS est la', /field: 'sosEmail'/.test(sansCommentaires(reglages)));
        vrai('elle est modifiable', !/field: 'sosEmail'[^}]*editable: 'never'/.test(reglages));
    }
    const langueAdmin = lire(path.join(ADMIN, 'src', 'config', 'language.js'));
    vrai('le libelle de la colonne existe', langueAdmin && /sos_email:\s*'[^']+'/.test(langueAdmin));

    titre('aucune adresse de courriel n est ecrite en dur');
    for (const f of [alerte, sos, index]) {
        if (!f) { continue; }
        faux('pas d adresse en dur dans le code', /@heeroo\.(fr|com|co)\b/.test(sansCommentaires(f)));
    }
}

// =====================================================================
const outil = trouverBabel();
if (!outil) {
    console.log('Babel introuvable : parties 1 et 2 sautees.');
} else {
    partieUn(outil);
    partieDeux(outil);
}
partieTrois();

if (echecs.length) {
    console.log('\n' + echecs.length + ' echec(s) :');
    echecs.forEach(e => console.log('  - ' + e));
    console.log('\nverifie-alerte-sos : ' + essais + ' essais, ' + echecs.length + ' echec(s).');
    process.exit(1);
}
console.log('verifie-alerte-sos : ' + essais + ' essais, tous passent.');
