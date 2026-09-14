# Heeroo

Application de réservation de VTC (France / Sénégal), dérivée du template GrabCab (Exicube).

| Dossier | Rôle | Stack |
|---|---|---|
| `heeroo-rider/` | Application Passager | Expo SDK 57, React Native 0.86, React 19 — builds via EAS |
| `heeroo-driver/` | Application Chauffeur | React Native 0.67, React 17 |
| `heeroo-admin/` | Back-office web | React 16, Create React App, Material-UI 4 |
| `database.rules.json` | Règles de sécurité Realtime Database | — |

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

## Règles de sécurité de la base

`database.rules.json` est la source de vérité. Pour publier : Console Firebase → Realtime Database → Règles, ou `firebase deploy --only database` une fois `firebase.json` en place.

## Fichiers volontairement absents du dépôt

Voir `.gitignore` : keystores et certificats (`*.jks`, `*.keystore`, `*.p12`), fichiers `.env`, exports de base de données, documents client.
