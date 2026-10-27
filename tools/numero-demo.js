// Change le numéro de téléphone d'un compte de démonstration.
//
//   node tools/numero-demo.js driver                      # chauffeur, en production
//   node tools/numero-demo.js rider dev                   # passager, en développement
//   node tools/numero-demo.js driver production +33600000000
//
// Le compte de démonstration du chauffeur portait le numéro personnel du
// client. Ce numéro s'affiche sur l'écran « Mon Profil », et cet écran fait
// partie des captures publiées : il était donc lisible par n'importe qui sur la
// fiche Google Play et sur celle de l'App Store. Les examinateurs d'Apple, qui
// se connectent à ce compte, l'avaient aussi sous les yeux.
//
// `compte-demo.js` crée un compte et refuse de continuer si l'adresse existe
// déjà. Il ne pouvait donc pas corriger celui-ci. D'où cet outil, qui ne touche
// qu'un seul champ d'un compte existant.
//
// Le numéro par défaut est celui qu'écrit `compte-demo.js`, pour que les deux
// outils laissent la même chose derrière eux.
//
// Le mot de passe administrateur est saisi masqué et ne sert qu'à obtenir un
// jeton : la recherche du compte et l'écriture se font sous ces droits, parce
// qu'un chauffeur ne peut pas lire la liste des autres.
const path = require('path');
const readline = require('readline');

const ROLE = process.argv[2] === 'rider' ? 'rider' : 'driver';
const ENV = process.argv[3] === 'dev' ? 'development' : 'production';
const NUMERO = process.argv[4] || '+33600000000';

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

/** Un numéro ne se montre pas en entier dans un journal, même celui qu'on retire. */
function masquer(valeur) {
  const t = String(valeur || '');
  if (t.length < 5) return '(vide)';
  return t.slice(0, 4) + ' ' + '•'.repeat(t.length - 6) + ' ' + t.slice(-2);
}

async function main() {
  const { cle, base } = configuration();
  console.log(`Environnement : ${ENV === 'production' ? 'PRODUCTION' : 'développement'}`);
  console.log(`Rôle          : ${ROLE === 'driver' ? 'chauffeur' : 'passager'}`);
  console.log(`Nouveau numéro: ${NUMERO}`);
  console.log();

  const email = await demander('Adresse du compte de démonstration : ');
  if (!email) { console.error('Aucune adresse donnée.'); process.exit(1); }
  const adminEmail = await demander('Votre adresse administrateur [laura.bojon@gmail.com] : ') || 'laura.bojon@gmail.com';
  const adminMot = await demander('Votre mot de passe : ', true);

  const admin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cle}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminMot, returnSecureToken: true }),
  });
  const session = await admin.json();
  if (!session.idToken) {
    console.error('\nConnexion administrateur refusée :', (session.error && session.error.message) || 'raison inconnue');
    process.exit(1);
  }

  // `usertype` est le seul champ indexé sur `users` : on filtre dessus, puis on
  // retrouve l'adresse à la main. Sans index, la base refuserait la requête.
  const sorte = ROLE === 'driver' ? 'driver' : 'rider';
  const reponse = await fetch(`${base}/users.json?auth=${session.idToken}`
    + `&orderBy=${encodeURIComponent('"usertype"')}&equalTo=${encodeURIComponent(`"${sorte}"`)}`);
  if (!reponse.ok) {
    console.error('\nLecture refusée :', reponse.status, (await reponse.text()).slice(0, 200));
    console.error('Votre compte est-il bien administrateur sur cet environnement ?');
    process.exit(1);
  }
  const comptes = (await reponse.json()) || {};

  const vise = email.toLowerCase();
  const trouves = Object.keys(comptes).filter((uid) => String((comptes[uid] || {}).email || '').toLowerCase() === vise);
  if (trouves.length === 0) {
    console.error(`\nAucun ${sorte} avec cette adresse. Vérifiez le rôle et l'environnement.`);
    process.exit(1);
  }
  if (trouves.length > 1) {
    console.error(`\n${trouves.length} comptes portent cette adresse : ${trouves.join(', ')}.`);
    console.error('Corrigez le doublon depuis le back-office avant de continuer.');
    process.exit(1);
  }

  const uid = trouves[0];
  const ancien = comptes[uid].mobile;
  if (ancien === NUMERO) {
    console.log(`\nLe compte porte déjà ${NUMERO}. Rien à changer.`);
    return;
  }

  const ecriture = await fetch(`${base}/users/${uid}.json?auth=${session.idToken}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: NUMERO }),
  });
  if (!ecriture.ok) {
    console.error('\nÉcriture refusée :', ecriture.status, (await ecriture.text()).slice(0, 200));
    process.exit(1);
  }

  console.log();
  console.log('Numéro remplacé.');
  console.log('  identifiant :', uid);
  console.log('  avant       :', masquer(ancien));
  console.log('  après       :', NUMERO);
  console.log();
  console.log('Reprenez ensuite la capture « Mon Profil » depuis l\'application, puis');
  console.log('fabriquez les tailles iOS :');
  console.log('  python tools/captures-ios.py <capture> heeroo-store/captures-ios-chauffeur/moyen moyen');
  console.log('  python tools/captures-ios.py <capture> heeroo-store/captures-ios-chauffeur/grand grand');
}

main();
