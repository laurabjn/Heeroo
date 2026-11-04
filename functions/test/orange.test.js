'use strict';

// Tests du module Orange Money. Le reseau est remplace par un faux « fetch »
// qui enregistre les appels : on verifie donc aussi bien ce qui est envoye a
// Orange que la facon dont ses reponses sont lues.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  ENVIRONNEMENTS,
  environnement,
  issueDuStatut,
  referenceCommande,
  jetonValide,
  creerClient,
} = require('../lib/orange');

/**
 * Faux reseau. On lui donne la suite des reponses a rendre ; il garde la trace
 * de chaque appel (url, methode, en-tetes, corps decode).
 */
function fauxReseau(reponses) {
  const appels = [];
  const file = reponses.slice();
  const f = async (url, options = {}) => {
    const corps = options.body && String(options.body).startsWith('{')
      ? JSON.parse(options.body)
      : options.body;
    appels.push({ url, method: options.method, headers: options.headers || {}, body: corps });
    const suivante = file.length > 1 ? file.shift() : file[0];
    return {
      ok: suivante.ok !== false && (suivante.status || 200) < 400,
      status: suivante.status || 200,
      json: async () => suivante.json || {},
    };
  };
  f.appels = appels;
  return f;
}

const JETON_OK = { json: { access_token: 'jeton-abc', expires_in: 3600 } };
const CONFIG = { authHeader: 'Basic c2VjcmV0', merchantKey: 'MK-123' };

describe('environnement', () => {
  test('le bac a sable et la production vont par paire', () => {
    assert.deepEqual(environnement('sandbox'), { nom: 'sandbox', chemin: 'dev', monnaie: 'OUV' });
    assert.deepEqual(environnement('senegal'), { nom: 'senegal', chemin: 'sn', monnaie: 'XOF' });
  });

  test('la casse et les espaces sont tolerees', () => {
    assert.equal(environnement('  SENEGAL ').monnaie, 'XOF');
  });

  test('sans precision, c\'est le bac a sable', () => {
    assert.equal(environnement().nom, 'sandbox');
    assert.equal(environnement(null).nom, 'sandbox');
    assert.equal(environnement('').nom, 'sandbox');
  });

  // Mieux vaut refuser de demarrer que d'encaisser dans le mauvais monde.
  test('un environnement inconnu leve', () => {
    assert.throws(() => environnement('production'), /inconnu/);
    assert.throws(() => environnement('constructor'), /inconnu/);
  });

  test('chaque environnement a un chemin et une monnaie', () => {
    for (const [nom, reglages] of Object.entries(ENVIRONNEMENTS)) {
      assert.ok(reglages.chemin, `${nom} : chemin manquant`);
      assert.ok(reglages.monnaie, `${nom} : monnaie manquante`);
    }
  });
});

describe('issueDuStatut', () => {
  test('les statuts connus', () => {
    assert.equal(issueDuStatut('SUCCESS'), 'completed');
    assert.equal(issueDuStatut('INITIATED'), 'pending');
    assert.equal(issueDuStatut('PENDING'), 'pending');
    assert.equal(issueDuStatut('FAILED'), 'failed');
    assert.equal(issueDuStatut('EXPIRED'), 'failed');
  });

  test('la casse et les espaces sont tolerees', () => {
    assert.equal(issueDuStatut(' success '), 'completed');
  });

  // Declarer perdue une course peut-etre payee ferait un passager quitte et un
  // chauffeur non paye. Un statut qu'on ne sait pas lire reste « en cours ».
  test('un statut inconnu reste en cours, jamais en echec', () => {
    assert.equal(issueDuStatut('SOMETHING_NEW'), 'pending');
    assert.equal(issueDuStatut(undefined), 'pending');
    assert.equal(issueDuStatut(null), 'pending');
    assert.equal(issueDuStatut(''), 'pending');
    assert.equal(issueDuStatut('constructor'), 'pending');
    assert.equal(issueDuStatut('toString'), 'pending');
  });
});

describe('referenceCommande', () => {
  test('porte le prefixe demande', () => {
    assert.match(referenceCommande('course'), /^course-/);
    assert.match(referenceCommande('recharge'), /^recharge-/);
  });

  // La reference est aussi la clef de l'enregistrement en base.
  test('ne contient que des caracteres acceptes par une clef Realtime Database', () => {
    for (let i = 0; i < 200; i += 1) {
      const reference = referenceCommande('course');
      assert.match(reference, /^[A-Za-z0-9_-]+$/, `clef invalide : ${reference}`);
      assert.ok(reference.length < 64, `clef trop longue : ${reference}`);
    }
  });

  test('deux references ne se repetent pas', () => {
    const vues = new Set();
    for (let i = 0; i < 500; i += 1) vues.add(referenceCommande('course'));
    assert.equal(vues.size, 500);
  });
});

describe('jetonValide', () => {
  test('reconnait le jeton conserve', () => {
    assert.equal(jetonValide('abc123', 'abc123'), true);
  });

  test('refuse un jeton different', () => {
    assert.equal(jetonValide('abc123', 'abc124'), false);
    assert.equal(jetonValide('abc', 'abc123'), false);
  });

  // Sans ce garde-fou, un enregistrement sans jeton accepterait une
  // notification qui n'en porte pas : n'importe qui declarerait une course
  // payee.
  test('refuse le vide des deux cotes', () => {
    assert.equal(jetonValide('', ''), false);
    assert.equal(jetonValide(null, null), false);
    assert.equal(jetonValide(undefined, undefined), false);
    assert.equal(jetonValide('abc', ''), false);
    assert.equal(jetonValide('', 'abc'), false);
  });
});

describe('creerClient', () => {
  test('exige ses identifiants', () => {
    assert.throws(() => creerClient({ merchantKey: 'MK' }), /authentification/);
    assert.throws(() => creerClient({ authHeader: 'Basic x' }), /clef marchande/);
  });

  test('annonce la monnaie de son environnement', () => {
    assert.equal(creerClient({ ...CONFIG, env: 'senegal' }).monnaie, 'XOF');
    assert.equal(creerClient({ ...CONFIG, env: 'sandbox' }).monnaie, 'OUV');
  });
});

describe('ouvrirPaiement', () => {
  const PAIEMENT_OK = {
    json: { pay_token: 'pt-1', payment_url: 'https://webpayment.orange-money.com/pt-1', notif_token: 'nt-1' },
  };

  test('demande un jeton puis ouvre le paiement', async () => {
    const reseau = fauxReseau([JETON_OK, PAIEMENT_OK]);
    const client = creerClient({ ...CONFIG, env: 'senegal', fetch: reseau });
    const ouvert = await client.ouvrirPaiement({
      montant: 2500,
      reference: 'course-abc',
      retourUrl: 'https://heeroo/ok',
      annulUrl: 'https://heeroo/ko',
      notifUrl: 'https://heeroo/notif',
    });

    assert.deepEqual(ouvert, {
      payToken: 'pt-1',
      paymentUrl: 'https://webpayment.orange-money.com/pt-1',
      notifToken: 'nt-1',
    });

    assert.equal(reseau.appels.length, 2);
    const [jeton, paiement] = reseau.appels;
    // Le jeton se demande a la passerelle, pas sous le chemin du produit :
    // surtout pas de segment de pays ni de « orange-money-webpay » ici. La
    // version precedente de ce test exigeait l'inverse, et validait donc une
    // adresse qui aurait rendu 404 le jour de la mise en service.
    assert.equal(jeton.url, 'https://api.orange.com/oauth/v3/token');
    assert.equal(jeton.headers.Authorization, CONFIG.authHeader);
    assert.equal(jeton.body, 'grant_type=client_credentials');
    assert.equal(paiement.headers.Authorization, 'Bearer jeton-abc');
    assert.deepEqual(paiement.body, {
      merchant_key: 'MK-123',
      currency: 'XOF',
      order_id: 'course-abc',
      amount: 2500,
      return_url: 'https://heeroo/ok',
      cancel_url: 'https://heeroo/ko',
      notif_url: 'https://heeroo/notif',
      lang: 'fr',
    });
  });

  test('la production parle XOF, le bac a sable OUV', async () => {
    const reseau = fauxReseau([JETON_OK, PAIEMENT_OK]);
    const client = creerClient({ ...CONFIG, env: 'sandbox', fetch: reseau });
    await client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' });
    assert.equal(reseau.appels[1].body.currency, 'OUV');
    assert.match(reseau.appels[1].url, /\/dev\/v1\/webpayment$/);
  });

  test('la langue du passager est transmise, et bornee a deux valeurs', async () => {
    for (const [demandee, attendue] of [['en', 'en'], ['fr', 'fr'], ['de', 'fr'], [undefined, 'fr']]) {
      const reseau = fauxReseau([JETON_OK, PAIEMENT_OK]);
      const client = creerClient({ ...CONFIG, fetch: reseau });
      await client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c', langue: demandee });
      assert.equal(reseau.appels[1].body.lang, attendue);
    }
  });

  // Les instances de Cloud Functions se reutilisent : redemander un jeton a
  // chaque paiement serait un aller-retour pour rien.
  test('le jeton est garde d\'un paiement a l\'autre', async () => {
    const reseau = fauxReseau([JETON_OK, PAIEMENT_OK, PAIEMENT_OK]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    await client.ouvrirPaiement({ montant: 100, reference: 'r1', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' });
    await client.ouvrirPaiement({ montant: 200, reference: 'r2', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' });
    const demandesDeJeton = reseau.appels.filter((a) => a.body === 'grant_type=client_credentials');
    assert.equal(demandesDeJeton.length, 1);
  });

  // Un jeton peut expirer entre deux appels malgre la marge de securite : le
  // paiement ne doit pas echouer pour si peu.
  test('un jeton expire est renouvele et le paiement aboutit', async () => {
    const refus = { status: 401, json: { message: 'expired' } };
    const reseau = fauxReseau([JETON_OK, refus, JETON_OK, PAIEMENT_OK]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    const ouvert = await client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' });
    assert.equal(ouvert.payToken, 'pt-1');
    // Deux jetons demandes : le premier, puis celui du reessai.
    const demandesDeJeton = reseau.appels.filter((a) => a.body === 'grant_type=client_credentials');
    assert.equal(demandesDeJeton.length, 2);
  });

  // Au-dela d'un reessai, c'est que les identifiants sont faux : insister n'y
  // changerait rien, et boucler sur un refus ferait attendre le passager.
  test('un second refus remonte, sans boucler', async () => {
    const refus = { status: 401, json: { message: 'bad credentials' } };
    const reseau = fauxReseau([JETON_OK, refus, JETON_OK, refus]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    await assert.rejects(
      () => client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' }),
      /bad credentials/
    );
    assert.equal(reseau.appels.length, 4);
  });

  test('un montant invalide n\'atteint jamais le reseau', async () => {
    const reseau = fauxReseau([JETON_OK, PAIEMENT_OK]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    for (const montant of [0, -5, NaN, undefined, 'beaucoup']) {
      await assert.rejects(
        () => client.ouvrirPaiement({ montant, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' }),
        /montant invalide/
      );
    }
    assert.equal(reseau.appels.length, 0);
  });

  test('une reponse sans page de paiement est une erreur', async () => {
    const reseau = fauxReseau([JETON_OK, { json: { pay_token: 'pt-1' } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    await assert.rejects(
      () => client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' }),
      /page de paiement/
    );
  });

  test('un jeton refuse remonte comme erreur', async () => {
    const reseau = fauxReseau([{ status: 401, json: { message: 'bad credentials' } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    await assert.rejects(
      () => client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' }),
      /bad credentials/
    );
  });

  test('un notif_token absent est rendu nul, pas invente', async () => {
    const reseau = fauxReseau([JETON_OK, { json: { pay_token: 'pt', payment_url: 'https://x' } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    const ouvert = await client.ouvrirPaiement({ montant: 100, reference: 'r', retourUrl: 'a', annulUrl: 'b', notifUrl: 'c' });
    assert.equal(ouvert.notifToken, null);
  });
});

describe('statut', () => {
  test('envoie les trois parametres exiges et traduit la reponse', async () => {
    const reseau = fauxReseau([JETON_OK, { json: { status: 'SUCCESS', txnid: 'MP123', order_id: 'course-abc' } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    const resultat = await client.statut({ reference: 'course-abc', montant: 2500, payToken: 'pt-1' });

    assert.deepEqual(resultat, { issue: 'completed', brut: 'SUCCESS', txnid: 'MP123', montant: null });
    assert.deepEqual(reseau.appels[1].body, { order_id: 'course-abc', amount: 2500, pay_token: 'pt-1' });
    assert.match(reseau.appels[1].url, /transactionstatus$/);
  });

  test('un echec est rendu tel quel', async () => {
    const reseau = fauxReseau([JETON_OK, { json: { status: 'FAILED' } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    assert.deepEqual(
      await client.statut({ reference: 'r', montant: 1, payToken: 'pt' }),
      { issue: 'failed', brut: 'FAILED', txnid: null, montant: null }
    );
  });

  // Orange prend le montant en entree ; s'il le renvoie, on le rend pour que
  // l'appelant puisse le rapprocher. Sinon null, jamais un chiffre invente.
  test('le montant est rendu quand Orange le renvoie', async () => {
    const reseau = fauxReseau([JETON_OK, { json: { status: 'SUCCESS', amount: 2500 } }]);
    const client = creerClient({ ...CONFIG, fetch: reseau });
    assert.equal((await client.statut({ reference: 'r', montant: 2500, payToken: 'pt' })).montant, 2500);
  });

  test('un montant illisible vaut null', async () => {
    for (const renvoye of [undefined, null, '', 'beaucoup', {}]) {
      const reseau = fauxReseau([JETON_OK, { json: { status: 'SUCCESS', amount: renvoye } }]);
      const client = creerClient({ ...CONFIG, fetch: reseau });
      assert.equal((await client.statut({ reference: 'r', montant: 1, payToken: 'pt' })).montant, null);
    }
  });
});
