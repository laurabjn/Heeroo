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
  return { paid: true, paymentIntentId: data.paymentIntentId, amount: data.amount, currency: data.currency };
}
