#!/usr/bin/env bash
# Build Android local (APK de production), sans EAS ni quota.
#
#   tools/build-android.sh heeroo-rider                      # APK de production
#   tools/build-android.sh heeroo-driver development         # APK de développement
#   tools/build-android.sh heeroo-rider production aab       # bundle signé pour Google Play
#
# Le troisième argument « aab » produit un Android App Bundle signé avec la clé
# de dépôt, seul format accepté par Google Play. Les APK, eux, restent signés
# par la clé de débogage : c'est suffisant pour installer à la main, et Play
# les refuserait de toute façon.
#
# À lancer depuis la copie de build à chemin court (C:\heeroo) : Windows limite
# la longueur des chemins des fichiers intermédiaires C++, et le dossier de
# travail habituel dépasse cette limite.
#
# APP_ENV doit être EXPORTÉ : Gradle fabrique le bundle JavaScript dans un
# processus séparé (expo export:embed) qui lit cette variable. L'oublier produit
# une app de production pointant sur la base de développement.
set -euo pipefail

# Lance depuis PowerShell, « bash » resout vers C:\WINDOWS\system32ash.exe,
# c'est-a-dire WSL — et non Git Bash. WSL ne recoit pas les variables
# d'environnement de Windows et ne connait pas les chemins /c/..., si bien que
# le script echoue sur « LOCALAPPDATA: unbound variable » sans dire pourquoi.
if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
  echo "Ce script demande Git Bash, pas WSL." >&2
  echo "Depuis PowerShell :" >&2
  echo "  & \"C:\Program Files\Git\bin\bash.exe\" tools/build-android.sh $*" >&2
  exit 1
fi

APP="${1:-heeroo-rider}"
# « rider » et « driver » sont acceptes : le prefixe heeroo- est evident pour
# qui tape la commande, et l'oublier donnait un « No such file or directory »
# sur un chemin qui ne ressemblait a rien.
case "$APP" in
  rider|passager)  APP="heeroo-rider" ;;
  driver|chauffeur) APP="heeroo-driver" ;;
esac
export APP_ENV="${2:-production}"
FORMAT="${3:-apk}"

# Clé de dépôt Google Play : hors du dépôt Git, jamais versionnée. La perdre
# interdit toute mise à jour ultérieure des applications déjà publiées.
#
# Le chemin par défaut suppose le dossier voisin du dépôt ; depuis la copie de
# build à chemin court, il faut donc passer HEEROO_CREDENTIALS explicitement :
#   HEEROO_CREDENTIALS=/c/Users/.../heeroo-credentials tools/build-android.sh … aab
if [ -n "${HEEROO_CREDENTIALS:-}" ]; then
  CREDENTIALS="$HEEROO_CREDENTIALS"
else
  # Deux emplacements se rencontrent : a cote du depot, et dedans (ou .gitignore
  # l'exclut). Chercher les deux evite d'avoir a passer HEEROO_CREDENTIALS a
  # chaque fois selon la machine.
  _ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ -d "$_ICI/heeroo-credentials" ]; then
    CREDENTIALS="$_ICI/heeroo-credentials"
  else
    CREDENTIALS="$(cd "$_ICI/.." && pwd)/heeroo-credentials"
  fi
fi

export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot}"
export ANDROID_HOME="${ANDROID_HOME:-${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Les mots de passe de signature ne sont ecrits nulle part : ni dans le depot,
# ni dans un fichier, ni dans l'historique du terminal. S'ils ne sont pas deja
# dans l'environnement, on les demande, masques, au moment ou l'on en a besoin.
if [ "$FORMAT" = "aab" ]; then
  _demander() {
    local nom="$1" invite="$2"
    if [ -z "${!nom:-}" ]; then
      if [ -t 0 ]; then
        printf '%s : ' "$invite" >&2
        read -rs _valeur
        printf '
' >&2
        export "$nom=$_valeur"
        unset _valeur
      else
        echo "Variable $nom absente, et pas de terminal pour la demander." >&2
        exit 1
      fi
    fi
  }
  _demander HEEROO_UPLOAD_STORE_PASSWORD "Mot de passe du magasin de cles"
  _demander HEEROO_UPLOAD_KEY_ALIAS      "Alias de la cle"
  _demander HEEROO_UPLOAD_KEY_PASSWORD   "Mot de passe de la cle"
fi

if [ ! -d "$ROOT/$APP" ]; then
  echo "Application inconnue : $APP" >&2
  echo "Attendu : heeroo-rider ou heeroo-driver (rider et driver sont acceptes)." >&2
  exit 1
fi
cd "$ROOT/$APP"

echo "== $APP ($APP_ENV) =="
# --clean : prebuild ajoute au dossier natif mais n'en retire jamais rien. Sans
# cette option, une permission supprimee de app.json restait dans le manifeste
# d'un build precedent — le micro est reste ainsi dans les deux applications.
npx expo prebuild --platform android --no-install --clean >/dev/null

if [ "$FORMAT" = "aab" ]; then
  ENV_FILE="$CREDENTIALS/cle-de-signature.env"
  [ -f "$ENV_FILE" ] || { echo "Clé de dépôt introuvable : $ENV_FILE" >&2; exit 1; }
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  # Signature injectée à la ligne de commande : le fichier build.gradle est
  # régénéré à chaque prebuild, on ne peut donc pas y inscrire la clé.
  (cd android && ./gradlew bundleRelease --no-daemon --console=plain -q     -Pandroid.injected.signing.store.file="$CREDENTIALS/heeroo-upload.keystore"     -Pandroid.injected.signing.store.password="$HEEROO_UPLOAD_STORE_PASSWORD"     -Pandroid.injected.signing.key.alias="$HEEROO_UPLOAD_KEY_ALIAS"     -Pandroid.injected.signing.key.password="$HEEROO_UPLOAD_KEY_PASSWORD")
  BUNDLE="$ROOT/$APP/android/app/build/outputs/bundle/release/app-release.aab"
  ls -la "$BUNDLE" | awk '{print "Bundle : " int($5/104858)/10 " Mo"}'
  echo "$BUNDLE"
  exit 0
fi

(cd android && ./gradlew assembleRelease --no-daemon --console=plain -q)

APK="$ROOT/$APP/android/app/build/outputs/apk/release/app-release.apk"
ls -la "$APK" | awk '{printf "APK : %.1f Mo\n", $5/1048576}'

# Contrôle : le bundle embarqué pointe-t-il sur le bon projet Firebase ?
unzip -p "$APK" assets/app.config 2>/dev/null | node -e '
  let raw = ""; process.stdin.on("data", (c) => { raw += c; });
  process.stdin.on("end", () => {
    const extra = (JSON.parse(raw).extra) || {};
    console.log("Configuration embarquée :", extra.appEnv, "| Firebase", (extra.firebase || {}).projectId);
  });'
echo "$APK"
