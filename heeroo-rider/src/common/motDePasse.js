// La regle du mot de passe a la creation d'un compte.
//
// Pourquoi ce fichier existe. La regle etait ecrite deux fois, une par
// application, sous la forme /^([a-zA-Z0-9@*#]{8,15})$/ : quinze caracteres
// au maximum, et rien d'autre que les lettres, les chiffres et @ * #.
// Le gestionnaire de mots de passe de Google, actif sur une bonne partie des
// telephones Android, propose a l'inscription un mot de passe de quinze a
// vingt caracteres contenant des tirets et des symboles. Il etait donc refuse
// a chaque fois, par un message qui ne disait pas pourquoi : la personne en
// concluait que l'application exigeait quelque chose de tres long et de tres
// complique. Le client l'a signale le 10 nov. 2026.
//
// Ce qu'on garde : une longueur minimale, et rien d'autre. Pas de maximum,
// Firebase acceptant jusqu'a 4096 caracteres. Et aucune contrainte de
// composition : exiger une majuscule, un chiffre et un symbole pousse vers
// « Motdepasse1! » plutot que vers un mot de passe reellement solide.
//
// La connexion, elle, ne verifie rien du tout : elle laisse Firebase repondre.
// Assouplir cette regle ne peut donc enfermer personne dehors, et les comptes
// deja crees continuent de fonctionner tels quels.

export const LONGUEUR_MINIMALE = 8;

export function motDePasseValide(motDePasse) {
    return typeof motDePasse === 'string' && motDePasse.length >= LONGUEUR_MINIMALE;
}
