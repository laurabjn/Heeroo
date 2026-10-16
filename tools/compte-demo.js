// Crée un compte de démonstration pour les examinateurs d'Apple et de Google.
//
//   node tools/compte-demo.js driver            # chauffeur, en production
//   node tools/compte-demo.js rider dev         # passager, en développement
//
// Apple refuse d'examiner une app dont les identifiants de démonstration ne
// fonctionnent pas (règle 2.1). Ceux déclarés dans App Store Connect dataient de
// l'ancien prestataire et n'existaient plus.
//
// Le compte créé est un chauffeur **déjà approuvé** : sans cela l'examinateur
// resterait bloqué sur la validation des justificatifs et ne verrait rien de
// l'application.
//
// Le mot de passe administrateur est saisi masqué et ne sert qu'à obtenir un
// jeton : le profil est écrit sous ces droits, parce qu'un chauffeur ne peut pas
// s'inscrire un solde lui-même — et c'est tant mieux.
const path = require('path');
const readline = require('readline');

const ROLE = process.argv[2] === 'rider' ? 'rider' : 'driver';
const ENV = process.argv[3] === 'dev' ? 'development' : 'production';

function configuration() {
  process.env.APP_ENV = ENV;
  const fichier = path.join(__dirname, '..', 'heeroo-rider', 'app.config.js');
  delete require.cache[require.resolve(fichier)];
  const extra = require(fichier)({ config: {} }).extra;
  return { cle: extra.firebase.apiKey, base: extra.firebase.databaseURL };
}

function demander(question, masque) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (masque) rl._writeToOutput = (t) => { if (t.includes(question)) process.stdout.write(t); };
    rl.question(question, (r) => { if (masque) process.stdout.write('\n'); rl.close(); resolve(r.trim()); });
  });
}

/** Profil complet : l'examinateur doit pouvoir parcourir l'app sans blocage. */
function profil(email, role) {
  const commun = {
    email,
    firstName: 'Demo',
    lastName: role === 'driver' ? 'Chauffeur' : 'Passager',
    mobile: '+33600000000',
    usertype: role,
    approved: true,
    country: 'FR',
    createdAt: Date.now(),
  };
  if (role !== 'driver') return commun;
  return {
    ...commun,
    walletBalance: 50,
    carType: 'Berline',
    vehicleNumber: 'AA-000-AA',
    vehicleMake: 'Demo',
    vehicleModel: 'Demo',
    queue: false,
    driverActiveStatus: true,
  };
}

async function main() {
  const { cle, base } = configuration();
  console.log(`Environnement : ${ENV === 'production' ? 'PRODUCTION' : 'développement'}`);
  console.log(`Rôle          : ${ROLE === 'driver' ? 'chauffeur' : 'passager'}`);
  console.log();

  const email = await demander('Adresse du compte de démonstration : ');
  const motDePasse = await demander('Mot de passe à lui donner : ', true);
  console.log();
  const adminEmail = await demander('Votre adresse administrateur [laura.bojon@gmail.com] : ') || 'laura.bojon@gmail.com';
  const adminMot = await demander('Votre mot de passe : ', true);

  const creer = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cle}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse, returnSecureToken: true }),
  });
  const compte = await creer.json();
  if (!compte.localId) {
    console.error('\nCréation refusée :', (compte.error && compte.error.message) || 'raison inconnue');
    if (compte.error && compte.error.message === 'EMAIL_EXISTS') {
      console.error('Ce compte existe déjà. Choisissez une autre adresse, ou supprimez-le depuis le back-office.');
    }
    process.exit(1);
  }

  const admin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cle}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminMot, returnSecureToken: true }),
  });
  const session = await admin.json();
  if (!session.idToken) {
    console.error('\nConnexion administrateur refusée :', (session.error && session.error.message) || 'raison inconnue');
    console.error(`Le compte ${email} a été créé mais n'a pas de profil. Complétez-le depuis le back-office.`);
    process.exit(1);
  }

  const ecriture = await fetch(`${base}/users/${compte.localId}.json?auth=${session.idToken}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profil(email, ROLE)),
  });
  if (!ecriture.ok) {
    console.error('\nProfil refusé :', ecriture.status, (await ecriture.text()).slice(0, 200));
    console.error('Votre compte est-il bien administrateur sur cet environnement ?');
    process.exit(1);
  }

  console.log();
  console.log('Compte de démonstration créé.');
  console.log('  identifiant :', compte.localId);
  console.log('  adresse     :', email);
  console.log();
  console.log('À reporter dans App Store Connect, section « Informations pour la vérification »,');
  console.log('puis dans la Play Console, section « Accès à l\'application ».');
  console.log();
  console.log('Ne supprimez jamais ce compte : les magasins le réutilisent à chaque examen.');
}

main();
