# Relit ce qu'un binaire iOS contient vraiment, avant de l'envoyer a Apple.
#
#   python tools/verifier-ipa.py chemin/vers/app.ipa heeroo-driver
#
# Le build du 13 octobre portait la version 1.4.0 alors que app.json annoncait
# 1.4.1, et personne ne l'a vu avant le refus d'Apple. Un .ipa est une archive
# zip : son Info.plist se lit en quelques lignes.
#
# Controle aussi NSUserTrackingUsageDescription : sa presence oblige a declarer
# un suivi publicitaire dans App Store Connect, qui refuse alors de repondre
# « non » a la question du suivi.
import json
import os
import plistlib
import re
import sys
import zipfile


def info_plist(ipa):
    with zipfile.ZipFile(ipa) as z:
        noms = [n for n in z.namelist() if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist', n)]
        if not noms:
            raise SystemExit("Info.plist introuvable dans l'archive.")
        # plistlib lit indifferemment le format XML et le format binaire.
        return plistlib.loads(z.read(noms[0]))


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Usage : python tools/verifier-ipa.py <fichier.ipa> [heeroo-driver|heeroo-rider]')
    ipa = sys.argv[1]
    app = sys.argv[2] if len(sys.argv) > 2 else None

    p = info_plist(ipa)
    version = p.get('CFBundleShortVersionString')
    build = p.get('CFBundleVersion')
    identifiant = p.get('CFBundleIdentifier')
    suivi = 'NSUserTrackingUsageDescription' in p

    print('\nDans le binaire :')
    print('  identifiant     ', identifiant)
    print('  version         ', version)
    print('  numero de build ', build)
    print('  cle de suivi publicitaire :', 'PRESENTE' if suivi else 'absente')
    autorisations = sorted(k for k in p if k.endswith('UsageDescription'))
    print('  autorisations demandees :', ', '.join(a.replace('UsageDescription', '') for a in autorisations) or 'aucune')

    if not app:
        print("\nPassez le nom de l'app en second argument pour comparer au depot.\n")
        return

    racine = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    with open(os.path.join(racine, app, 'app.json'), encoding='utf-8') as f:
        attendu = json.load(f)['expo']

    ecarts = []
    if version != attendu.get('version'):
        ecarts.append(f"version : binaire {version}, app.json {attendu.get('version')}")
    voulu = (attendu.get('ios') or {}).get('bundleIdentifier')
    if voulu and identifiant != voulu:
        ecarts.append(f'identifiant : binaire {identifiant}, app.json {voulu}')
    if suivi:
        ecarts.append('la cle de suivi publicitaire est presente : elle bloquera la declaration de confidentialite')

    numero = (attendu.get('ios') or {}).get('buildNumber')
    print(f"\nAttendu d'apres {app}/app.json : {attendu.get('version')}" + (f' (build {numero})' if numero else ''))
    if ecarts:
        print('\nECARTS :')
        for e in ecarts:
            print('  -', e)
        print("\nNe pas envoyer en l'etat.\n")
        sys.exit(1)
    print('\nConforme. Le binaire correspond au depot.\n')


main()
