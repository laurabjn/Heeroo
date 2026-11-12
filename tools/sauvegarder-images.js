#!/usr/bin/env node
// Sauvegarde des fichiers de Firebase Storage : pièces d'identité, assurances,
// permis, photos de profil et de véhicule.
//
//   node tools/sauvegarder-images.js              # la production
//   node tools/sauvegarder-images.js dev          # le développement
//
// Pourquoi un outil à part de tools/sauvegarder-base.sh. La base de données
// ne contient que des adresses d'images ; les images elles-mêmes vivent dans
// Storage, et leurs adresses publiques répondent 403 sans authentification.
// Sauvegarder la base sans elles rendrait des profils de chauffeurs sans
// aucune de leurs pièces — c'est-à-dire des dossiers inexploitables.
//
// La clé de compte de service n'est jamais lue par autre chose que ce script,
// jamais affichée, jamais recopiée. Elle donne un accès administrateur complet
// au projet : elle vit dans heeroo-credentials/, que .gitignore exclut.
//
// Le téléchargement est repris, pas refait : un fichier déjà présent avec la
// bonne taille est sauté. Relancer le script après une coupure reprend donc
// où il s'était arrêté, et une sauvegarde hebdomadaire ne retélécharge que ce
// qui a changé.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const PROJET = (process.argv[2] || 'prod').toLowerCase();

const SEAUX = {
    prod: 'projet-test-d7cd9.appspot.com',
    dev: 'heeroo-dev-49beb.firebasestorage.app',
};

const CLES = {
    prod: 'cle-service-prod.json',
    dev: 'cle-service-dev.json',
};

if (!SEAUX[PROJET]) {
    console.error('Projet inconnu : ' + PROJET + '  (attendu : prod ou dev)');
    process.exit(1);
}

const cheminCle = path.join(RACINE, 'heeroo-credentials', CLES[PROJET]);
if (!fs.existsSync(cheminCle)) {
    console.error('Clé de compte de service introuvable :');
    console.error('  ' + cheminCle);
    console.error('');
    console.error('Console Firebase > Paramètres du projet > Comptes de service >');
    console.error('Générer une nouvelle clé privée, puis déposer le fichier .json');
    console.error('sous ce nom exact.');
    process.exit(1);
}

let admin;
try {
    admin = require(path.join(RACINE, 'functions', 'node_modules', 'firebase-admin'));
} catch (erreur) {
    console.error('firebase-admin introuvable. Lancez d abord : cd functions && npm install');
    process.exit(1);
}

const DESTINATION = path.join(RACINE, '..', 'heeroo-sauvegardes-base', 'storage-' + PROJET);

// Un nom de fichier venu du nuage peut contenir des caractères que Windows
// refuse (: ? * " < > |) ou des morceaux de chemin remontants. On les remplace
// plutôt que d'échouer, et le manifeste garde le nom d'origine pour que la
// correspondance reste lisible.
function cheminLocal(nom) {
    const propre = nom
        .split('/')
        .filter((p) => p && p !== '.' && p !== '..')
        .map((p) => p.replace(/[:?*"<>|]/g, '_'))
        .join(path.sep);
    return path.join(DESTINATION, propre);
}

(async () => {
    admin.initializeApp({
        credential: admin.credential.cert(require(cheminCle)),
        storageBucket: SEAUX[PROJET],
    });
    const seau = admin.storage().bucket();

    console.log('Projet      : ' + PROJET + '  (' + SEAUX[PROJET] + ')');
    console.log('Destination : ' + DESTINATION);
    console.log('\nInventaire du seau...');

    let fichiers;
    try {
        [fichiers] = await seau.getFiles();
    } catch (erreur) {
        console.error('Inventaire impossible : ' + erreur.message);
        console.error('La clé donne-t-elle bien accès à ce projet ?');
        process.exit(1);
    }

    // Les dossiers apparaissent comme des objets vides au nom terminé par une
    // barre oblique : ils n'ont rien à télécharger.
    const reels = fichiers.filter((f) => !f.name.endsWith('/'));
    console.log('  ' + reels.length + ' fichiers.\n');

    const manifeste = [];
    let telecharges = 0;
    let sautes = 0;
    let echoues = 0;
    let octets = 0;

    for (const fichier of reels) {
        const taille = Number((fichier.metadata && fichier.metadata.size) || 0);
        const destination = cheminLocal(fichier.name);
        manifeste.push({
            nom: fichier.name,
            taille: taille,
            modifie: (fichier.metadata && fichier.metadata.updated) || null,
            md5: (fichier.metadata && fichier.metadata.md5Hash) || null,
            type: (fichier.metadata && fichier.metadata.contentType) || null,
        });

        // Déjà là, et de la bonne taille : on ne le retélécharge pas.
        if (fs.existsSync(destination) && fs.statSync(destination).size === taille && taille > 0) {
            sautes++;
            continue;
        }

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        try {
            await fichier.download({ destination: destination });
            telecharges++;
            octets += taille;
        } catch (erreur) {
            echoues++;
            console.log('  !! ' + fichier.name + ' — ' + erreur.message);
        }

        if ((telecharges + sautes) % 100 === 0) {
            console.log('  ' + (telecharges + sautes) + ' / ' + reels.length + '...');
        }
    }

    fs.mkdirSync(DESTINATION, { recursive: true });
    fs.writeFileSync(
        path.join(DESTINATION, 'manifeste.json'),
        JSON.stringify({ seau: SEAUX[PROJET], le: new Date().toISOString(), fichiers: manifeste }, null, 1),
        'utf8'
    );

    console.log('\n' + telecharges + ' téléchargés (' + (octets / 1048576).toFixed(1) + ' Mo), '
        + sautes + ' déjà à jour, ' + echoues + ' en échec.');
    console.log('Sauvegarde : ' + DESTINATION);
    // Un échec partiel doit se voir au code de retour : une sauvegarde
    // incomplète qui se termine « avec succès » est un piège.
    process.exit(echoues ? 1 : 0);
})().catch((erreur) => {
    console.error('\nÉchec : ' + erreur.message);
    process.exit(1);
});
