# Heeroo

Application de réservation de VTC (France / Sénégal), dérivée du template GrabCab (Exicube).

| Dossier | Rôle | Stack |
|---|---|---|
| `heeroo-rider/` | Application Passager | React Native 0.68, React 17 |
| `heeroo-driver/` | Application Chauffeur | React Native 0.67, React 17 |
| `heeroo-admin/` | Back-office web | React 16, Create React App, Material-UI 4 |
| `database.rules.json` | Règles de sécurité Realtime Database | — |

Backend : Firebase (projet `projet-test-d7cd9` — Realtime Database, Auth, Storage, Cloud Functions, Hosting pour le back-office).

## État du dépôt

Ce dépôt a été recréé le 14 septembre 2026 à partir du code livré par le prestataire précédent. Les projets natifs `android/` et `ios/` n'ont pas été conservés et sont à reconstruire ; les identifiants publiés sont `org.Terence.HeerooRider` et `org.Terence.HeerooDriver` (iOS). Le code des Cloud Functions (`functions/`) n'est pas dans le dépôt.

## Lancer les projets

```bash
# Back-office
cd heeroo-admin && npm install && npm start

# Applications mobiles (nécessitent les projets natifs)
cd heeroo-rider && npm install && npx react-native start
cd heeroo-driver && npm install && npx react-native start
```

## Règles de sécurité de la base

`database.rules.json` est la source de vérité. Pour publier : Console Firebase → Realtime Database → Règles, ou `firebase deploy --only database` une fois `firebase.json` en place.

## Fichiers volontairement absents du dépôt

Voir `.gitignore` : keystores et certificats (`*.jks`, `*.keystore`, `*.p12`), fichiers `.env`, exports de base de données, documents client.
