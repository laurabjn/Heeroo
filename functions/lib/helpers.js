'use strict';

// Fonctions pures des Cloud Functions Heeroo : sans accès réseau ni base,
// testables à l'unité (npm test). index.js les importe.

const crypto = require('crypto');

// Devises sans sous-unité chez Stripe (montant envoyé tel quel, pas en centimes).
const ZERO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'CLP', 'VND', 'UGX', 'RWF', 'GNF', 'BIF', 'DJF', 'KMF', 'MGA', 'PYG', 'VUV', 'XPF']);

/** Montant au format Stripe : centimes pour EUR, unité entière pour XOF… */
function toStripeAmount(amount, currency) {
  const value = Number(amount) || 0;
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? Math.round(value) : Math.round(value * 100);
}

/** Montant lisible a partir d'un montant Stripe : 1250 centimes -> 12.5 EUR. */
function fromStripeAmount(amount, currency) {
  const value = Number(amount) || 0;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase()) ? value : value / 100;
}

/** Vérifie l'en-tête Wave-Signature : t=<timestamp>,v1=<hmac-sha256(secret, timestamp + corps)>. */
function waveSignatureValid(header, rawBody, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(parts.t + rawBody.toString('utf8')).digest('hex');
  const given = String(parts.v1);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Instance et région de la base Realtime Database, déduites de FIREBASE_CONFIG au déploiement. */
function databaseTarget(env = process.env) {
  const config = JSON.parse(env.FIREBASE_CONFIG || '{}');
  const url = config.databaseURL || '';
  const host = url.replace(/^https?:\/\//, '');
  const instance = host.split('.')[0];
  const regionMatch = host.match(/\.([a-z]+-[a-z]+\d)\.firebasedatabase\.app$/);
  return { instance, region: regionMatch ? regionMatch[1] : 'us-central1' };
}

/** « Prénom N. » à partir du champ nom d'une course (customer_name, driver_name). */
function shortName(booking, key) {
  const name = booking && booking[key];
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

/** Montant d'une course pour une notification : « 12.50 € » ou « 2500 FCFA ». Vide si nul. */
function formatAmount(booking) {
  const cost = Number(booking.trip_cost);
  if (!(cost > 0)) return '';
  const symbol = booking.currency_symbol || (booking.pickup && booking.pickup.country === 'SN' ? 'FCFA' : '€');
  return `${cost.toFixed(symbol === 'FCFA' ? 0 : 2)} ${symbol}`;
}

/**
 * Taux de commission (%) applicable à une course, d'après rates/car_type :
 * le tarif dont le nom ET le pays correspondent ; à défaut de pays connu
 * ou d'entrée pour ce pays, le premier tarif de ce nom. 0 si rien ne convient.
 */
function commissionRate(carTypes, carType, country) {
  const types = (Array.isArray(carTypes) ? carTypes : Object.values(carTypes || {})).filter((t) => t && t.name === carType);
  if (types.length === 0) return 0;
  const byCountry = country ? types.find((t) => String(t.country || '').toUpperCase() === String(country).toUpperCase()) : null;
  const found = byCountry || types[0];
  const rate = Number(found.convenience_fees);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

module.exports = { ZERO_DECIMAL_CURRENCIES, commissionRate, toStripeAmount, fromStripeAmount, waveSignatureValid, databaseTarget, shortName, formatAmount };
