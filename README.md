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
# Back-office (Create React App 3 : Node 16 ; production par défaut, REACT_APP_ENV=development pour la base de dev)
cd heeroo-admin && npm install --legacy-peer-deps
REACT_APP_ENV=development npm start

# Application Passager (Expo — les projets natifs android/ et ios/ sont générés au build, jamais versionnés)
cd heeroo-rider && npm install
npx expo-doctor                                   # vérification de la configuration
npx expo export --platform android                # vérifie que le bundle JS compile, sans appareil
eas build --platform android --profile preview    # APK de test (projet EAS : @laurabjns-team/heeroo-rider)
eas build --platform android --profile production # AAB pour Google Play

# Application Chauffeur (Expo, même organisation que le passager)
cd heeroo-driver && npm install
eas build --platform android --profile preview    # projet EAS : @laurabjns-team/heeroo-driver
```

### Vérifications locales (celles que la CI exécute)

```bash
node tools/check-sources.js heeroo-rider heeroo-driver   # identifiants non déclarés, styles/couleurs/textes inexistants, imports et assets introuvables, écrans de navigation inconnus
node tools/compile-sources.js heeroo-rider heeroo-driver # compilation Babel de tous les fichiers
cd functions && npm test                                  # tests unitaires des fonctions serveur
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
- Activation côté app : la carte « crédit / recharger » de l'écran Revenus du chauffeur n'apparaît que si `settings/waveEnabled` vaut `true` en base (à poser une fois la clé Wave configurée et les fonctions déployées ; aucun nouveau build nécessaire). Tant que Wave n'est pas prêt, l'app fonctionne sans.
- Crédit minimum pour accepter une course : `settings/minDriverBalance` (FCFA). Absent ou 0 = aucune règle ; sinon l'app chauffeur refuse l'acceptation sous ce seuil et renvoie vers la recharge. Le taux de commission par type de véhicule se règle dans l'admin (`rates/car_type[].convenience_fees`, en %) ; à 0 le crédit ne bouge pas.
- Flux : app chauffeur → `createWaveCheckout` → app Wave → webhook crédite `users/<uid>/walletBalance` (+ `walletHistory`, `walletTopups/<session>`) ; `confirmWaveCheckout` vérifie la session au retour dans l'app si le webhook tarde.

## Intégration et déploiement continus (GitHub Actions)

Quatre workflows dans `.github/workflows/` :

| Workflow | Déclenchement | Ce qu'il fait |
|---|---|---|
| **CI** (`ci.yml`) | chaque push et pull request | apps : analyse statique, compilation Babel, `expo-doctor`, résolution des configurations dev et prod ; fonctions : tests unitaires et chargement du module ; règles : JSON valides. back-office admin : installation et build. |
| **Déploiement admin** (`deploy-admin.yml`) | push sur `main` touchant `heeroo-admin/` → **dev** ; manuel → **dev** ou **prod** | build du back-office (Node 16, configuration de l'environnement cible) puis `firebase deploy --only hosting`. |
| **Déploiement backend** (`deploy-backend.yml`) | push sur `main` touchant `functions/`, les règles ou `firebase.json` → **dev** ; manuel (« Run workflow ») → **dev** ou **prod** | tests puis `firebase deploy --only functions,database,storage` sur le projet de l'environnement choisi. |
| **Build des apps** (`build-apps.yml`) | manuel (app, plateforme, profil) ; tag `v*` → production Android des deux apps | vérifications puis `eas build --no-wait` ; les liens de suivi apparaissent dans le résumé du run. Chaque build consomme du temps EAS : pas de build automatique à chaque push. |

### Secrets et environnements à configurer sur GitHub (une fois)

1. **Environnements** (*Settings → Environments*) : créer `dev` et `prod`. Sur `prod`, activer *Required reviewers* pour qu'un déploiement en production exige une validation humaine.
2. Dans **chaque environnement**, le secret `FIREBASE_SERVICE_ACCOUNT` : clé JSON d'un compte de service du projet Firebase correspondant (`heeroo-dev-49beb` pour `dev`, `projet-test-d7cd9` pour `prod`).
   Console Google Cloud → *IAM et administration → Comptes de service → Créer* (ex. `github-deploy`), rôles **Éditeur** et **Utilisateur du compte de service** → onglet *Clés → Ajouter une clé → JSON*. Coller le contenu du fichier dans le secret. Prérequis : un premier déploiement manuel par un propriétaire du projet (il pose les autorisations que le CLI ne peut accorder qu'avec ce rôle).
3. Secret de **dépôt** `EXPO_TOKEN` (*Settings → Secrets and variables → Actions*) : jeton créé sur expo.dev (*compte → Access tokens*), donnant accès à l'organisation `laurabjns-team`.

Sans ces secrets, la CI fonctionne (elle n'en a pas besoin) ; les workflows de déploiement et de build s'arrêtent avec un message explicite.

## Fichiers volontairement absents du dépôt

Voir `.gitignore` : keystores et certificats (`*.jks`, `*.keystore`, `*.p12`), fichiers `.env`, exports de base de données, documents client.
