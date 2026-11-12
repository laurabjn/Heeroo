'use strict';

// L'expédition d'un courriel, isolée du reste.
//
// Un seul secret, `SOS_SMTP`, contenant du JSON :
//
//   { "host": "smtp.exemple.fr", "port": 465, "user": "...", "pass": "...",
//     "from": "Heeroo <alerte@heeroo.fr>" }
//
// Pourquoi un seul secret plutôt que cinq : un mot de passe SMTP contient
// souvent des caractères qui doivent être encodés dans une URL de connexion
// (« @ », « / », « # »). Une URL mal encodée échoue au moment de l'envoi,
// c'est-à-dire le jour d'une agression. Du JSON n'a pas ce piège, et tout
// se pose en une commande :
//
//   firebase functions:secrets:set SOS_SMTP --project <projet>
//
// Si le secret est absent ou illisible, l'envoi n'est pas tenté et le
// déclencheur l'inscrit dans l'alerte. RIEN ici ne doit lever : une
// messagerie mal configurée ne doit pas faire échouer la fonction, sinon
// Cloud Functions la rejoue en boucle pour rien.

// Lecture et validation de la configuration. Pure, donc testable sans
// serveur : rend { ok, config } ou { ok: false, raison }.
function lireConfiguration(brut) {
    if (!brut || typeof brut !== 'string' || !brut.trim()) {
        return { ok: false, raison: 'secret SOS_SMTP absent' };
    }
    let c;
    try {
        c = JSON.parse(brut);
    } catch (erreur) {
        return { ok: false, raison: 'secret SOS_SMTP illisible (JSON invalide)' };
    }
    if (!c || typeof c !== 'object') {
        return { ok: false, raison: 'secret SOS_SMTP illisible (objet attendu)' };
    }

    const texte = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const host = texte(c.host);
    const user = texte(c.user);
    const pass = typeof c.pass === 'string' && c.pass ? c.pass : null;
    const from = texte(c.from) || user;
    const manquants = [];
    if (!host) { manquants.push('host'); }
    if (!user) { manquants.push('user'); }
    if (!pass) { manquants.push('pass'); }
    if (manquants.length) {
        return { ok: false, raison: 'secret SOS_SMTP incomplet : ' + manquants.join(', ') };
    }

    // 465 est le port implicite : c'est celui du SMTP chiffré de bout en
    // bout, et le défaut de la quasi-totalite des hébergeurs. `secure` en
    // découle plutôt que d'être un réglage de plus à se tromper.
    const port = Number(c.port) > 0 ? Number(c.port) : 465;
    return {
        ok: true,
        config: { host, port, secure: port === 465, auth: { user, pass }, from },
    };
}

// L'envoi. Ne lève jamais : rend { envoye: true } ou { envoye: false, raison }.
// `fabrique` n'existe que pour les tests, qui y passent un double de
// nodemailer et relisent ce qu'on lui a demandé d'expédier.
async function envoyer(brutDuSecret, message, fabrique) {
    const lu = lireConfiguration(brutDuSecret);
    if (!lu.ok) { return { envoye: false, raison: lu.raison }; }

    const m = message || {};
    if (!m.to) { return { envoye: false, raison: 'aucun destinataire' }; }

    try {
        const creer = fabrique || require('nodemailer').createTransport;
        const transport = creer({
            host: lu.config.host,
            port: lu.config.port,
            secure: lu.config.secure,
            auth: lu.config.auth,
        });
        const info = await transport.sendMail({
            from: lu.config.from,
            to: m.to,
            subject: m.sujet,
            text: m.texte,
            html: m.html,
        });
        return { envoye: true, id: (info && info.messageId) || null };
    } catch (erreur) {
        return { envoye: false, raison: (erreur && erreur.message) || 'envoi refusé' };
    }
}

module.exports = { lireConfiguration, envoyer };
