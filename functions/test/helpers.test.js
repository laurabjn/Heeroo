'use strict';

// Tests unitaires des fonctions pures (node --test).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { toStripeAmount, waveSignatureValid, databaseTarget, shortName, formatAmount } = require('../lib/helpers');

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
