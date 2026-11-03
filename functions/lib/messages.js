// Textes des notifications push, en francais et en anglais.
//
// Le serveur ne peut pas choisir la langue tout seul : c'est l'app qui ecrit
// `users/{uid}/language` au demarrage, a cote du jeton push. Un compte sans ce
// champ — toute installation anterieure a la 1.6.0 — reste en francais, qui
// etait sa seule langue jusque-la.
//
// Les gabarits portent des marques `{nom}` remplacees par les parametres. Un
// parametre vide prend la valeur de `defauts`, parce qu'un nom de chauffeur
// manquant doit donner « Un chauffeur a accepte votre course », pas un trou.

const DEFAUT = 'fr';

/** Locale de mise en forme des nombres et des dates, par langue. */
const LOCALES = { fr: 'fr-FR', en: 'en-GB' };

const MESSAGES = {
  fr: {
    booking_request: {
      titre: 'Nouvelle demande de course',
      corps: 'Un passager cherche un chauffeur{depart}',
    },
    chat_message: {
      titre: 'Nouveau message',
      corps: '{texte}',
    },
    driver_near: {
      titre: 'Votre chauffeur arrive',
      corps: '{chauffeur} arrive au point de départ.',
      defauts: { chauffeur: 'Votre chauffeur' },
    },
    booking_accepted: {
      titre: 'Chauffeur trouvé',
      corps: '{chauffeur} a accepté votre course et se met en route.',
      defauts: { chauffeur: 'Un chauffeur' },
    },
    booking_started: {
      titre: 'Course démarrée',
      corps: 'Bonne route{avec} ! Vous pouvez suivre le trajet dans l\'application.',
    },
    booking_ended_amount: {
      titre: 'Course terminée',
      corps: 'Montant de la course : {montant}. Merci d\'avoir voyagé avec Heeroo.',
    },
    booking_ended: {
      titre: 'Course terminée',
      corps: 'Merci d\'avoir voyagé avec Heeroo.',
    },
    payment_due: {
      titre: 'Règlement attendu',
      corps: 'Votre chauffeur attend le règlement de la course.',
    },
    cancelled_by_rider: {
      titre: 'Course annulée',
      corps: '{passager} a annulé la course.',
      defauts: { passager: 'Le passager' },
    },
    cancelled_by_driver: {
      titre: 'Course annulée',
      corps: 'Le chauffeur n\'a pas pu prendre en charge votre course. Vous pouvez relancer une réservation.',
    },
    cancelled_driver: {
      titre: 'Course annulée',
      corps: 'La course a été annulée.',
    },
    cancelled_customer: {
      titre: 'Course annulée',
      corps: 'Votre course a été annulée.',
    },
    credit_empty: {
      titre: 'Crédit épuisé',
      corps: 'Votre crédit est de {solde}. Les courses en espèces s\'arrêtent sous {seuil} : votre prochaine course réglée par carte le remontera, ou rechargez-le depuis « Mes revenus ».',
    },
    credit_negative: {
      titre: 'Crédit négatif',
      corps: 'Votre crédit est de {solde}. Votre prochaine course réglée par carte le remontera.',
    },
  },

  en: {
    booking_request: {
      titre: 'New ride request',
      corps: 'A passenger is looking for a driver{depart}',
    },
    chat_message: {
      titre: 'New message',
      corps: '{texte}',
    },
    driver_near: {
      titre: 'Your driver is arriving',
      corps: '{chauffeur} is arriving at the pickup point.',
      defauts: { chauffeur: 'Your driver' },
    },
    booking_accepted: {
      titre: 'Driver found',
      corps: '{chauffeur} has accepted your ride and is on the way.',
      defauts: { chauffeur: 'A driver' },
    },
    booking_started: {
      titre: 'Ride started',
      corps: 'Enjoy the ride{avec}. You can follow the trip in the app.',
    },
    booking_ended_amount: {
      titre: 'Ride completed',
      corps: 'Ride total: {montant}. Thank you for travelling with Heeroo.',
    },
    booking_ended: {
      titre: 'Ride completed',
      corps: 'Thank you for travelling with Heeroo.',
    },
    payment_due: {
      titre: 'Payment due',
      corps: 'Your driver is waiting to be paid for the ride.',
    },
    cancelled_by_rider: {
      titre: 'Ride cancelled',
      corps: '{passager} cancelled the ride.',
      defauts: { passager: 'The passenger' },
    },
    cancelled_by_driver: {
      titre: 'Ride cancelled',
      corps: 'The driver could not take your ride. You can book another one.',
    },
    cancelled_driver: {
      titre: 'Ride cancelled',
      corps: 'The ride has been cancelled.',
    },
    cancelled_customer: {
      titre: 'Ride cancelled',
      corps: 'Your ride has been cancelled.',
    },
    credit_empty: {
      titre: 'Credit used up',
      corps: 'Your credit is {solde}. Cash rides stop below {seuil}: your next card-paid ride will bring it back up, or top it up from "My earnings".',
    },
    credit_negative: {
      titre: 'Credit in the red',
      corps: 'Your credit is {solde}. Your next card-paid ride will bring it back up.',
    },
  },
};

/** La langue si elle est connue, le francais sinon. */
function langueValide(code) {
  const langue = String(code || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(MESSAGES, langue) ? langue : DEFAUT;
}

/** Locale de mise en forme pour une langue. */
function localeDe(code) {
  return LOCALES[langueValide(code)];
}

function remplir(gabarit, valeurs) {
  return String(gabarit).replace(/\{(\w+)\}/g, (_, nom) => {
    const valeur = valeurs[nom];
    return valeur === undefined || valeur === null ? '' : String(valeur);
  });
}

/**
 * Titre et corps d'une notification, dans la langue demandee.
 *
 * Une cle inconnue leve : c'est une faute de programmation, pas une donnee
 * douteuse, et mieux vaut l'apprendre au test qu'envoyer « undefined » a un
 * chauffeur.
 */
function message(langue, cle, params) {
  const catalogue = MESSAGES[langueValide(langue)];
  const modele = catalogue[cle];
  if (!modele) throw new Error(`Notification inconnue : ${cle}`);

  const valeurs = Object.assign({}, modele.defauts);
  for (const [nom, valeur] of Object.entries(params || {})) {
    if (valeur !== undefined && valeur !== null && valeur !== '') valeurs[nom] = valeur;
  }

  return { titre: remplir(modele.titre, valeurs), corps: remplir(modele.corps, valeurs) };
}

module.exports = { MESSAGES, DEFAUT, LOCALES, langueValide, localeDe, message };
