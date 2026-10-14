# Prépare des captures d'écran Android pour l'App Store.
#
#   python tools/captures-ios.py heeroo-store/captures-chauffeur heeroo-store/captures-ios-chauffeur
#
# Apple refuse les captures montrant une barre d'état qui n'est pas celle d'iOS
# (règle 2.3.10, « Accurate Metadata ») : l'heure, le Wi-Fi et la batterie
# d'Android trahissent l'origine. Une capture sans barre d'état du tout est
# acceptée — c'est la voie suivie ici, plutôt que de fabriquer une fausse barre
# iOS, qui serait un mensonge sur l'appareil.
#
# La barre de gestes du bas est retirée pour la même raison.
#
# Le recadrage se fait sur les côtés et non par ajout de marges : une capture
# bordée de bandes se voit immédiatement, un recadrage de quelques dizaines de
# pixels ne se remarque pas.
import os
import sys
from PIL import Image

# iPhone 6,9 pouces : le seul format désormais exigé, Apple dérive les autres.
LARGEUR, HAUTEUR = 1320, 2868

# Un pixel est « sombre » s'il tranche nettement sur un fond clair : c'est ainsi
# qu'on repère l'heure et les icônes, sans connaître leur position exacte.
SEUIL = 110


def bande_occupee(image, debut, fin):
    """Dernière ligne contenant des pixels sombres, entre debut et fin."""
    pixels = image.convert('L').load()
    largeur = image.width
    derniere = None
    for y in range(debut, fin):
        for x in range(0, largeur, 4):
            if pixels[x, y] < SEUIL:
                derniere = y
                break
    return derniere


def premiere_occupee(image, debut, fin):
    """Première ligne contenant des pixels sombres, en remontant depuis le bas."""
    pixels = image.convert('L').load()
    largeur = image.width
    premiere = None
    for y in range(fin - 1, debut - 1, -1):
        for x in range(0, largeur, 4):
            if pixels[x, y] < SEUIL:
                premiere = y
                break
    return premiere


def traiter(source, destination):
    im = Image.open(source).convert('RGB')
    l, h = im.size

    # Barre d'état : cherchée dans les 6 % du haut seulement. Au-delà, on
    # tomberait sur le contenu de l'app — une carte, par exemple, est sombre
    # partout et ferait tout rogner.
    haut = bande_occupee(im, 0, int(h * 0.06))
    haut = haut + 12 if haut is not None else 0

    # Barre de gestes : même principe, dans les 5 % du bas.
    bas = premiere_occupee(im, int(h * 0.95), h)
    bas = bas - 12 if bas is not None else h

    im = im.crop((0, haut, l, bas))

    # Recadrage latéral pour atteindre le rapport de l'écran visé.
    cible = LARGEUR / HAUTEUR
    actuel = im.width / im.height
    if actuel > cible:
        neuve = int(im.height * cible)
        marge = (im.width - neuve) // 2
        im = im.crop((marge, 0, marge + neuve, im.height))
    elif actuel < cible:
        neuve = int(im.width / cible)
        marge = (im.height - neuve) // 2
        im = im.crop((0, marge, im.width, marge + neuve))

    im = im.resize((LARGEUR, HAUTEUR), Image.LANCZOS)
    im.save(destination, 'PNG', optimize=True)
    return haut, bas


def main():
    if len(sys.argv) < 3:
        print('Usage : python tools/captures-ios.py <dossier source> <dossier destination>')
        sys.exit(1)
    source, destination = sys.argv[1], sys.argv[2]
    os.makedirs(destination, exist_ok=True)

    fichiers = sorted(f for f in os.listdir(source) if f.lower().endswith('.png'))
    for nom in fichiers:
        haut, bas = traiter(os.path.join(source, nom), os.path.join(destination, nom))
        print(f'{nom:<28} barre d\'etat retiree jusqu\'a {haut} px, bas coupe a {bas} px')
    print(f'\n{len(fichiers)} captures ecrites dans {destination}, au format {LARGEUR}x{HAUTEUR}.')


main()
