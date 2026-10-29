#!/usr/bin/env node
// Compare les dictionnaires francais et anglais de chaque application.
//
// Une cle presente d'un seul cote, c'est un ecran qui affichera « undefined »
// dans une langue et pas dans l'autre — un defaut invisible en developpement,
// puisque le dictionnaire francais est complet et sert de defaut.
//
//   node scripts/verifie-dictionnaires.js
//
// Sortie vide et code 0 : les dictionnaires concordent.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

const APPS = [
    { nom: 'heeroo-driver', dossier: 'heeroo-driver/src/common' },
    { nom: 'heeroo-rider', dossier: 'heeroo-rider/src/common' },
];

// Les cles du dictionnaire, en debut de ligne, avant le deux-points. On ignore
// les lignes de commentaire pour ne pas confondre une explication avec une cle.
function clesDe(chemin) {
    const lignes = fs.readFileSync(chemin, 'utf8').split(/\r?\n/);
    const cles = [];
    for (const ligne of lignes) {
        if (/^\s*\/\//.test(ligne)) continue;
        const trouve = ligne.match(/^\s{4}([A-Za-z_$][\w$]*)\s*:/);
        if (trouve) cles.push(trouve[1]);
    }
    return cles;
}

function doublons(cles) {
    const vues = new Set();
    const repetees = new Set();
    for (const cle of cles) {
        if (vues.has(cle)) repetees.add(cle);
        vues.add(cle);
    }
    return [...repetees];
}

let defauts = 0;

for (const app of APPS) {
    const fr = path.join(RACINE, app.dossier, 'language.fr.js');
    const en = path.join(RACINE, app.dossier, 'language.en.js');

    const clesFr = clesDe(fr);
    const clesEn = clesDe(en);

    const manquantesEn = clesFr.filter((cle) => !clesEn.includes(cle));
    const manquantesFr = clesEn.filter((cle) => !clesFr.includes(cle));
    const doublesFr = doublons(clesFr);
    const doublesEn = doublons(clesEn);

    console.log(`${app.nom} : ${clesFr.length} cles en francais, ${clesEn.length} en anglais`);

    if (manquantesEn.length) {
        defauts += manquantesEn.length;
        console.log(`  absentes de l'anglais : ${manquantesEn.join(', ')}`);
    }
    if (manquantesFr.length) {
        defauts += manquantesFr.length;
        console.log(`  absentes du francais : ${manquantesFr.join(', ')}`);
    }
    if (doublesFr.length) {
        defauts += doublesFr.length;
        console.log(`  en double dans le francais : ${doublesFr.join(', ')}`);
    }
    if (doublesEn.length) {
        defauts += doublesEn.length;
        console.log(`  en double dans l'anglais : ${doublesEn.join(', ')}`);
    }
}

if (defauts) {
    console.log(`\n${defauts} ecart(s).`);
    process.exit(1);
}

console.log('\nLes dictionnaires concordent.');
