// Lance expo-doctor sur une app, et décide si la CI doit tomber.
//
//   node tools/expo-doctor-ci.js heeroo-driver
//
// expo-doctor vérifie que les dépendances correspondent au SDK Expo. Le contrôle
// est utile — une version majeure ou mineure en décalage annonce une vraie
// incompatibilité — mais il échoue aussi sur les versions **correctives**, et
// celles-là Expo en publie plusieurs par semaine.
//
// Résultat : la CI tombait sur des commits qui n'avaient pas touché une seule
// dépendance, trois fois en deux jours. Une alerte qui se déclenche sans motif
// finit par n'être plus lue, et c'est alors qu'elle manque le vrai problème.
//
// On conserve donc le contrôle entier, mais une dérive **uniquement corrective**
// devient un avertissement au lieu d'un échec. Tout le reste fait tomber la CI
// comme avant.
const { spawnSync } = require('child_process');
const path = require('path');

const app = process.argv[2];
if (!app) {
  console.error('Usage : node tools/expo-doctor-ci.js <heeroo-rider|heeroo-driver>');
  process.exit(1);
}

const resultat = spawnSync('npx', ['expo-doctor'], {
  cwd: path.join(__dirname, '..', app),
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
});

const sortie = (resultat.stdout || '') + (resultat.stderr || '');
console.log(sortie);

if (resultat.status === 0) process.exit(0);

// Combien de contrôles ont échoué, d'après la ligne de synthèse d'expo-doctor.
const synthese = sortie.match(/(\d+) checks? failed/);
const echecs = synthese ? Number(synthese[1]) : null;

// Les autres catégories de décalage signalent une incompatibilité réelle et
// doivent continuer à bloquer. On ne tolère que la mention des correctifs,
// seule et sans compagne.
const correctifsSeuls = /Patch version mismatches/.test(sortie)
  && !/(Major|Minor|Expected version|Advanced) [a-z ]*mismatch/i.test(sortie);

if (echecs === 1 && correctifsSeuls) {
  console.log('');
  console.log('AVERTISSEMENT : seules des versions correctives sont en retard sur le SDK Expo.');
  console.log('Expo en publie plusieurs par semaine ; ce décalage n\'est pas un défaut du projet.');
  console.log('À rattraper avec « npx expo install --fix » avant le prochain build de production.');
  process.exit(0);
}

console.error('');
console.error('Décalage de dépendances au-delà des versions correctives : la CI s\'arrête.');
process.exit(1);
