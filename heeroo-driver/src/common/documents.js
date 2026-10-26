// Les pièces demandées à l'inscription d'un chauffeur dépendent de son pays.
//
// La liste était celle de la France, écrite en dur dans le formulaire : carte
// VTC, relevé d'information restreint, attestation à titre onéreux et carte
// verte sont des documents français, sans équivalent au Sénégal — où l'on
// demande en revanche la visite technique du véhicule.
//
// Un chauffeur sénégalais se trouvait donc devant cinq cases qu'il ne pouvait
// pas remplir, et le formulaire refusait de se valider tant qu'elles étaient
// vides : son inscription était impossible, sans qu'aucun message ne le dise.

const DOCUMENTS_PAR_PAYS = {
    FR: [
        'file_identity_front',
        'file_identity_back',
        'carteGrise',
        'permis',
        'carteVTC',
        'rir',
        'attestation',
        'carteVerte',
        'assuranceRC',
        'photoAvantVehicule',
        'photoChauffeur',
    ],
    SN: [
        'permis',
        'assuranceRC',
        'carteGrise',
        'visiteTechnique',
        'photoChauffeur',
    ],
};

// Un pays sans liste propre reçoit celle de la France : c'est le marché
// d'origine, et demander trop vaut mieux que d'approuver un chauffeur sur un
// dossier vide.
const PAYS_PAR_DEFAUT = 'FR';

/** Les pièces à demander dans ce pays, celles de la France à défaut. */
export function documentsPour(pays) {
    const code = String(pays || '').trim().toUpperCase();
    return DOCUMENTS_PAR_PAYS[code] || DOCUMENTS_PAR_PAYS[PAYS_PAR_DEFAUT];
}

/**
 * Toutes les pièces, tous pays confondus.
 *
 * Le formulaire initialise son état sur cette liste et non sur celle du pays :
 * la position est détectée en arrière-plan et peut arriver après le premier
 * rendu, ou ne jamais arriver. Des clés d'état manquantes produiraient alors
 * des champs non contrôlés plutôt qu'une erreur visible.
 */
export const TOUS_LES_DOCUMENTS = Object.values(DOCUMENTS_PAR_PAYS)
    .reduce((tous, liste) => tous.concat(liste.filter((d) => !tous.includes(d))), []);

export { DOCUMENTS_PAR_PAYS, PAYS_PAR_DEFAUT };
