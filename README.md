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
node tools/verifie-dictionnaires.js                       # concordance des dictionnaires français et anglais
cd functions && npm test                                  # tests unitaires des fonctions serveur
```

## Langues des applications

Les deux applications sont **bilingues depuis la 1.6.0** : la langue de
l'appareil choisit le dictionnaire, français pour un appareil francophone,
anglais partout ailleurs. Il n'y a pas de sélecteur de langue dans l'app, et le
choix n'est pas mémorisé : il suit les réglages du téléphone.

| Fichier | Rôle |
|---|---|
| `src/common/language.fr.js` | le dictionnaire français, **référence** |
| `src/common/language.en.js` | le dictionnaire anglais, mêmes clés, même ordre |
| `src/common/language.js` | le sélecteur, qui lit la langue de l'appareil |

Le sélecteur garde le nom et l'export par défaut de l'ancien fichier : les
69 écrans qui font `import languageJSON from '../common/language'` n'ont rien à
changer.

`expo-localization` est un module natif. S'il manque — Expo Go, ou un binaire
compilé avant son ajout — le sélecteur retombe sur le français plutôt que de
faire planter l'app au démarrage.

**Une clé ajoutée d'un seul côté ne se voit pas en développement**, puisque le
français est complet et sert de défaut : l'écran afficherait `undefined` en
anglais seulement. `node tools/verifie-dictionnaires.js` compare les deux
fichiers et sort en erreur au premier écart. `tools/check-sources.js` vérifie de
son côté que chaque `languageJSON.X` existe, en lisant `language.fr.js`.

### Ce qui reste en français, volontairement

- **Le back-office.** Son unique utilisateur est français.
- **Les commentaires et les traces de `console`.** Ils s'adressent au développeur.
- **Le texte de loi du billet collectif** (`ticket_rules`), qui cite deux
  arrêtés français. Un texte réglementaire ne se traduit pas.
- **Les pièces administratives françaises** (carte VTC, RIR, carte grise,
  attestation à titre onéreux, carte verte). Le dictionnaire anglais en donne la
  traduction utile et garde le nom français entre parenthèses, puisque c'est ce
  nom qui figure sur le document demandé. Les pièces exigées varient déjà par
  pays (nœud `settings`) : ouvrir un pays non francophone demandera de nouvelles
  clés, pas une refonte.

### Les notifications push

Le serveur ne peut pas deviner la langue d'un destinataire. Les applications
écrivent `users/{uid}/language` au démarrage, dans `common/GetPushToken.js`,
**avant** de demander la permission de notifier : la langue est donc posée même
si les notifications sont refusées.

Les textes vivent dans `functions/lib/messages.js`, dans les deux langues, sous
forme de gabarits à marques `{nom}`. `notifyUser(uid, clé, params, data)` lit le
jeton push et la langue en parallèle — deux lectures ciblées, parce que le nœud
`users/{uid}` porte aussi l'historique des courses — puis compose le message.

**Un compte sans champ `language` reste en français**, ce qui couvre toute
installation antérieure à la 1.6.0.

Les montants suivent la même langue : `montantLisible(valeur, monnaie, locale)`
accepte désormais une locale, `fr-FR` par défaut.

`functions/test/messages.test.js` vérifie que les deux langues portent les mêmes
clés, les mêmes marques de substitution et les mêmes valeurs par défaut : une
traduction qui perdrait `{montant}` enverrait « Ride total: . Thank you ».

### Ce qui reste en français dans le code, et pourquoi

Trois écritures de `payment_mode: "Espèces"` — `driverTripComplete.js` côté
chauffeur, `CardDetails.js` côté passager — sont des **valeurs écrites en base**,
pas des libellés. Les traduire changerait la donnée.

Au passage : `FareScreen.js` écrit `'Cash'` pour la même chose. La cohabitation
est sans conséquence, le serveur ne testant que `'Card'` et `'Wave'` et rangeant
tout le reste dans les espèces — mais elle n'est pas voulue pour autant.

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
- Activation côté app : la carte « crédit / recharger » de l'écran Revenus du chauffeur n'apparaît que si `credit_settings/waveEnabled` vaut `true` en base (à poser une fois la clé Wave configurée et les fonctions déployées ; aucun nouveau build nécessaire). Tant que Wave n'est pas prêt, l'app fonctionne sans.
- Crédit minimum pour accepter une course : voir « Crédit du chauffeur » ci-dessous.
- Flux : app chauffeur → `createWaveCheckout` → app Wave → webhook crédite `users/<uid>/walletBalance` (+ `walletHistory`, `walletTopups/<session>`) ; `confirmWaveCheckout` vérifie la session au retour dans l'app si le webhook tarde.

### Orange Money (courses et recharge, Sénégal)

**Prérequis administratif, et c'est le chemin critique** : un compte marchand
Orange Money s'ouvre chez Sonatel Business, qui exige le **NINEA** et le
**RCCM** de la société sénégalaise. Comptez deux à six semaines, et 1 à 2,5 %
de frais. Sans société au Sénégal, Orange Money n'est pas ouvrable.

- Secrets : `firebase functions:secrets:set ORANGE_AUTH_HEADER` (l'en-tête
  « Basic … » de la console Orange) et `ORANGE_MERCHANT_KEY`. Pas de secret de
  webhook : **la notification d'Orange n'est pas signée.**
- **Interrupteur de déploiement** : les deux secrets ne sont déclarés que si la
  variable `ORANGE_ENABLED` vaut `true` dans l'environnement GitHub (Settings →
  Environments, à côté du compte de service). Firebase refuse de déployer une
  fonction qui déclare un secret absent de Secret Manager, et il refuse le
  déploiement *entier* : sans cet interrupteur, Orange Money bloquerait la
  livraison de toutes les autres fonctions et des règles de base. Absente, la
  variable vaut « non » : les points d'entrée Orange sont déployés mais
  répondent 503.
- **Les trois URL d'Orange sont à confirmer** le jour de la mise en service :
  elles sont rassemblées en tête de `functions/lib/orange.js`, seules et
  commentées. Les sources publiques ne s'accordent pas sur deux d'entre elles ;
  Orange livre ses chemins exacts avec le contrat marchand. Rien d'autre n'en
  dépend.
- Environnement : déduit du projet Firebase, comme le reste du fichier — bac à
  sable et `OUV` sur dev, production et `XOF` sur le projet de production. Rien
  à régler.
- Webhook à déclarer : aucun. L'URL de notification part dans le corps de
  chaque demande de paiement (`functionUrl('orangeWebhook')`).
- Pages de retour : `heeroo-admin/public/paiement/course-ok.html` et
  `course-ko.html` pour les courses (passager), `wave/succes.html` et
  `echec.html` pour la recharge (chauffeur). Servies par le Hosting, donc
  **déployer l'admin en même temps que le backend.**
- Activation côté app : `credit_settings/orangeEnabled` à `true` en base, une
  fois le compte marchand ouvert et les fonctions déployées. Aucun nouveau
  build nécessaire.
- Flux : app → `createOrangeRidePayment` / `createOrangeCheckout` → page
  Orange → `orangeWebhook`, qui **ne croit pas son propre contenu** : il vérifie
  le jeton de notification puis interroge Orange sur le statut, et c'est cette
  réponse qui règle la course. `confirmOrangeRidePayment` /
  `confirmOrangeCheckout` font la même vérification au retour dans l'app, et
  c'est le chemin principal — les notifications d'Orange sont réputées peu
  fiables. Les deux chemins passent par les mêmes fonctions idempotentes, de
  sorte qu'ils peuvent arriver tous les deux sans créditer deux fois.
- Le jeton de notification est rangé sous `orangeTokens/<référence>`, illisible
  par tout client. Le laisser dans l'enregistrement de la course le rendrait
  lisible par le passager, qui pourrait forger une notification et déclarer sa
  propre course payée.

### Crédit du chauffeur

Le crédit est le compte où tout se compense. Une course en espèces **débite** la
commission — le chauffeur a déjà l'argent en main ; une course encaissée par la
société **crédite** la part du chauffeur, commission déjà retenue. La liste des
moyens encaissés par la société tient en un seul endroit, `MOYENS_ENCAISSES`
dans `functions/lib/helpers.js` (carte, Wave, Orange Money), et c'est
`encaissePlateforme()` qui décide. **Tout nouveau prestataire s'inscrit là.**
L'oublier ferait traiter la course comme des espèces : le chauffeur serait
débité de la commission d'une course dont il n'a jamais touché le prix, et sa
part ne lui serait jamais créditée — il perdrait deux fois, et la société
garderait tout. `heeroo-driver/src/common/paiement.js` recopie la liste pour
l'application, et un test compare les deux à chaque exécution. Le taux se règle dans l'admin, par catégorie de véhicule et par pays
(`rates/car_type[].convenience_fees`, en %) ; à 0 le crédit ne bouge pas.

Un chauffeur qui ne ferait que des espèces verrait son crédit descendre sans
jamais remonter. C'est ce que borne le seuil : sous cette valeur, l'application
cesse de lui proposer des courses en espèces. Les courses encaissées par la
société restent accessibles — ce sont elles qui le ramènent au-dessus, et les
refuser reviendrait à interdire de travailler à qui ne doit rien.

Le seuil se règle sous `credit_settings`, une clé par monnaie, parce que
5 000 FCFA et 5 000 euros ne sont pas le même ordre de grandeur :

| Clé | Monnaie | Valeur en production |
|---|---|---|
| `minDriverBalance` | franc CFA (XOF et XAF) | 5 000 |
| `minDriverBalanceEUR` | euro | 0 |
| `minDriverBalanceGBP` | livre | absente |

`minDriverBalance`, sans suffixe, est l'ancien nom du seuil sénégalais : il ne
vaut que pour le franc CFA. Les autres monnaies lisent leur propre clé, et un
pays nouvellement ouvert démarre donc sans blocage tant que l'exploitant n'a
rien décidé.

**Un seuil négatif est un découvert toléré** : à `-20`, le chauffeur n'avance
rien, travaille jusqu'à devoir vingt euros de commission, puis ses courses en
espèces s'arrêtent. C'est le réglage à poser en France, où exiger un crédit
positif ferait payer d'avance un chauffeur dont le crédit ne fait que monter.
Absente ou à 0, la clé désactive la règle pour cette monnaie.

Au moment où une commission fait franchir le seuil, le serveur envoie une
notification au chauffeur (`previenirSiCreditEpuise`). Elle part au
franchissement seulement : sans cela, un chauffeur déjà dans le rouge la
recevrait après chaque course et cesserait de la lire. Sans seuil configuré, le
passage en négatif en tient lieu.

La règle est écrite deux fois, `seuilDeCredit` dans `functions/lib/helpers.js`
et dans `heeroo-driver/src/common/credit.js` : l'application bloque, le serveur
prévient, et les deux doivent dire la même chose. Un test vérifie que la table
pays-monnaie recopiée dans `functions/lib/` reste identique à celle des apps.

**Changer le seuil ne demande aucun nouveau build** tant qu'il reste du même
signe qu'aujourd'hui ; passer au découvert exige la version de l'app chauffeur
qui sait lire une valeur négative.

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
