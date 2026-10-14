// Prépare l'ouverture de nouveaux pays : complète rates/car_type.
//
//   node tools/ouvrir-pays.js tarifs-actuels.json                  # aperçu
//   node tools/ouvrir-pays.js tarifs-actuels.json --ecrire out.json
//   node tools/ouvrir-pays.js tarifs-actuels.json --pays CI,ML,BF
//
// L'application cherche le tarif par correspondance stricte du pays
// (FareScreen : `car_type[i].name == carType && car_type[i].country == country`).
// Un pays sans ligne ne peut donc rien réserver : aucun prix ne se calcule.
// Cocher le pays dans la Play Console ne suffit pas.
//
// Ce script n'écrit rien dans la base. Il lit un export, calcule ce qui manque,
// affiche le résultat, et peut produire un fichier à relire avant de l'appliquer.
//
//   npx firebase-tools database:get /rates/car_type --project prod > tarifs-actuels.json
//   node tools/ouvrir-pays.js tarifs-actuels.json --ecrire nouveaux-tarifs.json
//   npx firebase-tools database:set /rates/car_type nouveaux-tarifs.json --project prod
const fs = require('fs');
const path = require('path');

// Seules ces monnaies sont converties, faute de quoi les tarifs saisis en euros
// s'appliqueraient tels quels (voir FareCalculator). Le franc CFA est arrimé à
// l'euro à parité fixe : aucun taux de change en ligne n'est nécessaire.
const MONNAIES_SUPPORTEES = new Set(['EUR', 'XOF', 'XAF']);

const CURRENCIES = require(path.join(__dirname, '..', 'heeroo-rider', 'src', 'constants', 'countryCurrency.json'));

/** Pays dont la monnaie est convertible sans taux de change externe. */
function paysOuvrables() {
  return Object.entries(CURRENCIES)
    .filter(([, monnaie]) => MONNAIES_SUPPORTEES.has(monnaie))
    .map(([pays]) => pays)
    .sort();
}

/**
 * Le pays modèle dont on recopie les tarifs : la France pour la zone euro, le
 * Sénégal pour la zone franc CFA. Les prix sont saisis en euros puis convertis,
 * mais le niveau de vie n'est pas le même : un tarif parisien appliqué à Bamako
 * serait hors de prix. Recopier le modèle de la bonne zone donne un point de
 * départ cohérent, à ajuster ensuite pays par pays dans le back-office.
 */
function modelePour(pays) {
  return CURRENCIES[pays] === 'EUR' ? 'FR' : 'SN';
}

function lire(fichier) {
  const brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  // La base rend tantôt un tableau, tantôt un objet indexé selon les trous.
  const lignes = Array.isArray(brut) ? brut : Object.values(brut || {});
  return lignes.filter(Boolean);
}

function main() {
  const [fichier, ...options] = process.argv.slice(2);
  if (!fichier) {
    console.error('Usage : node tools/ouvrir-pays.js <export-rates.json> [--pays CI,ML] [--ecrire sortie.json]');
    process.exit(1);
  }

  const valeur = (nom) => {
    const i = options.indexOf(nom);
    return i >= 0 ? options[i + 1] : null;
  };

  const lignes = lire(fichier);
  const demandes = valeur('--pays');
  const cibles = demandes ? demandes.split(',').map((p) => p.trim().toUpperCase()) : paysOuvrables();

  const refuses = cibles.filter((p) => !MONNAIES_SUPPORTEES.has(CURRENCIES[p]));
  if (refuses.length) {
    console.error(`\nPays écartés, monnaie non convertible : ${refuses.join(', ')}`);
    console.error('Leurs tarifs s\'appliqueraient sans conversion, donc très en dessous du prix réel.\n');
  }
  const retenus = cibles.filter((p) => MONNAIES_SUPPORTEES.has(CURRENCIES[p]));

  // Gammes à décliner, prises sur chaque modèle.
  const modeles = {};
  for (const modele of ['FR', 'SN']) {
    modeles[modele] = lignes.filter((l) => String(l.country).toUpperCase() === modele);
  }
  for (const [modele, gammes] of Object.entries(modeles)) {
    if (gammes.length === 0) {
      console.error(`Modèle ${modele} introuvable dans l'export : impossible de décliner ses gammes.`);
      process.exit(1);
    }
  }

  const existe = new Set(lignes.map((l) => `${String(l.country).toUpperCase()}|${l.name}`));
  const ajouts = [];
  const rapport = [];

  for (const pays of retenus) {
    const modele = modelePour(pays);
    const manquantes = modeles[modele].filter((g) => !existe.has(`${pays}|${g.name}`));
    if (manquantes.length === 0) continue;
    for (const gamme of manquantes) {
      const ligne = { ...gamme, country: pays };
      delete ligne.tableData;   // renuméroté plus bas, sur l'ensemble
      ajouts.push(ligne);
    }
    rapport.push({
      pays,
      monnaie: CURRENCIES[pays],
      modele,
      ajoutees: manquantes.map((g) => g.name).join(', '),
    });
  }

  const final = [...lignes, ...ajouts].map((ligne, i) => ({ ...ligne, tableData: { id: i } }));

  console.log(`\n${lignes.length} lignes existantes, ${ajouts.length} à ajouter, ${final.length} au total.\n`);
  if (rapport.length === 0) {
    console.log('Rien à faire : tous les pays demandés ont déjà toutes leurs gammes.\n');
  } else {
    console.log('PAYS  MONNAIE  MODÈLE  GAMMES AJOUTÉES');
    for (const r of rapport) {
      console.log(`${r.pays.padEnd(5)} ${r.monnaie.padEnd(8)} ${r.modele.padEnd(7)} ${r.ajoutees}`);
    }
    console.log();
  }

  const sortie = valeur('--ecrire');
  if (sortie) {
    fs.writeFileSync(sortie, JSON.stringify(final, null, 2));
    console.log(`Écrit dans ${sortie}. À relire avant de l'appliquer :`);
    console.log(`  npx firebase-tools database:set /rates/car_type ${sortie} --project prod\n`);
  } else {
    console.log('Ajoutez --ecrire <fichier> pour produire le fichier à appliquer.\n');
  }
}

main();
