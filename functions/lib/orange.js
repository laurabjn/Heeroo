'use strict';

// Orange Money Web Payment — Senegal.
//
// Meme deroule que Wave : on ouvre une page de paiement hebergee par
// l'operateur, le passager (ou le chauffeur, pour une recharge) y paie, et le
// serveur apprend le resultat de deux facons.
//
// Trois differences avec Wave, qui expliquent la forme de ce module.
//
// 1. L'appel est authentifie par un jeton OAuth2 de courte duree, obtenu par
//    « client credentials ». Il est garde en memoire d'une invocation a
//    l'autre : les instances de Cloud Functions se reutilisent, et redemander
//    un jeton a chaque paiement serait un aller-retour pour rien.
//
// 2. La notification d'Orange n'est pas signee. Elle porte le « notif_token »
//    rendu a l'ouverture du paiement, et c'est lui, et lui seul, qui
//    l'authentifie : on le conserve a l'ouverture et on le compare a la
//    reception, en temps constant. Une notification sans le bon jeton est
//    rejetee — sinon n'importe qui pourrait declarer une course payee.
//
// 3. Cette notification est reputee peu fiable. La verification de statut au
//    retour dans l'application n'est donc pas un secours ici, c'est le chemin
//    principal. Le reglement passe par les memes fonctions idempotentes que
//    Wave, de sorte que les deux chemins puissent arriver sans crediter deux
//    fois.
//
// Le reseau est injecte (parametre « fetch ») pour que le module se teste sans
// appeler Orange.

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// LES TROIS URL. C'est le seul endroit a corriger le jour de la mise en
// service : Orange livre ses chemins exacts avec le contrat marchand, et les
// sources publiques ne s'accordent pas sur la forme de deux d'entre eux.
// Rien d'autre dans ce fichier ne depend de leur valeur.
// ---------------------------------------------------------------------------
const BASE = 'https://api.orange.com/orange-money-webpay';
const CHEMIN_JETON = '/v1/oauth/token';            // POST, Basic + grant_type=client_credentials
const CHEMIN_PAIEMENT = '/v1/webpayment';          // POST, Bearer
const CHEMIN_STATUT = '/v1/transactionstatus';     // POST, Bearer

// Le bac a sable et la production ne diffèrent que par le segment de pays et
// la monnaie : « dev » et OUV d'un cote, « sn » et XOF de l'autre. Les deux
// vont ensemble — payer en XOF sur le bac a sable est refuse, et payer en OUV
// en production encaisserait de la monnaie de singe. D'ou une seule table.
const ENVIRONNEMENTS = {
  sandbox: { chemin: 'dev', monnaie: 'OUV' },
  senegal: { chemin: 'sn', monnaie: 'XOF' },
};

// Le bac a sable par defaut, pour qui appelle ce module sans rien preciser. Un
// oubli de reglage fait donc echouer les paiements au lieu d'en encaisser dans
// le vide, et cela se voit tout de suite.
//
// C'est un garde-fou, pas le reglage : index.js, lui, passe toujours un
// environnement explicite, deduit du projet Firebase.
const ENV_DEFAUT = 'sandbox';

/** Reglages d'un environnement. Un nom inconnu est une erreur, jamais un defaut. */
function environnement(nom) {
  const cle = String(nom || ENV_DEFAUT).trim().toLowerCase();
  const reglages = Object.prototype.hasOwnProperty.call(ENVIRONNEMENTS, cle)
    ? ENVIRONNEMENTS[cle]
    : null;
  if (!reglages) {
    throw new Error(`Environnement Orange Money inconnu : ${nom} (attendu : ${Object.keys(ENVIRONNEMENTS).join(', ')})`);
  }
  return { nom: cle, ...reglages };
}

// Les statuts qu'Orange rend sur une transaction.
//
// Un statut inconnu compte comme « en cours », jamais comme un echec : declarer
// perdue une course peut-etre payee ferait un passager quitte et un chauffeur
// non paye. On attend plutot d'avoir une reponse qu'on sait lire.
const STATUTS = {
  SUCCESS: 'completed',
  INITIATED: 'pending',
  PENDING: 'pending',
  FAILED: 'failed',
  EXPIRED: 'failed',
};

/** 'completed', 'pending' ou 'failed' a partir du statut rendu par Orange. */
function issueDuStatut(statut) {
  const cle = String(statut || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(STATUTS, cle) ? STATUTS[cle] : 'pending';
}

/**
 * Reference de commande, que nous fabriquons — contrairement a Wave, dont
 * l'identifiant de session vient de chez lui.
 *
 * C'est a la fois l'« order_id » envoye a Orange et la clef de notre
 * enregistrement en base, d'ou les seuls caracteres acceptes par une clef
 * Realtime Database. L'horodatage rend les references triables, l'alea les
 * rend impossibles a deviner.
 */
function referenceCommande(prefixe) {
  const alea = crypto.randomBytes(9).toString('base64url');
  return `${prefixe}-${Date.now().toString(36)}-${alea}`;
}

/**
 * Le jeton de notification recu est-il celui que nous avons garde ?
 *
 * Comparaison en temps constant, et sur des chaines non vides : sans ce
 * garde-fou, un enregistrement depourvu de jeton accepterait une notification
 * qui n'en porte pas non plus.
 */
function jetonValide(recu, attendu) {
  const a = String(recu || '');
  const b = String(attendu || '');
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Client Orange Money.
 *
 * @param {object} config
 * @param {string} config.authHeader   en-tete « Basic … » fourni par la console Orange
 * @param {string} config.merchantKey  clef marchande
 * @param {string} [config.env]        'sandbox' (defaut) ou 'senegal'
 * @param {function} [config.fetch]    pour les tests
 */
function creerClient({ authHeader, merchantKey, env, fetch: reseau } = {}) {
  if (!authHeader) throw new Error('Orange Money : en-tete d\'authentification manquant');
  if (!merchantKey) throw new Error('Orange Money : clef marchande manquante');

  const reglages = environnement(env);
  const racine = `${BASE}/${reglages.chemin}`;
  const appeler = reseau || fetch;

  // Jeton OAuth2 garde en memoire. La marge de soixante secondes evite de
  // partir avec un jeton qui expirera pendant l'appel suivant.
  let jeton = null;
  let jetonExpire = 0;

  async function obtenirJeton() {
    if (jeton && Date.now() < jetonExpire) return jeton;
    const reponse = await appeler(racine + CHEMIN_JETON, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !corps.access_token) {
      throw erreurOrange(reponse.status, corps, 'jeton refuse');
    }
    jeton = `Bearer ${corps.access_token}`;
    const duree = Number(corps.expires_in);
    jetonExpire = Date.now() + (Number.isFinite(duree) && duree > 60 ? duree - 60 : 240) * 1000;
    return jeton;
  }

  async function appelAuthentifie(chemin, corpsEnvoye) {
    // Un jeton peut expirer entre deux appels malgre la marge. Un seul
    // reessai, apres avoir jete le jeton : au-dela, c'est que les
    // identifiants sont faux, et insister n'y changerait rien.
    for (let essai = 0; essai < 2; essai += 1) {
      const autorisation = await obtenirJeton();
      const reponse = await appeler(racine + chemin, {
        method: 'POST',
        headers: { Authorization: autorisation, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpsEnvoye),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (reponse.ok) return corps;
      if (reponse.status === 401 && essai === 0) {
        jeton = null;
        jetonExpire = 0;
        continue;
      }
      throw erreurOrange(reponse.status, corps, `a repondu ${reponse.status}`);
    }
    throw erreurOrange(401, {}, 'authentification impossible');
  }

  return {
    monnaie: reglages.monnaie,
    environnement: reglages.nom,

    /**
     * Ouvre une page de paiement.
     *
     * Rend { payToken, paymentUrl, notifToken }. Le notifToken est a conserver :
     * c'est lui qui authentifiera la notification d'Orange.
     */
    async ouvrirPaiement({ montant, reference, retourUrl, annulUrl, notifUrl, langue }) {
      const entier = Math.round(Number(montant));
      if (!Number.isFinite(entier) || entier <= 0) {
        throw new Error(`Orange Money : montant invalide (${montant})`);
      }
      const corps = await appelAuthentifie(CHEMIN_PAIEMENT, {
        merchant_key: merchantKey,
        currency: reglages.monnaie,
        order_id: reference,
        amount: entier,
        return_url: retourUrl,
        cancel_url: annulUrl,
        notif_url: notifUrl,
        lang: langue === 'en' ? 'en' : 'fr',
      });
      if (!corps.payment_url || !corps.pay_token) {
        throw erreurOrange(502, corps, 'reponse sans page de paiement');
      }
      return {
        payToken: corps.pay_token,
        paymentUrl: corps.payment_url,
        notifToken: corps.notif_token || null,
      };
    },

    /**
     * Ou en est une transaction ? Rend { issue, brut, txnid, montant }.
     *
     * Les trois parametres sont exiges ensemble par Orange : la reference, le
     * montant et le jeton de paiement doivent concorder. C'est une difference
     * de fond avec Wave, qui nous rend le montant encaisse : ici le montant est
     * une *entree*, et un SUCCESS signifie donc qu'Orange a lui-meme rapproche
     * la reference et la somme. Le rapprochement est fait de son cote.
     *
     * « montant » n'est rendu que si Orange le renvoie, et vaut null sinon :
     * mieux vaut un trou franc qu'un chiffre invente, que l'appelant
     * confronterait a lui-meme en croyant verifier quelque chose.
     */
    async statut({ reference, montant, payToken }) {
      const corps = await appelAuthentifie(CHEMIN_STATUT, {
        order_id: reference,
        amount: Math.round(Number(montant)),
        pay_token: payToken,
      });
      // Number(null) et Number('') valent zero : sans ce filtre, un montant
      // absent reviendrait comme « 0 encaisse », soit precisement le chiffre
      // invente que l'appelant croirait pouvoir rapprocher.
      const annonce = corps.amount;
      const rendu = annonce === null || annonce === undefined || annonce === ''
        ? NaN
        : Number(annonce);
      return {
        issue: issueDuStatut(corps.status),
        brut: String(corps.status || ''),
        txnid: corps.txnid || null,
        montant: Number.isFinite(rendu) ? rendu : null,
      };
    },
  };
}

/** Erreur portant le statut HTTP, pour que l'appelant sache quoi en faire. */
function erreurOrange(status, corps, resume) {
  const detail = (corps && (corps.message || corps.description || corps.error)) || resume;
  const error = new Error(`Orange Money : ${detail}`);
  error.status = status;
  error.corps = corps;
  return error;
}

module.exports = {
  BASE,
  CHEMIN_JETON,
  CHEMIN_PAIEMENT,
  CHEMIN_STATUT,
  ENVIRONNEMENTS,
  ENV_DEFAUT,
  STATUTS,
  environnement,
  issueDuStatut,
  referenceCommande,
  jetonValide,
  creerClient,
};
