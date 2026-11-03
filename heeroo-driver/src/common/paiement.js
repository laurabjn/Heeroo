// Qui encaisse le prix d'une course.
//
// Deux circuits coexistent. Les especes : le chauffeur prend l'argent en main
// et doit la commission a la societe. Tout le reste — carte, Wave, Orange
// Money : la societe encaisse, retient sa part, et porte au credit du chauffeur
// celle qui lui revient.
//
// La distinction commande des decisions d'argent, ici comme sur le serveur.
// Elle est donc ecrite une seule fois de chaque cote, et les deux listes
// doivent rester identiques — meme raison que pour countryCurrency.json, que
// les fonctions et les deux applications recopient chacune : les fonctions se
// deploient seules, sans le reste du depot.
//
// La liste du serveur est MOYENS_ENCAISSES dans functions/lib/helpers.js.
export const MOYENS_ENCAISSES = ['Card', 'Wave', 'OrangeMoney'];

/**
 * La societe a-t-elle encaisse le prix de cette course ?
 *
 * Un moyen de paiement absent — les courses anterieures a ce champ — compte
 * comme des especes : c'est le defaut prudent, celui qui n'ouvre aucun droit
 * par erreur.
 */
export function encaissePlateforme(booking) {
    if (!booking) return false;
    if (booking.payment_intent_id) return true;
    return MOYENS_ENCAISSES.includes(String(booking.payment_mode || ''));
}
