#!/usr/bin/env node
// Essais du bouton SOS du chauffeur.
//
//   node tools/verifie-sos.js            # une ligne de resume
//   node tools/verifie-sos.js --details  # le detail de chaque essai
//
// Trois parties, et la troisieme est la plus importante :
//
//   1. urgences.js — les fonctions pures : quel numero pour quel pays, ce que
//      « tel: » accepte, la lecture de la table Reglages et l'interrupteur.
//   2. sos.js — le comportement reel. react-native et firebase sont remplaces
//      par des doublures qui ENREGISTRENT ce qu'on leur demande : on verifie
//      donc le dialogue reellement construit et le numero reellement compose,
//      pas une intention.
//   3. Le SOS est la ou il doit etre, et nulle part ailleurs. Le 10 nov. 2026,
//      les deux premieres parties passaient toutes pendant que le bouton etait
//      pose sur « Mes reservations » au lieu de l'ecran d'attente : la logique
//      etait juste, l'ecran non. Aucun essai unitaire ne pouvait le voir. Les
//      controles de source de la partie 3 le voient.
//
// Les modules sont transformes par le Babel du projet puis executes : ce ne
// sont pas des assertions sur du papier.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DRIVER = path.join(RACINE, 'heeroo-driver');
const RIDER = path.join(RACINE, 'heeroo-rider');
const ADMIN = path.join(RACINE, 'heeroo-admin');

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
function titre(t) { if (details) { console.log('\n--- ' + t + ' ---'); } }
function lire(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }

// Une ligne mise en commentaire ne compte pas : un rightComponent commente est
// precisement ce qui occupait le creneau de l'en-tete avant le SOS.
function sansCommentaires(src) {
    return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
}

// Babel vit dans les node_modules d'une application, et la CI n'en installe
// qu'une a la fois. On prend celle qui est disponible ; sans aucune, les
// parties 1 et 2 sont sautees et la partie 3 tourne quand meme.
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
    // Le repli resout depuis les node_modules de l'application — les aides
    // @babel/runtime y vivent — et non depuis le dossier de ce script.
    const faussaire = (nom) => (nom in fausses)
        ? fausses[nom]
        : require(require.resolve(nom, { paths: [cwd] }));
    new Function('require', 'module', 'exports', code)(faussaire, mod, mod.exports);
    return mod.exports;
}

// =====================================================================
// 1. urgences.js — les fonctions pures
// =====================================================================
function partieUn(outil) {
    const U = charger(path.join(DRIVER, 'src', 'common', 'urgences.js'), outil, {});

    titre('numeroUrgence : le pays decide, et il y a toujours une reponse');
    essai('France', U.numeroUrgence('FR'), '112');
    essai('Belgique', U.numeroUrgence('BE'), '112');
    essai('Allemagne', U.numeroUrgence('DE'), '112');
    essai('Polynesie francaise', U.numeroUrgence('PF'), '112');
    essai('Senegal', U.numeroUrgence('SN'), '17');
    essai('Etats-Unis', U.numeroUrgence('US'), '911');
    essai('Gambie', U.numeroUrgence('GM'), '117');
    essai('minuscules acceptees', U.numeroUrgence('sn'), '17');
    // Cameroun et Benin n'ont volontairement aucun numero inscrit : les seules
    // sources trouvees se contredisaient. Un repli sur le 112 vaut mieux
    // qu'un numero invente.
    essai('Cameroun, non verifie, replie sur 112', U.numeroUrgence('CM'), '112');
    essai('Benin, non verifie, replie sur 112', U.numeroUrgence('BJ'), '112');
    essai('pays inconnu', U.numeroUrgence('XX'), '112');
    essai('pays absent', U.numeroUrgence(null), '112');
    essai('pays vide', U.numeroUrgence(''), '112');

    titre('numeroAppelable : ce que « tel: » accepte');
    essai('espaces du back-office', U.numeroAppelable('+33 7 12 12 12 12'), '+33712121212');
    essai('tirets et points', U.numeroAppelable('06-12.34 56-78'), '0612345678');
    essai('parentheses', U.numeroAppelable('+1 (555) 342-3434'), '+15553423434');
    essai('+ au milieu retire', U.numeroAppelable('06+12345678'), '0612345678');
    essai('+ en tete garde', U.numeroAppelable('+221771234567'), '+221771234567');
    essai('lettres retirees', U.numeroAppelable('appeler 112 svp'), '112');
    essai('chaine vide', U.numeroAppelable(''), null);
    essai('null', U.numeroAppelable(null), null);

    titre('numeroUtilisable : ne pas offrir un choix qui echouera');
    essai('vrai numero', U.numeroUtilisable('+33 7 12 12 12 12'), true);
    essai('chaine vide', U.numeroUtilisable(''), false);
    essai('espaces seuls', U.numeroUtilisable('   '), false);
    essai('texte sans chiffre', U.numeroUtilisable('a renseigner'), false);
    essai('trop court', U.numeroUtilisable('17'), false);
    essai('quatre chiffres', U.numeroUtilisable('1234'), true);

    titre('numeroHeeroo : settings/ arrive en tableau OU en objet');
    const enTableau = [
        { country: 'FR', panic: '+33 7 12 12 12 12' },
        { country: 'SN', panic: '+221 7 12 12 12 13' },
        { country: 'GM', panic: null },
        { country: 'PF' },
    ];
    const enObjet = { 0: enTableau[0], 1: enTableau[1], 2: enTableau[2], 3: enTableau[3] };
    essai('FR dans un tableau', U.numeroHeeroo(enTableau, 'FR'), '+33 7 12 12 12 12');
    essai('FR dans un objet', U.numeroHeeroo(enObjet, 'FR'), '+33 7 12 12 12 12');
    essai('panic null, pas de choix Heeroo', U.numeroHeeroo(enTableau, 'GM'), null);
    essai('panic absent, pas de choix Heeroo', U.numeroHeeroo(enTableau, 'PF'), null);
    essai('pays absent de la table', U.numeroHeeroo(enTableau, 'US'), null);
    essai('settings null', U.numeroHeeroo(null, 'FR'), null);
    essai('ligne nulle dans la liste', U.numeroHeeroo([null, enTableau[0]], 'FR'), '+33 7 12 12 12 12');

    titre('sosCoupe : l interrupteur du back-office, pays par pays');
    const coupeFR = [{ country: 'FR', sosCoupe: true }, { country: 'SN' }];
    essai('cochee en France', U.sosActif(coupeFR, 'FR'), false);
    essai('le Senegal n est pas touche', U.sosActif(coupeFR, 'SN'), true);
    essai('saisie a la main dans la console Firebase', U.sosActif([{ country: 'FR', sosCoupe: 'true' }], 'FR'), false);
    essai('decochee', U.sosActif([{ country: 'FR', sosCoupe: false }], 'FR'), true);
    // Le champ n'existe dans aucune ligne de production : son absence doit
    // valoir ACTIF, faute de quoi le bouton s eteindrait partout d un coup.
    essai('champ absent, donc actif', U.sosActif([{ country: 'FR' }], 'FR'), true);
    essai('settings illisibles, donc actif', U.sosActif(null, 'FR'), true);
    essai('pays inconnu, donc actif', U.sosActif([{ country: 'FR' }], 'ZZ'), true);

    titre('le point essentiel : les secours restent joignables partout');
    let toujours = true;
    ['FR', 'BE', 'SN', 'US', 'DE', 'GM', 'CM', 'BJ', 'PF', 'XX', '', null, undefined].forEach(p => {
        const n = U.numeroAppelable(U.numeroUrgence(p));
        if (!n || n.replace(/\D/g, '').length < 2) { toujours = false; }
    });
    essai('un numero composable pour chaque pays, connu ou non', toujours, true);

    return U;
}

// =====================================================================
// 2. sos.js — le dialogue reellement construit, le numero reellement compose
// =====================================================================
async function partieDeux(outil, U) {
    let dialogue = null;
    let appel = null;
    const reactNative = {
        Alert: { alert: (t, message, boutons) => { dialogue = { titre: t, message: message, boutons: boutons }; } },
        Linking: { openURL: (url) => { appel = url; return Promise.resolve(); } },
    };
    let leve = false;
    let utilisateur = null;
    let reponses = {};
    const firebase = {
        auth: () => {
            if (leve) { throw new Error('firebase casse'); }
            return { currentUser: utilisateur };
        },
        database: () => ({
            ref: (chemin) => ({
                once: () => {
                    const v = reponses[chemin];
                    if (v instanceof Error) { return Promise.reject(v); }
                    if (v === undefined) { return Promise.reject(new Error('chemin non prevu : ' + chemin)); }
                    return Promise.resolve({ val: () => v });
                },
            }),
        }),
    };
    const langue = {
        cancel: 'Annuler',
        panic_text: 'Appel SOS',
        panic_question: 'Qui souhaitez-vous appeler ?',
        panic_secours: 'Appeler les secours',
        panic_operateur: 'Appeler Heeroo',
        panic_echec: 'Impossible',
    };
    const SOS = charger(path.join(DRIVER, 'src', 'common', 'sos.js'), outil, {
        'react-native': reactNative,
        'firebase/compat/app': firebase,
        'firebase/compat/auth': {},
        'firebase/compat/database': {},
        './language': langue,
        './urgences': U,
        // Le signalement a Heeroo est inerte ici : il a sa propre suite,
        // tools/verifie-alerte-sos.js. Sans cette doublure, sos.js tenterait
        // de resoudre ./alerteSOS depuis la racine de l'application.
        './alerteSOS': { signalerAppel: () => true },
    });
    const libelles = () => dialogue.boutons.map(b => b.text);
    // Si le bouton attendu n'existe pas, on le dit et on rend null. Sans ce
    // garde-fou, une simple erreur de libelle faisait planter le script sur
    // « undefined.onPress », et la vraie cause disparaissait derriere une
    // trace d'erreur au lieu d'apparaitre dans la liste des echecs.
    const appuyer = (texte) => {
        appel = null;
        const bouton = dialogue.boutons.find(b => b.text === texte);
        if (!bouton) {
            echecs.push('bouton introuvable : « ' + texte + ' »   (presents : ' + JSON.stringify(libelles()) + ')');
            essais++;
            return null;
        }
        bouton.onPress();
        return appel;
    };

    titre('le pire des cas : rien n a pu etre charge');
    SOS.ouvrirSOS(null);
    vrai('le dialogue s ouvre quand meme', dialogue !== null);
    essai('titre', dialogue.titre, 'Appel SOS');
    essai('question', dialogue.message, 'Qui souhaitez-vous appeler ?');
    essai('deux choix, sans Heeroo', libelles(), ['Annuler', 'Appeler les secours (112)']);
    essai('et il compose vraiment', appuyer('Appeler les secours (112)'), 'tel:112');

    titre('Senegal, avec un numero Heeroo');
    SOS.ouvrirSOS({ pays: 'SN', operateur: '+221 77 130 87 33', actif: true });
    essai('trois choix', libelles(), ['Annuler', 'Appeler Heeroo', 'Appeler les secours (17)']);
    // Sur Android, le dernier bouton du tableau est le plus mis en avant.
    essai('les secours en dernier', libelles()[libelles().length - 1], 'Appeler les secours (17)');
    essai('Heeroo compose le bon numero, espaces retires', appuyer('Appeler Heeroo'), 'tel:+221771308733');
    essai('les secours composent le 17', appuyer('Appeler les secours (17)'), 'tel:17');
    essai('le bouton secours est marque destructif', dialogue.boutons[2].style, 'destructive');
    essai('Annuler est marque cancel', dialogue.boutons[0].style, 'cancel');

    titre('numero Heeroo vide : Heeroo disparait, les secours restent');
    SOS.ouvrirSOS({ pays: 'BE', operateur: null, actif: true });
    essai('deux choix', libelles(), ['Annuler', 'Appeler les secours (112)']);

    titre('pays inconnu : repli sur le 112');
    SOS.ouvrirSOS({ pays: 'ZZ', operateur: null, actif: true });
    essai('deux choix', libelles(), ['Annuler', 'Appeler les secours (112)']);

    titre('chargerSOS ne rejette JAMAIS et tombe EN MARCHE');
    utilisateur = { uid: 'abc' };
    leve = false;
    reponses = { 'users/abc/country': 'FR', 'settings/': [{ country: 'FR', panic: '+33 6 00 00 00 00' }] };
    essai('chargement complet', await SOS.chargerSOS(), { pays: 'FR', operateur: '+33 6 00 00 00 00', actif: true });

    reponses = { 'users/abc/country': 'FR', 'settings/': [{ country: 'FR', panic: '+33 6 00 00 00 00', sosCoupe: true }] };
    essai('coupe depuis le back-office', (await SOS.chargerSOS()).actif, false);

    utilisateur = null;
    reponses = {};
    essai('session absente', await SOS.chargerSOS(), { pays: null, operateur: null, actif: true });

    leve = true;
    essai('firebase qui leve', await SOS.chargerSOS(), { pays: null, operateur: null, actif: true });

    leve = false;
    utilisateur = { uid: 'abc' };
    reponses = { 'users/abc/country': new Error('reseau coupe') };
    essai('reseau coupe sur le pays', await SOS.chargerSOS(), { pays: null, operateur: null, actif: true });

    reponses = { 'users/abc/country': 'FR', 'settings/': new Error('reseau coupe') };
    essai('reseau coupe sur les reglages', await SOS.chargerSOS(), { pays: 'FR', operateur: null, actif: true });

    titre('et apres chacun de ces echecs, l appel reste possible');
    SOS.ouvrirSOS(await SOS.chargerSOS());
    essai('les secours sont toujours la', appuyer('Appeler les secours (112)'), 'tel:112');
}

// =====================================================================
// 3. Le SOS est la ou il doit etre, et nulle part ailleurs
// =====================================================================
function partieTrois() {
    titre('le chauffeur atteint le SOS depuis l ecran ou il attend');
    // DriverTripAccept est l'ecran d'ouverture de l'application, et celui ou le
    // chauffeur reste tant qu'il n'a pas accepte de course. RideListScreen,
    // « Mes reservations », est un ecran secondaire du tiroir : y poser le
    // bouton ne suffit pas, et c'est l'erreur du 10 nov. 2026.
    const accueil = sansCommentaires(lire(path.join(DRIVER, 'src/screens/DriverTripAccept.js')) || '');
    vrai('DriverTripAccept importe BoutonSOS', /import\s+BoutonSOS\s+from/.test(accueil));
    vrai('et l affiche dans son en-tete, hors commentaire', /rightComponent=\{\s*<BoutonSOS/.test(accueil));

    const menu = sansCommentaires(lire(path.join(DRIVER, 'src/components/SideMenu.js')) || '');
    vrai('le tiroir porte la meme action', /ouvrirSOS\(/.test(menu));
    vrai('et il sait se couper', /actif\s*===\s*false/.test(menu));

    const bouton = lire(path.join(DRIVER, 'src/components/BoutonSOS.js')) || '';
    vrai('BoutonSOS existe', bouton.length > 0);
    vrai('il disparait quand le back-office le coupe', /actif\s*===\s*false/.test(bouton) && /return null/.test(bouton));
    // Sans cet etat de depart, le bouton clignoterait : absent le temps du
    // chargement, puis apparaissant.
    vrai('et il est actif tant qu on ne sait pas', /actif:\s*true/.test(bouton));

    titre('les cinq textes existent dans les deux langues');
    const CLES = ['panic_text', 'panic_question', 'panic_secours', 'panic_operateur', 'panic_echec'];
    ['fr', 'en'].forEach(lg => {
        const dico = lire(path.join(DRIVER, 'src/common/language.' + lg + '.js')) || '';
        CLES.forEach(c => vrai(c + ' (' + lg + ')', new RegExp('^\\s*' + c + ':', 'm').test(dico)));
    });

    titre('le SOS est une fonction chauffeur : rien cote passager');
    // Decision du client, le 9 nov. 2026. L'application passager avait recu le
    // bouton, puis il a ete retire.
    const trouves = [];
    const parcourir = (d) => {
        if (!fs.existsSync(d)) { return; }
        fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { parcourir(p); return; }
            if (!/\.js$/.test(e.name)) { return; }
            if (/BoutonSOS|ouvrirSOS|chargerSOS/.test(fs.readFileSync(p, 'utf8'))) {
                trouves.push(path.relative(RIDER, p).replace(/\\/g, '/'));
            }
        });
    };
    parcourir(path.join(RIDER, 'src'));
    essai('aucune trace du SOS dans l application passager', trouves, []);

    titre('l interrupteur existe dans le back-office');
    // Sans ces deux lignes, la case promise au client disparait de la table
    // Reglages sans que rien ne casse : sosCoupe ne serait plus jamais ecrit,
    // et le bouton resterait allume partout.
    const reglages = lire(path.join(ADMIN, 'src/views/Settings.js')) || '';
    vrai('la colonne sosCoupe est dans la table Reglages', /field:\s*'sosCoupe'/.test(reglages));
    const dicoAdmin = lire(path.join(ADMIN, 'src/config/language.js')) || '';
    vrai('et elle porte un libelle', /sos_coupe:/.test(dicoAdmin));
}

function terminer() {
    if (echecs.length) {
        console.log('\n' + echecs.length + ' ECHEC(S) sur ' + essais + ' essais :');
        echecs.forEach(e => console.log('  - ' + e));
        process.exit(1);
    }
    console.log('verifie-sos : ' + essais + ' essais, tous passent.');
    process.exit(0);
}

(async () => {
    const outil = trouverBabel();
    if (outil) {
        const U = partieUn(outil);
        await partieDeux(outil, U);
    } else {
        console.log('verifie-sos : aucun node_modules d application installe, les parties 1 et 2 sont sautees.');
    }
    partieTrois();
    terminer();
})();
