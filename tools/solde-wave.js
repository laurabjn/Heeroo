// Affiche le solde du portefeuille Wave de la société.
//
//   node tools/solde-wave.js            # production
//   node tools/solde-wave.js dev        # environnement de développement
//
// Un versement Wave est refusé si le portefeuille ne couvre pas le montant plus
// les frais. Ce solde ne se lit nulle part ailleurs que dans le tableau de bord
// de Wave, ce qui le rend invisible au moment où il compte : juste avant le
// versement hebdomadaire.
//
// Le mot de passe est saisi ici, masqué, et ne sert qu'à obtenir un jeton
// d'authentification. Il n'est ni affiché, ni enregistré, ni transmis ailleurs
// qu'à Firebase.
const path = require('path');
const readline = require('readline');

const ENV = process.argv[2] === 'dev' ? 'development' : 'production';

/** Clé web et adresse des fonctions, lues dans la configuration de l'app. */
function configuration() {
  process.env.APP_ENV = ENV;
  const fichier = path.join(__dirname, '..', 'heeroo-rider', 'app.config.js');
  delete require.cache[require.resolve(fichier)];
  const extra = require(fichier)({ config: {} }).extra;
  return { cle: extra.firebase.apiKey, fonctions: extra.functionsBaseUrl };
}

function demander(question, masque) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (masque) {
      // On intercepte l'écho pour que le mot de passe n'apparaisse pas à l'écran
      // ni dans l'historique visible du terminal.
      rl._writeToOutput = (texte) => {
        if (texte.includes(question)) process.stdout.write(texte);
      };
    }
    rl.question(question, (reponse) => {
      if (masque) process.stdout.write('\n');
      rl.close();
      resolve(reponse.trim());
    });
  });
}

async function main() {
  const { cle, fonctions } = configuration();
  console.log(`Environnement : ${ENV === 'production' ? 'PRODUCTION' : 'développement'}`);
  console.log(`Fonctions     : ${fonctions}`);
  console.log();

  const saisi = await demander('Adresse e-mail administrateur [laura.bojon@gmail.com] : ');
  const email = saisi || 'laura.bojon@gmail.com';
  const motDePasse = await demander('Mot de passe : ', true);

  const connexion = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cle}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse, returnSecureToken: true }),
  });
  const compte = await connexion.json();
  if (!compte.idToken) {
    console.error('\nConnexion refusée :', (compte.error && compte.error.message) || 'raison inconnue');
    process.exit(1);
  }

  const reponse = await fetch(`${fonctions}waveBalance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compte.idToken}` },
    body: '{}',
  });
  const solde = await reponse.json();

  console.log();
  if (!reponse.ok) {
    console.error('Lecture du solde refusée :', solde.error || `HTTP ${reponse.status}`);
    console.error();
    console.error("Si le message vient de Wave, c'est que la clé API n'a pas les droits attendus,");
    console.error('ou que les fonctions n\'ont pas été redéployées depuis son changement.');
    process.exit(1);
  }

  const montant = Number(solde.amount);
  console.log('SOLDE DU PORTEFEUILLE WAVE');
  console.log('  ', Number.isFinite(montant) ? montant.toLocaleString('fr-FR') : solde.raw, solde.currency);
  console.log();

  // Repère concret : le minimum de versement est de 500 FCFA par chauffeur.
  if (Number.isFinite(montant)) {
    console.log(`Soit de quoi couvrir environ ${Math.floor(montant / 500)} versement(s) au minimum de 500 ${solde.currency},`);
    console.log('frais Wave non déduits.');
  }
}

main();
