#!/usr/bin/env node
// Essais des messages d'erreur a la creation d'un compte.
//
//   node tools/verifie-inscription.js            # une ligne de resume
//   node tools/verifie-inscription.js --details  # le detail de chaque essai
//
// Pourquoi ces essais existent. Le bloc catch de l'ecran d'inscription
// affichait « Un autre compte utilise deja cette adresse e-mail » quelle que
// soit la raison du refus : coupure reseau, adresse mal formee, trop de
// tentatives, panne chez Google. La personne cherchait donc un probleme de
// compte la ou il n'y en avait pas. Corrige le 10 nov. 2026, en meme temps que
// la regle du mot de passe.
//
// Trois parties :
//
//   1. erreursAuth.js, compile par le Babel du projet puis execute : chaque
//      code d'erreur Firebase donne bien le message prevu, et tout ce qui
//      n'est pas un code connu retombe sur le message generique sans lever
//      d'exception.
//   2. Les dictionnaires. C'est la partie qui vaut le plus : la table cite des
//      cles par leur nom, et une cle absente afficherait « undefined » dans
//      l'alerte. Pire que le message faux qu'on vient d'enlever. On verifie
//      donc que CHAQUE cle citee existe en francais ET en anglais, dans les
//      deux applications, avec un texte non vide et reellement traduit.
//   3. Des controles de source : les deux ecrans se servent bien de la table,
//      plus aucun ne code le message en dur, et le catch ne vide plus
//      l'adresse saisie.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DRIVER = path.join(RACINE, 'heeroo-driver');
const RIDER = path.join(RACINE, 'heeroo-rider');
const APPS = [{ nom: 'passager', chemin: RIDER }, { nom: 'chauffeur', chemin: DRIVER }];

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
    for (const app of [DRIVER, RIDER]) {
        const p = path.join(app, 'node_modules', '@babel', 'core');
        if (fs.existsSync(p)) { return { babel: require(p), cwd: app }; }
    }
    return null;
}

function charger(fichier, outil) {
    const { babel, cwd } = outil;
    const { code } = babel.transformSync(fs.readFileSync(fichier, 'utf8'), {
        presets: ['babel-preset-expo'],
        babelrc: false,
        configFile: false,
        cwd: cwd,
        filename: fichier,
    });
    const mod = { exports: {} };
    const faussaire = (nom) => require(require.resolve(nom, { paths: [cwd] }));
    new Function('require', 'module', 'exports', code)(faussaire, mod, mod.exports);
    return mod.exports;
}

// La table est lue depuis le module quand Babel est disponible, et recopiee
// ici sinon, pour que les parties 2 et 3 tournent meme sans node_modules. Un
// essai compare les deux : si elles divergent, c'est ce fichier qui est
// perime, et il faut le remettre a jour plutot que de le croire.
const TABLE_ATTENDUE = {
    'auth/email-already-in-use': { cle: 'email_already_used', champ: 'email' },
    'auth/invalid-email': { cle: 'valid_email_check', champ: 'email' },
    'auth/missing-email': { cle: 'valid_email_check', champ: 'email' },
    'auth/weak-password': { cle: 'password_alphaNumeric_check', champ: 'motdepasse' },
    'auth/missing-password': { cle: 'password_alphaNumeric_check', champ: 'motdepasse' },
    'auth/network-request-failed': { cle: 'login_network', champ: null },
    'auth/too-many-requests': { cle: 'erreur_trop_de_tentatives', champ: null },
    'auth/operation-not-allowed': { cle: 'erreur_inscription_indisponible', champ: null },
    'auth/internal-error': { cle: 'erreur_inscription_inconnue', champ: null },
};
const DEFAUT_ATTENDU = { cle: 'erreur_inscription_inconnue', champ: null };

// =====================================================================
// 1. erreursAuth.js — la table, compilee et executee
// =====================================================================
function partieUn(outil) {
    const E = charger(path.join(outil.cwd, 'src', 'common', 'erreursAuth.js'), outil);

    titre('la table du module est bien celle qu attendent les essais');
    essai('la table est identique a celle recopiee ici', E.TABLE, TABLE_ATTENDUE);
    essai('et le repli aussi', E.PAR_DEFAUT, DEFAUT_ATTENDU);

    titre('chaque code Firebase donne le bon message');
    Object.keys(TABLE_ATTENDUE).forEach((code) => {
        essai(code, E.erreurInscription({ code: code }), TABLE_ATTENDUE[code]);
    });

    titre('une coupure reseau ne doit plus parler de compte existant');
    const reseau = E.erreurInscription({ code: 'auth/network-request-failed' });
    faux('elle ne renvoie pas email_already_used', reseau.cle === 'email_already_used');
    essai('elle renvoie le message de reseau', reseau.cle, 'login_network');
    essai('et ne deplace le curseur sur aucun champ', reseau.champ, null);

    titre('tout le reste retombe sur le message generique, sans exception');
    [
        { code: 'auth/code-qui-n-existe-pas' },
        { code: '' },
        { code: null },
        { code: 42 },
        {},
        new Error('panne'),
        null,
        undefined,
        'auth/email-already-in-use',
        0,
    ].forEach((valeur) => {
        let leve = false, resultat = null;
        try { resultat = E.erreurInscription(valeur); } catch (e) { leve = true; }
        faux('ne leve pas d exception sur ' + JSON.stringify(valeur), leve);
        essai('retombe sur le generique pour ' + JSON.stringify(valeur), resultat, DEFAUT_ATTENDU);
    });

    titre('les champs cites existent reellement dans les ecrans');
    // Un champ mal orthographie ne ferait rien du tout : le curseur ne
    // bougerait pas et personne ne s en apercevrait.
    const champs = Object.keys(E.TABLE).map(c => E.TABLE[c].champ).concat([E.PAR_DEFAUT.champ]);
    champs.forEach((champ) => {
        vrai('champ reconnu : ' + JSON.stringify(champ),
            champ === null || champ === 'email' || champ === 'motdepasse');
    });
}

// =====================================================================
// 2. Chaque cle citee existe, en francais et en anglais
// =====================================================================
function valeurDe(dico, cle) {
    const ligne = dico.split('\n').find(l => new RegExp('^\\s*' + cle + '\\s*:').test(l));
    if (!ligne) { return null; }
    const m = ligne.slice(ligne.indexOf(':') + 1).match(/^\s*(['"])([\s\S]*)\1\s*,?\s*$/);
    return m ? m[2] : null;
}

function partieDeux() {
    const citees = Object.keys(TABLE_ATTENDUE).map(c => TABLE_ATTENDUE[c].cle)
        .concat([DEFAUT_ATTENDU.cle])
        .filter((c, i, t) => t.indexOf(c) === i);

    APPS.forEach(({ nom, chemin }) => {
        titre(nom + ' : les messages cites par la table');
        const fr = lire(path.join(chemin, 'src/common/language.fr.js')) || '';
        const en = lire(path.join(chemin, 'src/common/language.en.js')) || '';

        citees.forEach((cle) => {
            const vfr = valeurDe(fr, cle);
            const ven = valeurDe(en, cle);
            vrai(cle + ' : existe en francais', vfr !== null);
            vrai(cle + ' : existe en anglais', ven !== null);
            vrai(cle + ' : le texte francais n est pas vide', !!vfr && vfr.trim().length > 3);
            vrai(cle + ' : le texte anglais n est pas vide', !!ven && ven.trim().length > 3);
            // Si les deux sont identiques, c est que le francais a ete recopie
            // dans le dictionnaire anglais sans etre traduit.
            faux(cle + ' : le texte anglais a bien ete traduit', !!vfr && vfr === ven);
        });
    });
}

// =====================================================================
// 3. Les ecrans se servent bien de la table
// =====================================================================
function partieTrois() {
    titre('les deux applications partagent exactement la meme table');
    const copies = APPS.map(a => lire(path.join(a.chemin, 'src/common/erreursAuth.js')));
    copies.forEach((c, i) => vrai(APPS[i].nom + ' : common/erreursAuth.js existe', !!c));
    vrai('les deux copies sont identiques, au caractere pres', copies[0] === copies[1]);

    APPS.forEach(({ nom, chemin }) => {
        titre(nom + ' : le bloc catch de l inscription');
        const src = lire(path.join(chemin, 'src/screens/EmailRegisterScreen.js')) || '';
        const vif = sansCommentaires(src);

        vrai('importe erreurInscription depuis common/erreursAuth',
            /import\s*\{\s*erreurInscription\s*\}\s*from\s*'\.\.\/common\/erreursAuth'/.test(vif));
        vrai('et s en sert, hors commentaire',
            /const\s*\{\s*cle\s*,\s*champ\s*\}\s*=\s*erreurInscription\(error\)/.test(vif));
        vrai('le message affiche vient de la cle renvoyee',
            /Alert\.alert\(languageJSON\.Error,\s*languageJSON\[cle\]\)/.test(vif));
        faux('plus aucun message code en dur dans le fichier',
            /languageJSON\.email_already_used/.test(src));
        vrai('le curseur revient sur l adresse quand c est elle le probleme',
            /champ === 'email'[\s\S]{0,60}this\.emailInput\.focus\(\)/.test(vif));
        vrai('et sur le mot de passe quand c est lui',
            /champ === 'motdepasse'[\s\S]{0,60}this\.passInput\.focus\(\)/.test(vif));

        // L adresse saisie doit survivre a l erreur : la retaper apres une
        // coupure reseau n aide personne.
        const debut = vif.indexOf('} catch (error) {');
        const bloc = debut >= 0 ? vif.slice(debut, vif.indexOf('\n                }', debut)) : '';
        vrai('le bloc catch a bien ete retrouve', bloc.length > 50);
        faux('il ne vide plus l adresse saisie', /email:\s*''/.test(bloc));
        vrai('il vide bien le mot de passe', /password:\s*''/.test(bloc));
        vrai('et la confirmation', /confirmpassword:\s*''/.test(bloc));
        vrai('et il arrete le chargement', /loading:\s*false/.test(bloc));
    });
}

function terminer() {
    if (echecs.length) {
        console.log('\n' + echecs.length + ' ECHEC(S) sur ' + essais + ' essais :');
        echecs.forEach(e => console.log('  - ' + e));
        process.exit(1);
    }
    console.log('verifie-inscription : ' + essais + ' essais, tous passent.');
    process.exit(0);
}

const outil = trouverBabel();
if (outil) {
    partieUn(outil);
} else {
    console.log('verifie-inscription : aucun node_modules d application installe, la partie 1 est sautee.');
}
partieDeux();
partieTrois();
terminer();
