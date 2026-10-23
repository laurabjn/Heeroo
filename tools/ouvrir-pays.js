// Prépare l'ouverture de nouveaux pays : complète rates/car_type.
//
//   node tools/ouvrir-pays.js tarifs-actuels.json                  # aperçu
//   node tools/ouvrir-pays.js tarifs-actuels.json --ecrire out.json
//   node tools/ouvrir-pays.js tarifs-actuels.json --pays CI,ML,BF
//   node tools/ouvrir-pays.js tarifs-actuels.json --pays GB --tarifs-locaux gb.json
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

// Monnaies converties depuis l'euro. Le franc CFA est arrimé à l'euro à parité
// fixe et légale : aucun taux de change en ligne n'est nécessaire, et un tarif
// saisi en euros donne le bon prix en francs.
const MONNAIES_CONVERTIES = new Set(['EUR', 'XOF', 'XAF']);

// Monnaies à tarification locale : rien ne les arrime à l'euro, donc rien ne
// les convertit. FareCalculator leur applique un taux de 1, et les tarifs
// stockés s'affichent tels quels dans la monnaie du pays.
//
// Ce n'est pas un pis-aller : aucun VTC ne re-tarife ses courses chaque fois
// que la livre bouge, les prix se fixent marché par marché. Mais cela veut dire
// qu'une grille recopiée depuis la France y serait fausse — une course à 20 €
// deviendrait 20 £, soit un quart plus cher. D'où l'avertissement à l'ouverture
// et l'option --tarifs-locaux pour y poser de vrais prix.
const MONNAIES_LOCALES = new Set(['GBP']);

const MONNAIES_SUPPORTEES = new Set([...MONNAIES_CONVERTIES, ...MONNAIES_LOCALES]);

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
  const monnaie = CURRENCIES[pays];
  return monnaie === 'XOF' || monnaie === 'XAF' ? 'SN' : 'FR';
}

// Parité fixe et légale du franc CFA, identique pour l'UEMOA et la CEMAC.
const PARITE_CFA = 655.957;

/**
 * Applique une grille de prix exprimée en francs CFA à toute la zone franc,
 * pays existants compris.
 *
 * Les tarifs sont stockés en euros et convertis à l'affichage : une grille
 * pensée en francs doit donc être divisée par la parité avant d'être écrite.
 * Saisir 150 FCFA du kilomètre revient à enregistrer 0,2287 € — une gymnastique
 * que personne ne fera de tête sans se tromper, d'où cette option.
 *
 * Format attendu, en francs CFA :
 *   { "Eco": { "min": 600, "km": 150, "heure": 2100, "commission": 13 }, … }
 */
function appliquerGrilleCfa(lignes, grille) {
  const touchees = [];
  for (const ligne of lignes) {
    const monnaie = CURRENCIES[String(ligne.country).toUpperCase()];
    if (monnaie !== 'XOF' && monnaie !== 'XAF') continue;
    const prix = grille[ligne.name];
    if (!prix) continue;

    const euro = (francs) => Math.round((francs / PARITE_CFA) * 10000) / 10000;
    ligne.min_fare = String(euro(prix.min));
    ligne.rate_per_kilometer = euro(prix.km);
    ligne.rate_per_hour = euro(prix.heure);
    if (prix.commission !== undefined) ligne.convenience_fees = prix.commission;
    touchees.push(`${ligne.country}/${ligne.name}`);
  }
  return touchees;
}

/**
 * Applique une grille exprimée dans la monnaie du pays, sans conversion.
 *
 * Format attendu, un bloc par pays :
 *   { "GB": { "Green": { "min": 6, "km": 0.80, "heure": 9, "commission": 15 }, … } }
 *
 * À la différence de la grille franc CFA, rien n'est divisé : ces monnaies ne
 * sont pas converties à l'affichage, donc ce qui est écrit ici est exactement
 * ce que le passager verra.
 */
function appliquerGrilleLocale(lignes, grilles) {
  const touchees = [];
  for (const ligne of lignes) {
    const pays = String(ligne.country).toUpperCase();
    const grille = grilles[pays];
    if (!grille) continue;
    const prix = grille[ligne.name];
    if (!prix) continue;

    ligne.min_fare = String(prix.min);
    ligne.rate_per_kilometer = prix.km;
    ligne.rate_per_hour = prix.heure;
    if (prix.commission !== undefined) ligne.convenience_fees = prix.commission;
    touchees.push(`${pays}/${ligne.name}`);
  }
  return touchees;
}

/**
 * Lit un export, quel que soit l'encodage qu'il a recu.
 *
 * `firebase-tools database:get > fichier.json` sous PowerShell ecrit de
 * l'UTF-16 avec marque d'ordre : JSON.parse s'y casse les dents sur le premier
 * caractere, avec un message qui ne dit pas pourquoi. On reconnait la marque et
 * on decode en consequence plutot que d'exiger de l'utilisateur qu'il sache
 * quel encodage son terminal a choisi.
 */
function lireTexte(fichier) {
  const octets = fs.readFileSync(fichier);
  if (octets[0] === 0xff && octets[1] === 0xfe) return octets.toString('utf16le').slice(1);
  if (octets[0] === 0xfe && octets[1] === 0xff) return octets.swap16().toString('utf16le').slice(1);
  if (octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) return octets.toString('utf8').slice(1);
  return octets.toString('utf8');
}

function lire(fichier) {
  const brut = JSON.parse(lireTexte(fichier));
  // La base rend tantôt un tableau, tantôt un objet indexé selon les trous.
  const lignes = Array.isArray(brut) ? brut : Object.values(brut || {});
  return lignes.filter(Boolean);
}

/**
 * Compare l'export d'origine au fichier produit, avant d'écraser le nœud en
 * base. `database:set` remplace tout : la seule question qui vaille est de
 * savoir si les lignes existantes sont intactes et si rien n'a disparu.
 */
function comparer(avant, apres) {
  const a = lire(avant);
  const b = lire(apres);
  const cle = (l) => `${String(l.country).toUpperCase()}|${l.name}`;
  const champs = ['country', 'name', 'min_fare', 'rate_per_hour', 'rate_per_kilometer', 'convenience_fees', 'image'];
  const memeTarif = (x, y) => champs.every((c) => String(x[c]) === String(y[c]));

  const apresParCle = new Map(b.map((l) => [cle(l), l]));
  const disparues = a.filter((l) => !apresParCle.has(cle(l)));
  const modifiees = a.filter((l) => {
    const n = apresParCle.get(cle(l));
    return n && !memeTarif(l, n);
  });
  const avantCles = new Set(a.map(cle));
  const ajoutees = b.filter((l) => !avantCles.has(cle(l)));

  console.log(`\nAvant : ${a.length} lignes.   Après : ${b.length} lignes.\n`);
  console.log(`  lignes existantes conservées telles quelles : ${a.length - disparues.length - modifiees.length} / ${a.length}`);
  console.log(`  lignes modifiées                            : ${modifiees.length}`);
  console.log(`  lignes disparues                            : ${disparues.length}`);
  console.log(`  lignes ajoutées                             : ${ajoutees.length}`);

  for (const l of modifiees) console.log(`    MODIFIÉE  ${cle(l)}`);
  for (const l of disparues) console.log(`    DISPARUE  ${cle(l)}`);

  // Une ligne qui disparaît est toujours un accident : rien dans ce script ne
  // supprime. Une ligne modifiée, en revanche, est normale si l'on vient de
  // corriger des tarifs — elle demande une relecture, pas un arrêt.
  if (disparues.length > 0) {
    console.log('\nNE PAS APPLIQUER : des lignes existantes disparaîtraient.\n');
    process.exitCode = 1;
  } else if (modifiees.length > 0) {
    console.log('\nAucune disparition. Les lignes ci-dessus changent de tarif :');
    console.log('attendu si vous venez de corriger des prix, suspect sinon.\n');
  } else {
    console.log('\nAucune perte : tout ce qui existait est repris à l\'identique.');
    console.log('Vous pouvez répondre Oui à la demande d\'écrasement.\n');
  }
}

function main() {
  const [fichier, ...options] = process.argv.slice(2);

  if (fichier === '--comparer') {
    const [avant, apres] = options;
    if (!avant || !apres) {
      console.error('Usage : node tools/ouvrir-pays.js --comparer <avant.json> <apres.json>');
      process.exit(1);
    }
    comparer(avant, apres);
    return;
  }

  if (!fichier) {
    console.error('Usage : node tools/ouvrir-pays.js <export-rates.json> [--pays CI,ML] [--ecrire sortie.json]');
    console.error('        node tools/ouvrir-pays.js --comparer <avant.json> <apres.json>');
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

  const locaux = retenus.filter((p) => MONNAIES_LOCALES.has(CURRENCIES[p]));
  if (locaux.length) {
    console.error(`\nATTENTION — ${locaux.join(', ')} : monnaie non convertie.`);
    console.error('Les gammes y sont recopiées depuis la France pour exister, mais leurs prix');
    console.error('seraient appliqués tels quels dans la monnaie du pays. Posez une vraie');
    console.error('grille avec --tarifs-locaux avant d\'écrire quoi que ce soit en base.\n');
  }

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

  const fichierGrille = valeur('--tarifs-cfa');
  if (fichierGrille) {
    const grille = JSON.parse(lireTexte(fichierGrille));
    const touchees = appliquerGrilleCfa(final, grille);
    console.log(`Grille franc CFA appliquée à ${touchees.length} lignes, pays déjà ouverts compris.\n`);
    console.log('GAMME       MINIMUM        AU KM        A L\'HEURE   COMMISSION');
    for (const [nom, p] of Object.entries(grille)) {
      console.log(
        nom.padEnd(11),
        `${p.min} F`.padStart(8), '    ',
        `${p.km} F`.padStart(7), '    ',
        `${p.heure} F`.padStart(8), '  ',
        p.commission !== undefined ? `${p.commission} %` : 'inchangée'
      );
    }
    // Un repère concret vaut mieux qu'une grille : c'est le prix affiché au
    // passager qui se vérifie, pas le tarif unitaire stocké en euros.
    const exemple = Object.entries(grille)[0];
    if (exemple) {
      const [nom, p] = exemple;
      const course = 10 * p.km + (25 / 60) * p.heure;
      console.log(`\nExemple : ${nom}, 10 km en 25 minutes = ${Math.round(Math.max(course, p.min)).toLocaleString('fr-FR')} FCFA.\n`);
    }
  }

  const fichierLocal = valeur('--tarifs-locaux');
  if (fichierLocal) {
    const grilles = JSON.parse(lireTexte(fichierLocal));
    const touchees = appliquerGrilleLocale(final, grilles);
    console.log(`Grille locale appliquée à ${touchees.length} lignes : ${Object.keys(grilles).join(', ')}.\n`);
    for (const [pays, grille] of Object.entries(grilles)) {
      console.log(`${pays} — ${CURRENCIES[pays] || '?'}`);
      console.log('GAMME       MINIMUM     AU KM   A L\'HEURE   COMMISSION');
      for (const [nom, prix] of Object.entries(grille)) {
        console.log(
          nom.padEnd(11),
          String(prix.min).padStart(7), '  ',
          String(prix.km).padStart(6), '  ',
          String(prix.heure).padStart(8), '  ',
          prix.commission !== undefined ? `${prix.commission} %` : 'inchangée'
        );
      }
      const exemple = Object.entries(grille)[0];
      if (exemple) {
        const [nom, prix] = exemple;
        const course = 10 * prix.km + (25 / 60) * prix.heure;
        console.log(`\nExemple : ${nom}, 10 km en 25 minutes = ${Math.max(course, prix.min).toFixed(2)} ${CURRENCIES[pays]}.\n`);
      }
    }
  }

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
