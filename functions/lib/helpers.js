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
  // Wave envoie « t=<horodatage>,v1=<signature> ». Certaines passerelles
  // insèrent une espace après la virgule : sans nettoyage, la clé lue serait
  // «  v1 » et toute livraison serait rejetée. On découpe donc sur le premier
  // « = » seulement, et on émonde les deux côtés.
  const parts = Object.fromEntries(String(header).split(',').map((part) => {
    const cut = part.indexOf('=');
    return cut < 0 ? [part.trim(), ''] : [part.slice(0, cut).trim(), part.slice(cut + 1).trim()];
  }));
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

/**
 * Part revenant au chauffeur sur une course déjà encaissée par la plateforme.
 *
 * Elle n'est jamais négative : une commission supérieure au prix de la course
 * trahit une erreur de paramétrage des tarifs, et mieux vaut ne rien verser que
 * prélever de l'argent au chauffeur sur la foi d'un taux erroné.
 */
function driverShare(tripCost, commission) {
  const total = Number(tripCost);
  if (!Number.isFinite(total) || total <= 0) return 0;
  const retenue = Number(commission);
  const prelevee = Number.isFinite(retenue) && retenue > 0 ? retenue : 0;
  // Soustraction en centimes, et non en euros. 10,1 - 1,515 vaut 8,584999... en
  // virgule flottante : l'arrondi bascule d'un centime selon le dernier bit.
  // Ramener chaque montant à l'unité facturable avant de soustraire rend le
  // résultat indépendant de la représentation machine.
  const centimes = Math.round(total * 100) - Math.round(prelevee * 100);
  return Math.max(0, centimes / 100);
}

/**
 * Numéro de mobile au format E.164 attendu par Wave : un « + », l'indicatif
 * pays, puis le numéro, sans espace ni séparateur.
 *
 * Rend null si le numéro n'est pas exploitable. Mieux vaut refuser un versement
 * que l'envoyer à un numéro approximatif : chez Wave, un numéro inconnu ne
 * rebondit pas, il déclenche un SMS invitant un inconnu à retirer l'argent chez
 * un agent.
 */
function waveMobile(value) {
  const brut = String(value || '').replace(/[\s.()-]/g, '');
  if (!brut) return null;
  // Un numéro sénégalais saisi sans indicatif commence par 7 et compte 9
  // chiffres ; on le complète plutôt que de le rejeter.
  const avecIndicatif = brut.startsWith('+') ? brut
    : brut.startsWith('00') ? '+' + brut.slice(2)
    : /^7\d{8}$/.test(brut) ? '+221' + brut
    : null;
  if (!avecIndicatif) return null;
  return /^\+[1-9]\d{7,14}$/.test(avecIndicatif) ? avecIndicatif : null;
}

/**
 * Part du crédit encore retenue : les sommes créditées par des courses payées
 * par carte depuis moins de `delai` millisecondes.
 *
 * Un impayé peut tomber longtemps après la course. Si le chauffeur a déjà
 * retiré sa part, c'est la plateforme qui rembourse de sa poche. Retenir
 * quelques jours ne supprime pas le risque — la fenêtre de contestation d'une
 * carte se compte en mois — mais elle écarte les cas les plus courants : carte
 * volée, course contestée dans la foulée.
 *
 * Le montant se déduit de l'historique plutôt que d'être tenu dans un compteur :
 * un compteur demanderait une tâche planifiée pour le faire décroître, et
 * finirait par dériver du solde réel.
 */
function heldShare(entries, now, delai) {
  const limite = Number(now) - Number(delai);
  const lignes = Array.isArray(entries) ? entries : Object.values(entries || {});
  const total = lignes.reduce((somme, ligne) => {
    if (!ligne || ligne.reason !== 'part_course_carte') return somme;
    const date = Number(ligne.date);
    if (!Number.isFinite(date) || date <= limite) return somme;
    return somme + (Number(ligne.amount) || 0);
  }, 0);
  return Math.max(0, Math.round(total * 100) / 100);
}

module.exports = { ZERO_DECIMAL_CURRENCIES, commissionRate, driverShare, heldShare, waveMobile, toStripeAmount, fromStripeAmount, waveSignatureValid, databaseTarget, shortName, formatAmount };
