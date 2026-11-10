// Ce que l'ecran d'inscription doit dire quand Firebase refuse la creation
// d'un compte.
//
// Pourquoi ce fichier existe. Le bloc catch affichait « Un autre compte
// utilise deja cette adresse e-mail » quelle que soit l'erreur : coupure
// reseau, adresse mal formee, trop de tentatives, panne chez Google. La
// personne cherchait donc un probleme de compte la ou il n'y en avait pas, et
// changeait d'adresse pour rien. Corrige le 10 nov. 2026, en meme temps que la
// regle du mot de passe — voir motDePasse.js, c'est la meme famille de
// confusion.
//
// La table est exportee pour que les essais puissent la parcourir et verifier
// que CHAQUE cle citee ici existe vraiment dans les deux dictionnaires. Une
// cle absente afficherait « undefined » dans l'alerte, ce qui serait pire que
// le message faux qu'on vient d'enlever.
//
// champ designe le champ a reprendre : c'est lui qui recoit le curseur. Pour
// une coupure reseau il n'y a rien a corriger, donc rien a deplacer.

export const PAR_DEFAUT = { cle: 'erreur_inscription_inconnue', champ: null };

export const TABLE = {
    'auth/email-already-in-use': { cle: 'email_already_used', champ: 'email' },
    'auth/invalid-email': { cle: 'valid_email_check', champ: 'email' },
    'auth/missing-email': { cle: 'valid_email_check', champ: 'email' },
    'auth/weak-password': { cle: 'password_alphaNumeric_check', champ: 'motdepasse' },
    'auth/missing-password': { cle: 'password_alphaNumeric_check', champ: 'motdepasse' },
    'auth/network-request-failed': { cle: 'login_network', champ: null },
    'auth/too-many-requests': { cle: 'erreur_trop_de_tentatives', champ: null },
    'auth/operation-not-allowed': { cle: 'erreur_inscription_indisponible', champ: null },
    'auth/internal-error': { cle: 'erreur_inscription_inconnue', champ: null },
};

export function erreurInscription(erreur) {
    const code = erreur && typeof erreur.code === 'string' ? erreur.code : '';
    return TABLE[code] || PAR_DEFAUT;
}
