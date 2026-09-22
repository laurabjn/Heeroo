// Paiement par carte d'une course avec la feuille de paiement Stripe.
// Le montant est fixé côté serveur (createPaymentIntent) à partir de la course
// en base ; la confirmation définitive arrive par le webhook Stripe.
import Constants from 'expo-constants';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { base_url } from './key';

export function isCardPaymentAvailable() {
  const key = Constants.expoConfig.extra.stripePublishableKey;
  return typeof key === 'string' && key.startsWith('pk_');
}

/**
 * Lance le paiement d'une course. Résout avec { paid: true, paymentIntentId }
 * en cas de succès, { paid: false, canceled: true } si l'utilisateur annule,
 * et rejette avec une Error en cas d'échec.
 */
export async function payBookingWithCard({ bookingId, email, merchantCountryCode = 'FR' }) {
  const idToken = await firebase.auth().currentUser.getIdToken();
  const response = await fetch(base_url + 'createPaymentIntent', {
    method: 'post',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ bookingId }),
  });
  const data = await response.json();
  if (!response.ok || !data.clientSecret) {
    throw new Error(data.error || 'Impossible de préparer le paiement');
  }

  const init = await initPaymentSheet({
    merchantDisplayName: 'Heeroo',
    paymentIntentClientSecret: data.clientSecret,
    defaultBillingDetails: email ? { email } : undefined,
    googlePay: { merchantCountryCode, testEnv: Constants.expoConfig.extra.appEnv !== 'production' },
    applePay: { merchantCountryCode },
    returnURL: 'heeroo://stripe-redirect',
  });
  if (init.error) throw new Error(init.error.message);

  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return { paid: false, canceled: true };
    throw new Error(result.error.message);
  }

  // La carte est débitée. C'est le serveur qui marque la course payée, après
  // avoir relu le paiement chez Stripe ; le webhook Stripe fait la même chose
  // en filet si cet appel échoue (réseau coupé…), l'app n'écrit rien elle-même.
  let outcome = 'pending';
  try {
    const confirm = await fetch(base_url + 'confirmCardPayment', {
      method: 'post',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
      body: JSON.stringify({ paymentIntentId: data.paymentIntentId }),
    });
    const confirmed = await confirm.json();
    if (confirm.ok && confirmed.status) outcome = confirmed.status;
  } catch (e) {
    console.log('[stripe] confirmation serveur différée au webhook', e);
  }
  return { paid: true, outcome, paymentIntentId: data.paymentIntentId, amount: data.amount, currency: data.currency };
}

/**
 * Empreinte bancaire à la réservation : la somme estimée (majorée d'une marge
 * côté serveur) est bloquée sur la carte sans être débitée. Le débit réel a
 * lieu à la fin de la course, et une annulation libère le blocage.
 *
 * Résout avec { authorized: true, paymentIntentId } si le passager a validé,
 * { authorized: false, canceled: true } s'il a renoncé, et rejette en cas
 * d'échec (carte refusée, réseau…).
 */
export async function authorizeRideWithCard({ estimate, currency = 'EUR', carType, email, merchantCountryCode = 'FR' }) {
  const idToken = await firebase.auth().currentUser.getIdToken();
  const response = await fetch(base_url + 'authorizeRideCard', {
    method: 'post',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ estimate, currency, carType }),
  });
  const data = await response.json();
  if (!response.ok || !data.clientSecret) {
    throw new Error(data.error || "Impossible de préparer l'empreinte bancaire");
  }

  const init = await initPaymentSheet({
    merchantDisplayName: 'Heeroo',
    paymentIntentClientSecret: data.clientSecret,
    defaultBillingDetails: email ? { email } : undefined,
    googlePay: { merchantCountryCode, testEnv: Constants.expoConfig.extra.appEnv !== 'production' },
    applePay: { merchantCountryCode },
    returnURL: 'heeroo://stripe-redirect',
  });
  if (init.error) throw new Error(init.error.message);

  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return { authorized: false, canceled: true };
    throw new Error(result.error.message);
  }
  return { authorized: true, paymentIntentId: data.paymentIntentId, authorizedAmount: data.authorizedAmount };
}
