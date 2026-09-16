# Heeroo

Application de réservation de VTC (France / Sénégal), dérivée du template GrabCab (Exicube).

| Dossier | Rôle | Stack |
|---|---|---|
| `heeroo-rider/` | Application Passager | Expo SDK 57, React Native 0.86, React 19 — builds via EAS |
| `heeroo-driver/` | Application Chauffeur | React Native 0.67, React 17 |
| `heeroo-admin/` | Back-office web | React 16, Create React App, Material-UI 4 |
| `functions/` | Fonctions serveur (notifications, comptes, commission chauffeur) | Cloud Functions, Node 22 |
| `database.rules.json` | Règles de sécurité Realtime Database | — |
| `storage.rules` | Règles de sécurité Cloud Storage | — |

Backend : Firebase (projet `projet-test-d7cd9` — Realtime Database, Auth, Storage, Cloud Functions, Hosting pour le back-office).

## Lancer les projets

```bash
# Back-office
cd heeroo-admin && npm install && npm start

# Application Passager (Expo — les projets natifs android/ et ios/ sont générés au build, jamais versionnés)
cd heeroo-rider && npm install
npx expo-doctor                                   # vérification de la configuration
npx expo export --platform android                # vérifie que le bundle JS compile, sans appareil
eas build --platform android --profile preview    # APK de test (projet EAS : @laurabjns-team/heeroo-rider)
eas build --platform android --profile production # AAB pour Google Play

# Application Chauffeur (ancienne base React Native 0.67 — migration Expo à venir)
cd heeroo-driver && npm install && npx react-native start
```

## Environnements Firebase

| Alias | Projet | Usage |
|---|---|---|
| `dev` (défaut) | `heeroo-dev-49beb` | développement et tests — base en Europe |
| `prod` | `projet-test-d7cd9` | production — base aux États-Unis |

Les apps choisissent l'environnement au build (`APP_ENV`, voir `app.config.js` et `eas.json`). Le CLI Firebase utilise `--project dev` ou `--project prod` (`.firebaserc`).

## Fonctions serveur et règles

```bash
npm install -g firebase-tools && firebase login
cd functions && npm install && cd ..
firebase deploy --only functions,database,storage --project dev    # puis --project prod
```

Les fonctions HTTP gardent les noms et URL historiques (`sendMessage`, `check_user_email`, `delete_auth_user`, `push_notifications`) ; les deux dernières exigent un administrateur (`users/<uid>/isAdmin = true`), la première un utilisateur connecté. `onBookingCompleted` prélève la commission (taux `rates/car_type[].convenience_fees`) sur le crédit du chauffeur quand une course passe au statut `END`.

Le déploiement des fonctions et la création du stockage exigent le plan Blaze sur le projet cible.

### Stripe (paiement par carte, app passager)

- Clés secrètes côté serveur : `firebase functions:secrets:set STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` (émulateur : `functions/.secret.local`, modèle dans `.secret.local.example`).
- Clé publique côté app : variable `STRIPE_PK_TEST` (dev) / `STRIPE_PK_LIVE` (prod) au build, lue par `heeroo-rider/app.config.js` — tant qu'elle est absente, le bouton « payer par carte » est masqué.
- Webhook à déclarer dans le tableau de bord Stripe : `https://us-central1-<projet>.cloudfunctions.net/stripeWebhook`, événement `payment_intent.succeeded`.

### Wave (recharge du crédit chauffeur, Sénégal)

- Clé API : `firebase functions:secrets:set WAVE_API_KEY` (créée sur business.wave.com → Développeurs).
- Webhook à déclarer sur business.wave.com → Développeurs → Webhooks : `https://us-central1-<projet>.cloudfunctions.net/waveWebhook`, événements `checkout.session.completed` et `checkout.session.payment_failed` ; le secret affiché va dans `WAVE_WEBHOOK_SECRET`.
- Pages de retour après paiement : `heeroo-admin/public/wave/succes.html` et `echec.html`, servies par le Hosting du projet (`firebase deploy --only hosting`).
- Flux : app chauffeur → `createWaveCheckout` → app Wave → webhook crédite `users/<uid>/walletBalance` (+ `walletHistory`, `walletTopups/<session>`) ; `confirmWaveCheckout` vérifie la session au retour dans l'app si le webhook tarde.

## Fichiers volontairement absents du dépôt

Voir `.gitignore` : keystores et certificats (`*.jks`, `*.keystore`, `*.p12`), fichiers `.env`, exports de base de données, documents client.
