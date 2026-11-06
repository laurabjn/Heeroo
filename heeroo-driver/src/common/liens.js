// Les adresses des documents juridiques, en un seul endroit.
//
// Elle était recopiée dans AboutScreen.js. Un seul exemplaire aujourd'hui,
// mais la case d'acceptation de l'inscription en ajoute deux : trois copies
// d'une même adresse divergent au premier changement, et c'est toujours celle
// qu'on oublie qui reste affichée aux chauffeurs.
//
// Vérifié le 6 nov. 2026, chaque adresse ouverte et son contenu lu :
//
//   - heeroo.web.app sert la politique de confidentialité (8 984 o) et les
//     conditions d'utilisation (7 193 o). Ce sont les adresses déclarées aux
//     magasins : ne pas les changer sans mettre à jour App Store Connect et
//     la Play Console, qui les exigent et les contrôlent.
//   - heeroo.web.app n'a PAS de mentions légales : /mentions-legales y rend
//     la page « Page Not Found », de la taille exacte (21 376 o) d'un chemin
//     inventé. Les mentions légales n'existent que sur heeroo.fr.
//
// D'où le mélange de domaines ci-dessous, qui n'est pas un oubli.
export const MENTIONS_LEGALES = 'https://heeroo.fr/mentions-legales.php';
export const POLITIQUE_CONFIDENTIALITE = 'https://heeroo.web.app/politique-de-confidentialite';
export const CONDITIONS_UTILISATION = 'https://heeroo.web.app/conditions-utilisation';

// La version des documents que le chauffeur a acceptée, enregistrée avec son
// consentement. À changer le jour où l'un des textes change : sans elle, on
// sait que quelqu'un a accepté, mais pas ce qu'il a accepté — ce qui ne vaut
// rien le jour où la question se pose.
export const VERSION_DOCUMENTS = '2026-11-06';
