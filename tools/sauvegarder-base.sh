#!/usr/bin/env bash
# Sauvegarde de la base Firebase et des comptes.
#
#   tools/sauvegarder-base.sh            # la production
#   tools/sauvegarder-base.sh dev        # la base de développement
#
# Pourquoi ce script existe. Les sauvegardes automatiques de Firebase demandent
# le forfait Blaze, qui est coupé. Les comptes, les courses et les réglages ne
# tiennent donc qu'à un seul exemplaire, celui qui est en ligne. Une fausse
# manœuvre dans le back-office, une règle de sécurité trop large, et il n'y a
# rien pour revenir en arrière.
#
# Le script écrit dans ../heeroo-sauvegardes-base/AAAA-MM-JJ/, hors de tout
# dépôt Git : ces fichiers contiennent des données personnelles — noms,
# téléphones, adresses, empreintes de mots de passe — et ne doivent jamais
# partir sur GitHub.
set -euo pipefail

PROJET="${1:-prod}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOUR="$(date +%Y-%m-%d)"
DOSSIER="$(cd "$RACINE/.." && pwd)/heeroo-sauvegardes-base/$PROJET-$JOUR"
mkdir -p "$DOSSIER"
# Node sous Windows ne comprend pas les chemins /c/... de Git Bash : il les lit
# comme C:\c\... Les outils reçoivent donc la forme C:/...
DOSSIER_WIN="$(cygpath -m "$DOSSIER")"

# MSYS_NO_PATHCONV : sans lui, Git Bash remplace le chemin « / » de la base par
# le dossier d'installation de Git, et firebase répond « Path must begin with /».
fb() { MSYS_NO_PATHCONV=1 npx --no-install firebase-tools "$@"; }

echo "Projet      : $PROJET"
echo "Destination : $DOSSIER"
echo

# Les nœuds ne sont pas écrits en dur : une sauvegarde qui ignore une branche
# ajoutée après coup — sos_alerts, par exemple — serait incomplète sans le dire.
echo "Inventaire des branches..."
RACINES="$(fb database:get / --shallow --project "$PROJET" 2>/dev/null \
  | node -e 'let r="";process.stdin.on("data",c=>r+=c);process.stdin.on("end",()=>{
      const t=r.trim(); if(!t||t==="null"){console.error("base vide ou illisible");process.exit(1);}
      console.log(Object.keys(JSON.parse(t)).join(" "));})')"
echo "  $RACINES"
echo

for NOM in $RACINES; do
  fb database:get "/$NOM" --project "$PROJET" > "$DOSSIER/$NOM.json" 2>/dev/null || true
  printf '  %-20s' "$NOM"
  node -e '
    const fs = require("fs");
    const f = process.argv[1];
    try {
      const v = JSON.parse(fs.readFileSync(f, "utf8"));
      const taille = (fs.statSync(f).size / 1024).toFixed(1) + " Ko";
      const quoi = v === null ? "vide" : (Array.isArray(v) ? v.length + " entrees" : Object.keys(v).length + " cles");
      console.log(taille.padStart(10) + "   " + quoi);
    } catch (e) {
      console.log("      ECHEC — fichier illisible");
      process.exit(1);
    }' "$DOSSIER_WIN/$NOM.json"
done

echo
echo "Comptes d authentification..."
# Sans les comptes, restaurer la base rendrait des profils auxquels plus
# personne ne pourrait se connecter.
fb auth:export "$DOSSIER_WIN/auth-comptes.json" --format=json --project "$PROJET" 2>&1 \
  | grep -E "Exported" || true

# Les empreintes des mots de passe ne servent à rien sans les paramètres qui
# permettent de les vérifier. Ils se relèvent une fois dans la console, et on
# les recopie ici pour que chaque sauvegarde se suffise à elle-même : au moment
# de restaurer, on ne veut pas dépendre d'un fichier resté ailleurs.
PARAMETRES="$(cd "$RACINE/.." && pwd)/heeroo-sauvegardes-base/parametres-hachage.txt"
if [ -f "$PARAMETRES" ]; then
  cp "$PARAMETRES" "$DOSSIER/parametres-hachage.txt"
  echo "  paramètres de hachage joints"
else
  echo
  echo "  !! ATTENTION : parametres-hachage.txt est absent."
  echo "     Sans lui, ces $(node -e 'const a=require(process.argv[1]);console.log(a.users.length)' "$DOSSIER_WIN/auth-comptes.json" 2>/dev/null || echo '?') comptes se réimportent"
  echo "     mais plus personne ne peut se connecter avec son mot de passe."
  echo "     Console Firebase > Authentication > Users > menu ⋮ >"
  echo "     Paramètres de hachage des mots de passe, à copier dans :"
  echo "     $PARAMETRES"
fi

cat > "$DOSSIER/LISEZ-MOI.md" <<FIN
# Sauvegarde $PROJET du $JOUR

Produite par \`tools/sauvegarder-base.sh\`.

**Ces fichiers ne vont sur aucun dépôt.** Ils contiennent des noms, des
téléphones, des adresses et les empreintes des mots de passe.

## Ce qu'il y a dedans

Un fichier JSON par branche de la base, plus \`auth-comptes.json\` pour les
comptes. Ce qui n'y est pas : les images de Storage (pièces d'identité,
assurances, photos de profil), qui demandent une clé de compte de service.

## Restaurer

Une branche, après avoir vérifié le fichier :

\`\`\`bash
npx firebase-tools database:set /settings settings.json --project $PROJET
\`\`\`

\`database:set\` **remplace** la branche entière. Restaurer \`/users\` écrase
donc tous les comptes créés depuis cette sauvegarde. Dans le doute, restaurer
une sous-branche, jamais la racine.

Les comptes, avec les valeurs lues dans \`parametres-hachage.txt\` :

\`\`\`bash
npx firebase-tools auth:import auth-comptes.json --project $PROJET \\
  --hash-algo=SCRYPT --hash-key=<base64Signer> --salt-separator=<base64Salt> \\
  --rounds=<rounds> --mem-cost=<memoryCost>
\`\`\`

\`auth-comptes.json\` contient les empreintes des mots de passe, mais pas ces
paramètres : sans eux les comptes se réimportent et **plus personne ne peut se
connecter**. S'ils manquent à côté de ce fichier, les relever dans la console
Firebase → Authentication → Users → menu ⋮ → Paramètres de hachage des mots de
passe.
FIN

echo
echo "Sauvegarde : $DOSSIER"
du -sh "$DOSSIER" 2>/dev/null | awk '{print "Poids      : " $1}'
