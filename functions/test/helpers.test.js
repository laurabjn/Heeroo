'use strict';

// Tests unitaires des fonctions pures (node --test).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { toStripeAmount, fromStripeAmount, waveSignatureValid, databaseTarget, shortName, formatAmount, commissionRate, compteStripePour, driverShare, heldShare, waveMobile } = require('../lib/helpers');

describe('compteStripePour', () => {
  test('rend la monnaie du pays', () => {
    assert.deepEqual(compteStripePour('FR'), { pays: 'FR', devise: 'EUR' });
    assert.deepEqual(compteStripePour('GB'), { pays: 'GB', devise: 'GBP' });
    assert.deepEqual(compteStripePour('BE'), { pays: 'BE', devise: 'EUR' });
  });
  test('accepte un code mal saisi', () => {
    assert.deepEqual(compteStripePour(' gb '), { pays: 'GB', devise: 'GBP' });
  });
  test('rend null pour un pays que Stripe ne sert pas', () => {
    // Le Senegal passe par Wave : lui ouvrir un compte Stripe donnerait un
    // compte que rien n'alimente.
    assert.equal(compteStripePour('SN'), null);
    assert.equal(compteStripePour('XX'), null);
    assert.equal(compteStripePour(''), null);
    assert.equal(compteStripePour(undefined), null);
  });
});

describe('toStripeAmount', () => {
  test('convertit les euros en centimes', () => {
    assert.equal(toStripeAmount(7, 'EUR'), 700);
    assert.equal(toStripeAmount('12.5', 'EUR'), 1250);
    assert.equal(toStripeAmount(0.1 + 0.2, 'EUR'), 30); // pas d'erreur d'arrondi flottant
  });
  test('laisse les devises sans sous-unité en unités entières', () => {
    assert.equal(toStripeAmount(2500, 'XOF'), 2500);
    assert.equal(toStripeAmount(2500.4, 'XOF'), 2500);
  });
  test('vaut 0 pour un montant absent ou invalide', () => {
    assert.equal(toStripeAmount(undefined, 'EUR'), 0);
    assert.equal(toStripeAmount('abc', 'EUR'), 0);
    assert.equal(toStripeAmount(null, 'XOF'), 0);
  });
});

describe('waveSignatureValid', () => {
  const secret = 'wave_secret_test';
  const body = Buffer.from(JSON.stringify({ type: 'checkout.session.completed', data: { id: 'cos-1' } }));
  const sign = (t, s = secret) => crypto.createHmac('sha256', s).update(t + body.toString('utf8')).digest('hex');

  test('accepte une signature correcte', () => {
    assert.equal(waveSignatureValid(`t=1700000000,v1=${sign('1700000000')}`, body, secret), true);
  });
  test('refuse un mauvais secret, un corps modifié ou un timestamp altéré', () => {
    assert.equal(waveSignatureValid(`t=1700000000,v1=${sign('1700000000', 'autre')}`, body, secret), false);
    assert.equal(waveSignatureValid(`t=1700000000,v1=${sign('1700000000')}`, Buffer.from('{}'), secret), false);
    assert.equal(waveSignatureValid(`t=1700000001,v1=${sign('1700000000')}`, body, secret), false);
  });
  test('tolère les espaces autour des séparateurs', () => {
    assert.equal(waveSignatureValid(`t=1700000000, v1=${sign('1700000000')}`, body, secret), true);
    assert.equal(waveSignatureValid(` t = 1700000000 , v1 = ${sign('1700000000')} `, body, secret), true);
  });
  test('refuse un en-tête absent ou malformé', () => {
    assert.equal(waveSignatureValid(undefined, body, secret), false);
    assert.equal(waveSignatureValid('', body, secret), false);
    assert.equal(waveSignatureValid('t=123', body, secret), false);
    assert.equal(waveSignatureValid('v1=abc', body, secret), false);
    assert.equal(waveSignatureValid('t=123,v1=court', body, secret), false);
  });
});

describe('databaseTarget', () => {
  test('base européenne : instance et région déduites de l’URL', () => {
    const env = { FIREBASE_CONFIG: JSON.stringify({ databaseURL: 'https://heeroo-dev-49beb-default-rtdb.europe-west1.firebasedatabase.app' }) };
    assert.deepEqual(databaseTarget(env), { instance: 'heeroo-dev-49beb-default-rtdb', region: 'europe-west1' });
  });
  test('base historique (firebaseio.com) : région us-central1', () => {
    const env = { FIREBASE_CONFIG: JSON.stringify({ databaseURL: 'https://projet-test-d7cd9-default-rtdb.firebaseio.com' }) };
    assert.deepEqual(databaseTarget(env), { instance: 'projet-test-d7cd9-default-rtdb', region: 'us-central1' });
  });
  test('configuration absente : ne plante pas', () => {
    assert.deepEqual(databaseTarget({}), { instance: '', region: 'us-central1' });
  });
});

describe('shortName', () => {
  test('abrège le nom de famille', () => {
    assert.equal(shortName({ driver_name: 'Moussa Diallo' }, 'driver_name'), 'Moussa D.');
    assert.equal(shortName({ customer_name: '  Laura   Bojon ' }, 'customer_name'), 'Laura B.');
  });
  test('prénom seul, champ absent, course absente', () => {
    assert.equal(shortName({ driver_name: 'Moussa' }, 'driver_name'), 'Moussa');
    assert.equal(shortName({}, 'driver_name'), '');
    assert.equal(shortName(null, 'driver_name'), '');
  });
});

describe('formatAmount', () => {
  test('euros par défaut, deux décimales', () => {
    assert.equal(formatAmount({ trip_cost: 7 }), '7.00 €');
    assert.equal(formatAmount({ trip_cost: '12.5', pickup: { country: 'FR' } }), '12.50 €');
  });
  test('FCFA pour un départ au Sénégal, sans décimales', () => {
    assert.equal(formatAmount({ trip_cost: 2500, pickup: { country: 'SN' } }), '2500 FCFA');
  });
  test('symbole explicite prioritaire', () => {
    assert.equal(formatAmount({ trip_cost: 10, currency_symbol: '$' }), '10.00 $');
  });
  test('vide si montant nul, négatif ou absent', () => {
    assert.equal(formatAmount({ trip_cost: 0 }), '');
    assert.equal(formatAmount({ trip_cost: -3 }), '');
    assert.equal(formatAmount({}), '');
  });
});

describe('commissionRate', () => {
  const rates = [
    { name: 'Berline', country: 'FR', convenience_fees: 0 },
    { name: 'Scooter', country: 'SN', convenience_fees: 13 },
    { name: 'Berline', country: 'SN', convenience_fees: 13 },
    { name: 'Berline', country: 'CM', convenience_fees: '7' },
    { name: 'Taxi', country: 'FR', convenience_fees: 'abc' },
  ];
  test('choisit le tarif du pays de la course, pas le premier du même nom', () => {
    assert.equal(commissionRate(rates, 'Berline', 'SN'), 13);
    assert.equal(commissionRate(rates, 'Berline', 'FR'), 0);
    assert.equal(commissionRate(rates, 'Berline', 'cm'), 7); // casse indifférente, chaîne convertie
  });
  test('sans pays connu ou sans entrée pour ce pays : premier tarif de ce nom', () => {
    assert.equal(commissionRate(rates, 'Scooter', undefined), 13);
    assert.equal(commissionRate(rates, 'Berline', 'BJ'), 0); // retombe sur Berline FR
  });
  test('0 si type inconnu, taux invalide, ou tarifs absents', () => {
    assert.equal(commissionRate(rates, 'Limousine', 'SN'), 0);
    assert.equal(commissionRate(rates, 'Taxi', 'FR'), 0);
    assert.equal(commissionRate(null, 'Berline', 'SN'), 0);
  });
  test('accepte la forme objet (clés Firebase) comme la forme tableau', () => {
    const asObject = Object.fromEntries(rates.map((r, i) => ['k' + i, r]));
    assert.equal(commissionRate(asObject, 'Berline', 'SN'), 13);
  });
});

test('fromStripeAmount rend un montant lisible', () => {
  assert.equal(fromStripeAmount(1250, 'EUR'), 12.5);
  assert.equal(fromStripeAmount(5000, 'XOF'), 5000);
  assert.equal(fromStripeAmount(undefined, 'EUR'), 0);
});

test('fromStripeAmount annule toStripeAmount', () => {
  for (const [value, currency] of [[12.5, 'EUR'], [0.01, 'EUR'], [5000, 'XOF']]) {
    assert.equal(fromStripeAmount(toStripeAmount(value, currency), currency), value);
  }
});

describe('driverShare', () => {
  test('retranche la commission du prix de la course', () => {
    assert.equal(driverShare(20, 3), 17);
    assert.equal(driverShare('20', '3'), 17);
    assert.equal(driverShare(2500, 325), 2175);   // francs CFA, unités entières
  });
  test("arrondit au centime sans trainer d'erreur flottante", () => {
    // La commission est d'abord ramenee au centime (1,515 -> 1,52), puis
    // retranchee : 10,10 - 1,52 = 8,58. Sans cela le resultat dependrait de la
    // representation flottante de 8,584999...
    assert.equal(driverShare(10.1, 1.515), 8.58);
    assert.equal(driverShare(0.3, 0.1), 0.2);
    assert.equal(driverShare(0.1 + 0.2, 0.1), 0.2);
  });
  test('rend le prix entier quand la commission est nulle ou absente', () => {
    assert.equal(driverShare(20, 0), 20);
    assert.equal(driverShare(20, undefined), 20);
    assert.equal(driverShare(20, 'abc'), 20);
    assert.equal(driverShare(20, -5), 20);
  });
  test('ne rend jamais une part negative', () => {
    // Un taux de commission mal saisi ne doit pas se traduire par un debit.
    assert.equal(driverShare(10, 25), 0);
  });
  test('vaut 0 pour une course sans prix', () => {
    assert.equal(driverShare(0, 0), 0);
    assert.equal(driverShare(undefined, 2), 0);
    assert.equal(driverShare('abc', 2), 0);
    assert.equal(driverShare(-10, 1), 0);
  });
});

describe('waveMobile', () => {
  test('nettoie les separateurs et garde l indicatif', () => {
    assert.equal(waveMobile('+221 77 123 45 67'), '+221771234567');
    assert.equal(waveMobile('+221-77-123-45-67'), '+221771234567');
    assert.equal(waveMobile('+33 6 12 34 56 78'), '+33612345678');
  });
  test('accepte la forme internationale en 00', () => {
    assert.equal(waveMobile('00221771234567'), '+221771234567');
  });
  test('complete un numero senegalais saisi sans indicatif', () => {
    assert.equal(waveMobile('771234567'), '+221771234567');
    assert.equal(waveMobile('77 123 45 67'), '+221771234567');
  });
  test('refuse ce qui n est pas exploitable', () => {
    assert.equal(waveMobile(''), null);
    assert.equal(waveMobile(null), null);
    assert.equal(waveMobile('0612345678'), null);   // national, indicatif inconnu
    assert.equal(waveMobile('+221'), null);         // indicatif seul
    assert.equal(waveMobile('abc'), null);
    assert.equal(waveMobile('+0123456789'), null);  // indicatif commencant par 0
  });
});

describe('heldShare', () => {
  const JOUR = 24 * 60 * 60 * 1000;
  const maintenant = 1760000000000;
  const part = (amount, ageJours) => ({ reason: 'part_course_carte', amount, date: maintenant - ageJours * JOUR });

  test('retient les parts recentes et libere les anciennes', () => {
    const lignes = [part(10, 1), part(20, 3), part(30, 9)];
    assert.equal(heldShare(lignes, maintenant, 7 * JOUR), 30);
  });
  test('ignore tout ce qui n est pas une part de course par carte', () => {
    const lignes = [
      part(10, 1),
      { reason: 'commission', amount: 5, date: maintenant },
      { reason: 'topup', amount: 50, date: maintenant },
      { reason: 'admin_topup', amount: 99, date: maintenant },
    ];
    assert.equal(heldShare(lignes, maintenant, 7 * JOUR), 10);
  });
  test('accepte la forme objet rendue par Firebase', () => {
    assert.equal(heldShare({ a: part(10, 1), b: part(5, 2) }, maintenant, 7 * JOUR), 15);
  });
  test('ne retient rien sans historique', () => {
    assert.equal(heldShare(null, maintenant, 7 * JOUR), 0);
    assert.equal(heldShare([], maintenant, 7 * JOUR), 0);
    assert.equal(heldShare(undefined, maintenant, 7 * JOUR), 0);
  });
  test('ignore une ligne sans date exploitable', () => {
    const lignes = [part(10, 1), { reason: 'part_course_carte', amount: 99 }];
    assert.equal(heldShare(lignes, maintenant, 7 * JOUR), 10);
  });
  test('une ligne pile a la limite est liberee', () => {
    assert.equal(heldShare([part(10, 7)], maintenant, 7 * JOUR), 0);
  });
});
