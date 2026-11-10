#!/usr/bin/env node
// Essais de la regle du mot de passe a l'inscription.
//
//   node tools/verifie-mot-de-passe.js            # une ligne de resume
//   node tools/verifie-mot-de-passe.js --details  # le detail de chaque essai
//
// Pourquoi ces essais existent. Le 10 nov. 2026 le client signale que « sur
// certains telephones, il demande un mot de passe long et complique » a la
// creation d'un compte. Les telephones n'exigeaient rien : c'etait
// l'application qui refusait, avec /^([a-zA-Z0-9@*#]{8,15})$/, tout mot de
// passe depassant quinze caracteres ou contenant autre chose que des lettres,
// des chiffres et @ * #. Or le gestionnaire de mots de passe de Google, actif
// sur une bonne partie des Android, propose exactement cela : quinze a vingt
// caracteres avec des tirets. D'ou « certains telephones » — ceux ou le
// gestionnaire propose, et seulement ceux-la.
//
// Deux parties :
//
//   1. motDePasse.js, compile par le Babel du projet puis execute. On y
//      verifie surtout le cas qui a casse : un mot de passe du type de ceux
//      que Google propose doit passer, alors que l'ancienne regle le
//      refusait. L'ancienne regle est recopiee ici pour que l'essai montre
//      noir sur blanc ce qui a change.
//   2. Des controles de source : la regle n'est plus ecrite nulle part
//      ailleurs, les deux applications partagent la meme, le message dit la
//      verite, et la CONNEXION ne verifie toujours rien. Ce dernier point est
//      le plus important de tous : si un jour quelqu'un applique cette regle
//      a la connexion, tous les comptes dont le mot de passe ne la respecte
//      pas se retrouvent dehors, sans recours.
//
// Cote serveur, Firebase impose son propre minimum, interroge le 10 nov. 2026
// sur projet-test-d7cd9 : six caracteres, 4096 au maximum, aucune contrainte
// de composition. Notre huit est donc plus strict que le serveur : tout ce que
// l'application accepte, Firebase l'accepte aussi.

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

// Babel vit dans les node_modules d'une application, et la CI n'en installe
// qu'une a la fois. On prend celle qui est disponible ; sans aucune, la
// partie 1 est sautee et la partie 2 tourne quand meme.
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
    // Le repli resout depuis les node_modules de l'application — les aides
    // @babel/runtime y vivent — et non depuis le dossier de ce script.
    const faussaire = (nom) => require(require.resolve(nom, { paths: [cwd] }));
    new Function('require', 'module', 'exports', code)(faussaire, mod, mod.exports);
    return mod.exports;
}

// =====================================================================
// 1. motDePasse.js — la regle elle-meme, compilee et executee
// =====================================================================

// L'ancienne regle, recopiee telle quelle. Elle ne sert qu'a documenter la
// difference : chaque fois qu'on l'invoque, c'est pour montrer qu'elle
// refusait ce que la nouvelle accepte.
const ANCIENNE = /^([a-zA-Z0-9@*#]{8,15})$/;

// Le genre de mot de passe que le gestionnaire de Google propose : seize a
// vingt caracteres, des tirets, des symboles. C'est le cas qui a casse.
const PROPOSES_PAR_GOOGLE = [
    'Kpx7-mQv2#rTn9Ls',
    'uX4b-Hm9k-Rt2Qw7',
    'zT8vNq3_Lk6Rm1Pd9Xs',
    'Jq5!wZ2e-Vn8Tb4Ck',
];

function partieUn(outil) {
    const M = charger(path.join(outil.cwd, 'src', 'common', 'motDePasse.js'), outil);
    const ok = M.motDePasseValide;

    titre('la longueur minimale, et ses bords exacts');
    essai('le minimum annonce est 8', M.LONGUEUR_MINIMALE, 8);
    faux('vide refuse', ok(''));
    faux('sept caracteres refuses', ok('1234567'));
    vrai('huit caracteres acceptes', ok('12345678'));
    vrai('neuf caracteres acceptes', ok('123456789'));

    titre('le cas qui a casse : ce que Google propose doit passer');
    PROPOSES_PAR_GOOGLE.forEach((mdp) => {
        vrai('accepte « ' + mdp + ' » (' + mdp.length + ' caracteres)', ok(mdp));
        // Si cet essai tombe, c'est que quelqu'un a remis une regle de
        // composition : l'ancienne refusait ces mots de passe, la nouvelle non.
        faux('et l ancienne regle le refusait bien : ' + mdp, ANCIENNE.test(mdp));
    });

    titre('plus de plafond a quinze caracteres');
    vrai('seize caracteres', ok('abcdefghijklmnop'));
    vrai('trente-deux caracteres', ok('a'.repeat(32)));
    vrai('cent caracteres', ok('a'.repeat(100)));
    faux('quinze caracteres etaient la limite d avant', ANCIENNE.test('abcdefghijklmnop'));

    titre('plus de caracteres interdits');
    ['mot-de-passe', 'mot_de_passe', 'mot.de.passe', 'mot de passe',
        'motdepasse!', 'motdepasse?', 'Patisserie2024', 'EteADakar1',
        'passe+fort', 'cafe&the12', 'apostrophe-ici', 'accolade{}la',
        'barre|verticale', 'pourcent%25'].forEach((mdp) => {
        vrai('accepte « ' + mdp + ' »', ok(mdp));
    });
    faux('alors que l ancienne refusait un simple tiret', ANCIENNE.test('mot-de-passe'));
    faux('et un simple point', ANCIENNE.test('mot.de.passe'));
    faux('et un espace', ANCIENNE.test('mot de passe'));
    vrai('les accents passent aussi', ok('PatisserieEte2024'));

    titre('ce qui n est pas une chaine ne doit pas faire exploser l ecran');
    [null, undefined, 12345678, 123, {}, [], true, NaN].forEach((valeur) => {
        let leve = false, resultat = null;
        try { resultat = ok(valeur); } catch (e) { leve = true; }
        faux('ne leve pas d exception sur ' + String(valeur), leve);
        faux('et refuse ' + String(valeur), resultat);
    });
}

// =====================================================================
// 2. La regle n'est ecrite qu'a un seul endroit, et le message dit vrai
// =====================================================================
function partieDeux() {
    titre('les deux applications partagent exactement la meme regle');
    const copies = APPS.map(a => lire(path.join(a.chemin, 'src/common/motDePasse.js')));
    copies.forEach((c, i) => vrai(APPS[i].nom + ' : common/motDePasse.js existe', !!c));
    vrai('les deux copies sont identiques, au caractere pres', copies[0] === copies[1]);

    APPS.forEach(({ nom, chemin }) => {
        titre(nom + ' : l ecran d inscription');
        const src = lire(path.join(chemin, 'src/screens/EmailRegisterScreen.js')) || '';
        const vif = sansCommentaires(src);

        vrai('importe motDePasseValide depuis common/motDePasse',
            /import\s*\{\s*motDePasseValide\s*\}\s*from\s*'\.\.\/common\/motDePasse'/.test(vif));
        vrai('et s en sert pour valider, hors commentaire',
            /passwordValid\s*=\s*motDePasseValide\(password\)/.test(vif));
        faux('l ancienne expression reguliere a disparu', /regx1/.test(src));
        faux('et son plafond de quinze caracteres avec elle', /\{8,15\}/.test(src));
        vrai('la confirmation du mot de passe est toujours comparee',
            /password\s*==\s*confirmpassword/.test(vif));

        titre(nom + ' : la connexion ne verifie toujours RIEN');
        // Le garde-fou le plus important du fichier. Appliquer cette regle a la
        // connexion mettrait dehors tout compte deja cree dont le mot de passe
        // ne la respecte pas, et il n'y aurait aucun recours.
        const connexion = sansCommentaires(lire(path.join(chemin, 'src/screens/EmailLoginScreen.js')) || '');
        faux('aucun appel a validatePassword a la connexion', /this\.validatePassword\(/.test(connexion));
        faux('aucun appel a motDePasseValide a la connexion', /motDePasseValide\(/.test(connexion));

        titre(nom + ' : le message affiche dit la verite');
        const attendus = {
            'language.fr.js': 'Le mot de passe doit comporter au moins 8 caractères.',
            'language.en.js': 'The password must be at least 8 characters long.',
        };
        Object.keys(attendus).forEach((dico) => {
            const d = lire(path.join(chemin, 'src/common', dico)) || '';
            const ligne = d.split('\n').find(l => l.includes('password_alphaNumeric_check:')) || '';
            vrai(dico + ' : la cle existe', !!ligne);
            // Le nom de la cle contient « alphaNumeric » : on ne controle que
            // la valeur, sinon le nom de la cle ferait echouer l essai suivant.
            const valeur = ligne.slice(ligne.indexOf(':') + 1);
            vrai(dico + ' : le message est a jour', valeur.indexOf(attendus[dico]) >= 0);
            faux(dico + ' : ne promet plus « 8 a 15 »', /8 à 15|8 to 15/.test(valeur));
            faux(dico + ' : ne parle plus d alphanumerique', /alphanum/i.test(valeur));
            // Le nombre annonce doit etre celui de la regle. Sans cet essai,
            // changer LONGUEUR_MINIMALE laisserait un message qui ment.
            const chiffre = (ligne.match(/(\d+)/) || [])[1];
            essai(dico + ' : le nombre annonce est bien 8', chiffre, '8');
        });
    });
}

function terminer() {
    if (echecs.length) {
        console.log('\n' + echecs.length + ' ECHEC(S) sur ' + essais + ' essais :');
        echecs.forEach(e => console.log('  - ' + e));
        process.exit(1);
    }
    console.log('verifie-mot-de-passe : ' + essais + ' essais, tous passent.');
    process.exit(0);
}

const outil = trouverBabel();
if (outil) {
    partieUn(outil);
} else {
    console.log('verifie-mot-de-passe : aucun node_modules d application installe, la partie 1 est sautee.');
}
partieDeux();
terminer();
