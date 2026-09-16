'use strict';

// Fonctions serveur Heeroo.
//
// Fonctions HTTP (1re génération, région us-central1) : elles gardent les noms
// et les URL qu'utilisent les applications et le back-office :
//   POST /sendMessage        { token, title, msg }           — utilisateur authentifié
//   POST /check_user_email   { email }                       — public
//   POST /delete_auth_user   { id }                          — administrateur
//   POST /push_notifications { list: [{ to, title, body }] } — administrateur
//   POST /createPaymentIntent { bookingId }                  — utilisateur authentifié
//   POST /stripeWebhook      (appelée par Stripe, signature vérifiée)
//   POST /createWaveCheckout  { amount }                     — chauffeur authentifié
//   POST /confirmWaveCheckout { sessionId }                  — chauffeur authentifié
//   POST /waveWebhook        (appelée par Wave, signature vérifiée)
//
// Déclencheur base de données : prélèvement de la commission sur le crédit du
// chauffeur quand une course passe au statut END.

const functions = require('firebase-functions/v1');
const { onValueUpdated } = require('firebase-functions/v2/database');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

admin.initializeApp();

const REGION = 'us-central1';
const COMPLETED_STATUS = 'END';

// Clés Stripe : stockées dans Secret Manager (firebase functions:secrets:set),
// ou dans functions/.secret.local pour l'émulateur. Jamais dans le code.
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const WAVE_API_KEY = defineSecret('WAVE_API_KEY');
const WAVE_WEBHOOK_SECRET = defineSecret('WAVE_WEBHOOK_SECRET');
const crypto = require('crypto');

// Devises sans sous-unité chez Stripe (montant envoyé tel quel, pas en centimes).
const ZERO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'CLP', 'VND', 'UGX', 'RWF', 'GNF', 'BIF', 'DJF', 'KMF', 'MGA', 'PYG', 'VUV', 'XPF']);

function toStripeAmount(amount, currency) {
  const value = Number(amount) || 0;
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? Math.round(value) : Math.round(value * 100);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/** Enveloppe un handler HTTP : CORS, méthode POST uniquement, erreurs en JSON. */
function httpEndpoint(handler, options) {
  const builder = options && options.secrets
    ? functions.region(REGION).runWith({ secrets: options.secrets })
    : functions.region(REGION);
  return builder.https.onRequest((req, res) => {
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
// Stripe — paiement par carte d'une course (feuille de paiement native).
//
// createPaymentIntent : l'app demande le paiement d'une course ; le montant
// est celui de la course en base (jamais celui envoyé par l'app). Renvoie le
// secret client à donner au PaymentSheet.
// stripeWebhook : Stripe confirme le paiement ; c'est ici, et seulement ici,
// que la course est marquée payée.
// ---------------------------------------------------------------------------

/** Champs de paiement recopiés sur la course et sur les deux copies utilisateur. */
async function markBookingPaid(bookingId, booking, paymentIntent) {
  const paid = {
    payment_status: 'PAID',
    payment_mode: 'Card',
    getway: 'stripe',
    transaction_id: paymentIntent.id,
    customer_paid: Number(booking.trip_cost) || 0,
    cardPaymentAmount: Number(booking.trip_cost) || 0,
    paid_at: admin.database.ServerValue.TIMESTAMP,
  };
  const db = admin.database();
  await db.ref(`bookings/${bookingId}`).update(paid);
  if (booking.customer) await db.ref(`users/${booking.customer}/my-booking/${bookingId}`).update(paid);
  if (booking.driver) await db.ref(`users/${booking.driver}/my_bookings/${bookingId}`).update(paid);
}

exports.createPaymentIntent = httpEndpoint(async (req, res) => {
  const user = await requireUser(req);
  const { bookingId } = req.body || {};
  if (!bookingId) throw httpError(400, 'Paramètre bookingId requis');

  const booking = (await admin.database().ref(`bookings/${bookingId}`).once('value')).val();
  if (!booking) throw httpError(404, 'Course introuvable');
  if (booking.customer !== user.uid) throw httpError(403, 'Cette course ne vous appartient pas');
  if (booking.payment_status === 'PAID') throw httpError(409, 'Course déjà payée');

  const currency = String(booking.currency || req.body.currency || 'EUR').trim().toUpperCase();
  const amount = toStripeAmount(booking.trip_cost, currency);
  if (amount <= 0) throw httpError(400, 'Montant de la course invalide');

  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const intent = await stripe.paymentIntents.create({
    amount,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    description: `Course Heeroo ${bookingId}`,
    receipt_email: user.email || undefined,
    metadata: { bookingId, uid: user.uid, driver: booking.driver || '' },
  });
  res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount, currency });
}, { secrets: [STRIPE_SECRET_KEY] });

exports.stripeWebhook = functions.region(REGION).runWith({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] })
  .https.onRequest(async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value());
    } catch (error) {
      logger.warn('Webhook Stripe : signature invalide', error.message);
      res.status(400).send('Signature invalide');
      return;
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const bookingId = intent.metadata && intent.metadata.bookingId;
      if (bookingId) {
        const booking = (await admin.database().ref(`bookings/${bookingId}`).once('value')).val();
        if (booking && booking.payment_status !== 'PAID') {
          await markBookingPaid(bookingId, booking, intent);
          logger.info(`Course ${bookingId} payée par carte (${intent.id})`);
        }
      }
    }
    res.json({ received: true });
  });

// ---------------------------------------------------------------------------
// Wave — recharge du crédit chauffeur (Sénégal, FCFA).
//
// createWaveCheckout : le chauffeur choisit un montant ; on crée une session
// Wave Checkout et on renvoie l'URL à ouvrir (app Wave ou navigateur). La
// recharge est enregistrée en attente dans walletTopups/{sessionId}.
// waveWebhook : Wave confirme le paiement ; le crédit est ajouté au solde
// du chauffeur — seule source de vérité, idempotent.
// confirmWaveCheckout : secours si le webhook tarde — l'app demande à
// vérifier la session auprès de Wave au retour dans l'app.
// ---------------------------------------------------------------------------

const WAVE_API = 'https://api.wave.com/v1';
const WAVE_CURRENCY = 'XOF';
const WAVE_MIN_TOPUP = 1000;    // FCFA
const WAVE_MAX_TOPUP = 500000;  // FCFA

function hostingUrl(path) {
  const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
  return `https://${config.projectId}.web.app${path}`;
}

async function waveRequest(method, path, body) {
  const response = await fetch(WAVE_API + path, {
    method,
    headers: { Authorization: `Bearer ${WAVE_API_KEY.value()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('Wave', response.status, data);
    throw httpError(502, data.message || `Wave a répondu ${response.status}`);
  }
  return data;
}

/** Crédite le chauffeur pour une session payée. Idempotent via walletTopups/{id}/status. */
async function creditWaveTopup(sessionId, session) {
  const topupRef = admin.database().ref(`walletTopups/${sessionId}`);
  const topup = (await topupRef.once('value')).val();
  if (!topup) {
    logger.warn(`Recharge Wave ${sessionId} inconnue`);
    return false;
  }
  if (topup.status === 'completed') return true;

  const amount = Number(session.amount);
  if (!(amount > 0) || String(session.currency).toUpperCase() !== WAVE_CURRENCY) {
    logger.warn(`Recharge Wave ${sessionId} : montant ou devise inattendus`, session.amount, session.currency);
    return false;
  }

  const driverRef = admin.database().ref(`users/${topup.uid}`);
  await driverRef.child('walletBalance').transaction((balance) => (Number(balance) || 0) + amount);
  await driverRef.child('walletHistory').push({
    type: 'Credit',
    reason: 'wave_topup',
    amount,
    date: admin.database.ServerValue.TIMESTAMP,
    txRef: sessionId,
    transaction_id: session.transaction_id || null,
  });
  await topupRef.update({
    status: 'completed',
    transaction_id: session.transaction_id || null,
    completed_at: admin.database.ServerValue.TIMESTAMP,
  });
  logger.info(`Recharge Wave ${sessionId} : +${amount} ${WAVE_CURRENCY} pour ${topup.uid}`);
  return true;
}

exports.createWaveCheckout = httpEndpoint(async (req, res) => {
  const user = await requireUser(req);
  const profile = (await admin.database().ref(`users/${user.uid}`).once('value')).val();
  if (!profile || profile.usertype !== 'driver') throw httpError(403, 'Réservé aux chauffeurs');

  const amount = Math.round(Number(req.body && req.body.amount));
  if (!(amount >= WAVE_MIN_TOPUP && amount <= WAVE_MAX_TOPUP)) {
    throw httpError(400, `Montant entre ${WAVE_MIN_TOPUP} et ${WAVE_MAX_TOPUP} FCFA`);
  }

  const session = await waveRequest('POST', '/checkout/sessions', {
    amount: String(amount),
    currency: WAVE_CURRENCY,
    success_url: hostingUrl('/wave/succes.html'),
    error_url: hostingUrl('/wave/echec.html'),
    client_reference: user.uid,
  });

  await admin.database().ref(`walletTopups/${session.id}`).set({
    uid: user.uid,
    amount,
    currency: WAVE_CURRENCY,
    status: 'pending',
    created_at: admin.database.ServerValue.TIMESTAMP,
  });
  res.json({ sessionId: session.id, launchUrl: session.wave_launch_url, amount, currency: WAVE_CURRENCY });
}, { secrets: [WAVE_API_KEY] });

exports.confirmWaveCheckout = httpEndpoint(async (req, res) => {
  const user = await requireUser(req);
  const { sessionId } = req.body || {};
  if (!sessionId) throw httpError(400, 'Paramètre sessionId requis');

  const topup = (await admin.database().ref(`walletTopups/${sessionId}`).once('value')).val();
  if (!topup || topup.uid !== user.uid) throw httpError(404, 'Recharge introuvable');
  if (topup.status === 'completed') {
    res.json({ status: 'completed' });
    return;
  }

  const session = await waveRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (session.checkout_status === 'complete' && session.payment_status === 'succeeded') {
    await creditWaveTopup(sessionId, session);
    res.json({ status: 'completed' });
  } else {
    res.json({ status: session.payment_status === 'processing' ? 'pending' : 'failed', wave: session.checkout_status });
  }
}, { secrets: [WAVE_API_KEY] });

/** Vérifie l'en-tête Wave-Signature : t=<timestamp>,v1=<hmac-sha256(secret, timestamp + corps)>. */
function waveSignatureValid(header, rawBody, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(parts.t + rawBody.toString('utf8')).digest('hex');
  const given = String(parts.v1);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

exports.waveWebhook = functions.region(REGION).runWith({ secrets: [WAVE_WEBHOOK_SECRET] })
  .https.onRequest(async (req, res) => {
    if (!waveSignatureValid(req.headers['wave-signature'], req.rawBody, WAVE_WEBHOOK_SECRET.value())) {
      logger.warn('Webhook Wave : signature invalide');
      res.status(400).send('Signature invalide');
      return;
    }
    const event = req.body || {};
    const session = event.data || {};
    if (event.type === 'checkout.session.completed' && session.id) {
      await creditWaveTopup(session.id, session);
    } else if (event.type === 'checkout.session.payment_failed' && session.id) {
      await admin.database().ref(`walletTopups/${session.id}`).update({
        status: 'failed',
        error: (session.last_payment_error && session.last_payment_error.code) || 'payment_failed',
        failed_at: admin.database.ServerValue.TIMESTAMP,
      });
    }
    res.json({ received: true });
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
