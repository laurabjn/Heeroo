#!/usr/bin/env bash
# Build Android local (APK de production), sans EAS ni quota.
#
#   tools/build-android.sh heeroo-rider            # production (par défaut)
#   tools/build-android.sh heeroo-driver development
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

export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot}"
export ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/$APP"

echo "== $APP ($APP_ENV) =="
npx expo prebuild --platform android --no-install >/dev/null
(cd android && ./gradlew assembleRelease --no-daemon --console=plain -q)

APK="$ROOT/$APP/android/app/build/outputs/apk/release/app-release.apk"
ls -la "$APK" | awk '{printf "APK : %.1f Mo\n", $5/1048576}'

# Contrôle : le bundle embarqué pointe-t-il sur le bon projet Firebase ?
PROJECT=$(unzip -p "$APK" assets/index.android.bundle 2>/dev/null | grep -o 'heeroo-dev-49beb\|projet-test-d7cd9' | sort -u | tr '\n' ' ')
echo "Projet Firebase embarqué : ${PROJECT:-(indéterminé)}"
echo "$APK"
