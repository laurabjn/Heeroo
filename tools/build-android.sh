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

APP="${1:-heeroo-rider}"
export APP_ENV="${2:-production}"
FORMAT="${3:-apk}"

# Clé de dépôt Google Play : hors du dépôt Git, jamais versionnée. La perdre
# interdit toute mise à jour ultérieure des applications déjà publiées.
#
# Le chemin par défaut suppose le dossier voisin du dépôt ; depuis la copie de
# build à chemin court, il faut donc passer HEEROO_CREDENTIALS explicitement :
#   HEEROO_CREDENTIALS=/c/Users/.../heeroo-credentials tools/build-android.sh … aab
CREDENTIALS="${HEEROO_CREDENTIALS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/heeroo-credentials}"

export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot}"
export ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
