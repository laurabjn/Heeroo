'use strict';

// Fonctions serveur Heeroo.
//
// Fonctions HTTP (1re génération, région us-central1) : elles gardent les noms
// et les URL qu'utilisent les applications et le back-office :
//   POST /sendMessage        { token, title, msg }           — utilisateur authentifié
//   POST /check_user_email   { email }                       — public
//   POST /delete_auth_user   { id }                          — administrateur
//   POST /push_notifications { list: [{ to, title, body }] } — administrateur
//
// Déclencheur base de données : prélèvement de la commission sur le crédit du
// chauffeur quand une course passe au statut END.

const functions = require('firebase-functions/v1');
const { onValueUpdated } = require('firebase-functions/v2/database');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

admin.initializeApp();

const REGION = 'us-central1';
const COMPLETED_STATUS = 'END';

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/** Enveloppe un handler HTTP : CORS, méthode POST uniquement, erreurs en JSON. */
function httpEndpoint(handler) {
  return functions.region(REGION).https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Méthode non autorisée' });
        return;
      }
      try {
        await handler(req, res);
      } catch (error) {
        logger.error(error);
        res.status(error.status || 500).json({ error: error.message || 'Erreur serveur' });
      }
    });
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Vérifie le jeton Firebase Auth transmis dans Authorization: Bearer <token>. */
async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Authentification requise');
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    throw httpError(401, 'Jeton invalide ou expiré');
  }
}

/** Comme requireUser, et exige en plus isAdmin = true sur le profil en base. */
async function requireAdmin(req) {
  const user = await requireUser(req);
  const snapshot = await admin.database().ref(`users/${user.uid}/isAdmin`).once('value');
  if (snapshot.val() !== true) throw httpError(403, 'Réservé aux administrateurs');
  return user;
}

/** Envoie une notification à un appareil (FCM HTTP v1). */
async function sendPush(token, title, body, data) {
  return admin.messaging().send({
    token,
    notification: { title, body },
    data: data || {},
    android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}

function isInvalidTokenError(error) {
  const code = error && error.code;
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

// ---------------------------------------------------------------------------
// sendMessage — notification d'un utilisateur à un autre (nouvelle course,
// chauffeur en approche…). Appelée par les apps passager et chauffeur.
// ---------------------------------------------------------------------------
exports.sendMessage = httpEndpoint(async (req, res) => {
  await requireUser(req);
  const { token, title, msg } = req.body || {};
  if (!token || !msg) throw httpError(400, 'Paramètres token et msg requis');

  try {
    const id = await sendPush(token, title || 'Heeroo', msg);
    res.json({ success: true, id });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      // Jeton périmé : on répond proprement, l'appareil se ré-enregistrera au prochain lancement.
      res.json({ success: false, reason: 'token-invalid' });
      return;
    }
    throw error;
  }
});

// ---------------------------------------------------------------------------
// check_user_email — indique si un compte existe pour cet e-mail sans mot de
// passe (créé par téléphone ou réseau social). L'app affiche alors le message
// adapté au lieu de « mot de passe incorrect ».
// ---------------------------------------------------------------------------
exports.check_user_email = httpEndpoint(async (req, res) => {
  const { email } = req.body || {};
  if (!email) throw httpError(400, 'Paramètre email requis');

  try {
    const user = await admin.auth().getUserByEmail(String(email).trim().toLowerCase());
    const hasPassword = user.providerData.some((p) => p.providerId === 'password');
    res.json({ exists: true, equal: !hasPassword });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      res.json({ exists: false, equal: false });
      return;
    }
    throw error;
  }
});

// ---------------------------------------------------------------------------
// delete_auth_user — suppression d'un compte par le back-office (le profil en
// base est supprimé par le back-office lui-même).
// ---------------------------------------------------------------------------
exports.delete_auth_user = httpEndpoint(async (req, res) => {
  await requireAdmin(req);
  const { id } = req.body || {};
  if (!id) throw httpError(400, 'Paramètre id requis');

  try {
    await admin.auth().deleteUser(id);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// push_notifications — diffusion d'un message par le back-office à une liste
// d'appareils (par type d'utilisateur / plateforme, calculée côté back-office).
// ---------------------------------------------------------------------------
exports.push_notifications = httpEndpoint(async (req, res) => {
  await requireAdmin(req);
  const list = Array.isArray(req.body && req.body.list) ? req.body.list : [];
  if (list.length === 0) throw httpError(400, 'Liste vide');

  const results = await Promise.allSettled(
    list.map((item) => sendPush(item.to, item.title || 'Heeroo', item.body || ''))
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const invalid = results.filter((r) => r.status === 'rejected' && isInvalidTokenError(r.reason)).length;
  const failed = results.length - sent - invalid;
  logger.info(`push_notifications: ${sent} envoyées, ${invalid} jetons périmés, ${failed} échecs`);
  res.json({ success: true, sent, invalid, failed });
});

// ---------------------------------------------------------------------------
// Commission chauffeur — quand une course passe au statut END, la commission
// est calculée à partir des tarifs en base (jamais du montant envoyé par
// l'app) et débitée du crédit du chauffeur. Idempotent : une course n'est
// débitée qu'une fois (champ commission_charged_at).
// ---------------------------------------------------------------------------

// Instance et région de la base : déduites du projet au moment du déploiement.
function databaseTarget() {
  const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
  const url = config.databaseURL || '';
  const host = url.replace(/^https?:\/\//, '');
  const instance = host.split('.')[0];
  const regionMatch = host.match(/\.([a-z]+-[a-z]+\d)\.firebasedatabase\.app$/);
  return { instance, region: regionMatch ? regionMatch[1] : 'us-central1' };
}

/** Taux de commission (%) pour un type de véhicule, d'après rates/car_type. */
async function commissionRateFor(carType) {
  const snapshot = await admin.database().ref('rates/car_type').once('value');
  const value = snapshot.val();
  if (!value) return 0;
  const types = Array.isArray(value) ? value : Object.values(value);
  const found = types.find((t) => t && t.name === carType);
  const rate = found ? Number(found.convenience_fees) : 0;
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

const target = databaseTarget();

exports.onBookingCompleted = onValueUpdated(
  { ref: '/bookings/{bookingId}/status', instance: target.instance, region: target.region },
  async (event) => {
    const status = event.data.after.val();
    if (status !== COMPLETED_STATUS) return;

    const bookingId = event.params.bookingId;
    const bookingRef = admin.database().ref(`bookings/${bookingId}`);
    const booking = (await bookingRef.once('value')).val();
    if (!booking || !booking.driver) return;
    if (booking.commission_charged_at) {
      logger.info(`Course ${bookingId} : commission déjà prélevée`);
      return;
    }

    const tripCost = Number(booking.trip_cost) || 0;
    const rate = await commissionRateFor(booking.carType);
    const commission = Math.round(tripCost * rate) / 100; // 2 décimales, en unité de la devise

    // Marquage d'abord (idempotence), puis débit atomique du crédit chauffeur.
    await bookingRef.update({
      commission_rate: rate,
      commission,
      commission_charged_at: admin.database.ServerValue.TIMESTAMP,
    });

    if (commission <= 0) {
      logger.info(`Course ${bookingId} : commission nulle (taux ${rate} %)`);
      return;
    }

    const driverRef = admin.database().ref(`users/${booking.driver}`);
    await driverRef.child('walletBalance').transaction((balance) => (Number(balance) || 0) - commission);
    await driverRef.child('walletHistory').push({
      type: 'Debit',
      reason: 'commission',
      amount: commission,
      date: admin.database.ServerValue.TIMESTAMP,
      txRef: bookingId,
    });
    logger.info(`Course ${bookingId} : commission ${commission} (${rate} % de ${tripCost}) débitée du chauffeur ${booking.driver}`);
  }
);
