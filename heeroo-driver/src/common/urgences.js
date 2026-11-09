// Les numéros d'urgence officiels, écrits EN DUR dans l'application.
//
// Pourquoi en dur et non dans le back-office, alors que le numéro de Heeroo
// y est déjà (Réglages → Paramètres SOS) :
//
//   - un numéro d'urgence n'est pas un réglage commercial, c'est une
//     constante légale du pays. Personne ne doit pouvoir le changer par
//     mégarde depuis une interface d'administration ;
//   - une faute de frappe dans ce champ ne se verrait que le jour où
//     quelqu'un appuie sur le bouton, c'est-à-dire au pire moment ;
//   - il doit fonctionner sans réseau. Le numéro de Heeroo vient de la base
//     et peut manquer ; celui-ci est dans le binaire, il est toujours là.
//
// Vérifiés le 9 nov. 2026, et seuls ceux dont la source est solide figurent
// ici. Un pays absent de la liste reçoit le 112, qui est le numéro d'urgence
// unique européen et qui aboutit sur la plupart des réseaux GSM ailleurs.
//
//   112  France, Belgique, Allemagne, Polynésie française (territoire
//        français) — numéro unique européen.
//   911  États-Unis.
//   17   Sénégal : police secours, 24 h/24 sur tout le territoire. Le 18
//        est celui des sapeurs-pompiers. Pour un bouton unique dans une
//        application de VTC, la police est le bon interlocuteur : les
//        incidents visés sont l'agression et l'accident, pas le malaise.
//   117  Gambie : police.
//
// Volontairement ABSENTS, bien qu'ils soient dans settings/ : le Cameroun
// et le Bénin. Les sources trouvées sont des agrégateurs qui se contredisent
// (117 ou 112 selon la page), et aucune n'est officielle. Plutôt que d'y
// écrire un numéro peut-être faux, ces deux pays retombent sur le 112.
// Avant d'en ajouter un, vérifier auprès de l'autorité locale — pas sur un
// site de voyage.
export const NUMERO_PAR_DEFAUT = '112';

const NUMEROS_VERIFIES = {
    FR: '112',
    BE: '112',
    DE: '112',
    PF: '112',
    US: '911',
    SN: '17',
    GM: '117',
};

// Le numéro d'urgence du pays, ou le 112 si le pays est inconnu. Ne renvoie
// jamais rien de vide : le bouton doit toujours avoir quelque chose à
// composer.
export function numeroUrgence(codePays) {
    if (!codePays) { return NUMERO_PAR_DEFAUT; }
    return NUMEROS_VERIFIES[String(codePays).toUpperCase()] || NUMERO_PAR_DEFAUT;
}

// Le numéro tel que `tel:` l'accepte. Les numéros saisis au back-office
// contiennent des espaces (« +33 7 12 12 12 12 ») : sur certains téléphones
// le composeur s'ouvre vide avec eux.
export function numeroAppelable(numero) {
    if (!numero) { return null; }
    const propre = String(numero).replace(/[^+0-9]/g, '');
    // Le + n'a de sens qu'en tête : « 06+12 » n'est pas un numéro.
    return propre.charAt(0) === '+'
        ? '+' + propre.slice(1).replace(/\+/g, '')
        : propre.replace(/\+/g, '');
}

// Un numéro utilisable, c'est-à-dire assez long pour en être un. Sert à ne
// PAS afficher le choix « Heeroo » quand le champ du back-office est vide :
// mieux vaut un seul bouton qui marche que deux dont un échoue.
export function numeroUtilisable(numero) {
    const propre = numeroAppelable(numero);
    return !!propre && propre.replace(/\D/g, '').length >= 4;
}

// Le numéro de Heeroo pour un pays, lu dans l'instantané de settings/.
// settings/ est tantôt un tableau, tantôt un objet indexé selon la façon
// dont il a été écrit : les deux formes se rencontrent en production, d'où
// Object.values.
export function numeroHeeroo(settings, codePays) {
    if (!settings || !codePays) { return null; }
    const liste = Array.isArray(settings) ? settings : Object.values(settings || {});
    for (let i = 0; i < liste.length; i++) {
        const ligne = liste[i];
        if (ligne && ligne.country === codePays && numeroUtilisable(ligne.panic)) {
            return ligne.panic;
        }
    }
    return null;
}
