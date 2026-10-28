// Le seuil de credit sous lequel un chauffeur ne recoit plus de course en
// especes, et la monnaie dans laquelle ce seuil s'exprime.
//
// Le meme calcul vit cote serveur, dans functions/lib/helpers.js : c'est lui
// qui decide quand prevenir le chauffeur par notification. Les deux doivent
// dire la meme chose, sans quoi l'application le bloquerait sans l'avertir, ou
// l'avertirait sans le bloquer.

import countryCurrency from './../constants/countryCurrency.json';

// Symbole affiche au chauffeur. Une monnaie absente s'affiche par son code :
// « 12 MGA » est moins elegant que « 12 Ar », mais reste juste.
export const SYMBOLES_MONNAIE = { EUR: '\u20ac', XOF: 'FCFA', XAF: 'FCFA', GBP: '\u00a3', GMD: 'D' };

/** Monnaie d'un pays. Un pays inconnu compte comme l'euro. */
export function monnaieDuPays(country) {
    return countryCurrency[String(country || '').toUpperCase()] || 'EUR';
}

export function symboleMonnaie(monnaie) {
    return SYMBOLES_MONNAIE[monnaie] || monnaie;
}

/**
 * Seuil de credit sous lequel les courses en especes s'arretent, dans la
 * monnaie du pays de depart. Rend null quand aucune regle ne s'applique.
 *
 * Un seuil negatif est un decouvert tolere : le chauffeur n'avance rien, son
 * credit descend au fil des commissions qu'il doit sur ses courses en especes,
 * et celles-ci s'arretent une fois la limite atteinte. Les courses encaissees
 * par la societe restent disponibles — ce sont elles qui le ramenent au-dessus,
 * puisque sa part vient s'ajouter a son credit.
 *
 * Zero reste la facon documentee de desactiver la regle pour une monnaie, et ne
 * devient pas « bloquer des le premier centime de dette » : des pays ont ce
 * reglage a 0 aujourd'hui, et le sens d'une valeur deja en base ne doit pas
 * changer sous les pieds de l'exploitant.
 */
export function seuilDeCredit(reglages, country) {
    const valeurs = reglages && typeof reglages === 'object' ? reglages : {};
    const monnaie = monnaieDuPays(country);
    // `minDriverBalance` sans suffixe est l'ancien nom du seuil senegalais, pose
    // avant que d'autres monnaies existent : il ne vaut donc que pour le franc
    // CFA. S'en servir de valeur par defaut partout appliquerait 5 000 — des
    // milliers de francs — a un pays qui compte en livres ou en euros.
    const herite = monnaie === 'XOF' || monnaie === 'XAF' ? valeurs.minDriverBalance : undefined;
    const brut = valeurs['minDriverBalance' + monnaie] !== undefined
        ? valeurs['minDriverBalance' + monnaie]
        : herite;
    if (brut === undefined || brut === null || brut === '') return null;
    const seuil = Number(brut);
    if (!Number.isFinite(seuil) || seuil === 0) return null;
    return seuil;
}
