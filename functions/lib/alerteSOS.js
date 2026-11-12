'use strict';

// La composition du courriel envoyé à Heeroo quand un chauffeur déclenche
// le bouton SOS. Demandé par le client le 11 nov. 2026.
//
// Tout ici est PUR : aucune lecture de base, aucun envoi. Le déclencheur de
// index.js rassemble les données, ce fichier les met en forme, et lib/courriel.js
// les expédie. Cette séparation existe pour que le contenu du message — le seul
// endroit où une erreur se verrait au pire moment — soit vérifiable par des
// tests unitaires sans Firebase ni serveur de messagerie.

// Les fuseaux dont on est sûr. Un pays absent affiche l'heure UTC seule :
// mieux vaut une heure explicitement universelle qu'une heure fausse.
// Les États-Unis sont volontairement absents (six fuseaux).
const FUSEAUX = {
    FR: 'Europe/Paris',
    BE: 'Europe/Brussels',
    DE: 'Europe/Berlin',
    SN: 'Africa/Dakar',
    GM: 'Africa/Banjul',
    PF: 'Pacific/Tahiti',
};

// L'adresse qui reçoit les alertes, prise dans la table settings du
// back-office (colonne « E-mail SOS »), pays par pays.
//
// Le repli n'est pas une coquetterie : une alerte qui ne part pas parce
// qu'une ligne de pays est vide est une alerte perdue. On essaie donc le
// pays, puis la France — le même repli que checkIfCountryAvailable côté
// application — puis la première adresse renseignée, quelle qu'elle soit.
function adresseSOS(settings, codePays) {
    const liste = Array.isArray(settings) ? settings : Object.values(settings || {});
    const propre = (v) => (typeof v === 'string' && v.indexOf('@') > 0 ? v.trim() : null);

    const pour = (code) => {
        if (!code) { return null; }
        for (const ligne of liste) {
            if (ligne && ligne.country === code) { return propre(ligne.sosEmail); }
        }
        return null;
    };

    const exact = pour(codePays ? String(codePays).toUpperCase() : null);
    if (exact) { return exact; }
    const france = pour('FR');
    if (france) { return france; }
    for (const ligne of liste) {
        const a = propre(ligne && ligne.sosEmail);
        if (a) { return a; }
    }
    return null;
}

// L'heure de l'appel, dans le fuseau du pays quand on le connaît, et
// toujours suivie de l'heure UTC pour lever toute ambiguïté.
function heureLisible(horodatage, codePays) {
    const quand = new Date(typeof horodatage === 'number' ? horodatage : Date.now());
    const format = (fuseau) => new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short', timeStyle: 'short', timeZone: fuseau,
    }).format(quand);

    const fuseau = FUSEAUX[String(codePays || '').toUpperCase()];
    const utc = format('UTC') + ' UTC';
    if (!fuseau) { return utc; }
    try {
        return format(fuseau) + ' (' + fuseau + ') — ' + utc;
    } catch (erreur) {
        return utc;
    }
}

function nomComplet(profil) {
    const p = profil || {};
    const nom = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return nom || null;
}

// Le lien de carte. Toujours construit sur les coordonnées et jamais sur
// l'adresse : un libellé peut être approximatif, un couple de coordonnées
// ne l'est pas.
function lienCarte(position) {
    if (!position) { return null; }
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    if (!isFinite(lat) || !isFinite(lng)) { return null; }
    if (lat === 0 && lng === 0) { return null; }
    return 'https://www.google.com/maps?q=' + lat + ',' + lng;
}

function echapper(texte) {
    return String(texte === null || texte === undefined ? '' : texte)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Le message complet. `donnees` rassemble ce que le déclencheur a lu :
//   alerte     ce que l'application a écrit sous sos_alerts/{id}
//   chauffeur  le noeud users/{uid} du chauffeur
//   course     le noeud bookings/{id}, ou null
function composerCourriel(donnees) {
    const d = donnees || {};
    const alerte = d.alerte || {};
    const chauffeur = d.chauffeur || {};
    const course = d.course || null;

    const versSecours = alerte.destinataire !== 'heeroo';
    const qui = nomComplet(chauffeur) || 'Un chauffeur';
    const numero = alerte.numero || '(numéro inconnu)';
    const pays = alerte.pays || chauffeur.country || null;

    const sujet = 'SOS Heeroo — ' + qui + ' a appelé '
        + (versSecours ? 'les secours (' + numero + ')' : 'Heeroo');

    const position = chauffeur.location || null;
    const carte = lienCarte(position);

    // --------------------------------------------------------- version texte
    const lignes = [];
    lignes.push(versSecours
        ? 'Un chauffeur Heeroo vient d’appeler les secours depuis le bouton SOS de l’application.'
        : 'Un chauffeur Heeroo vient d’appeler Heeroo depuis le bouton SOS de l’application.');
    lignes.push('');
    lignes.push('APPEL');
    lignes.push('  Numéro composé : ' + numero + (versSecours ? ' (secours)' : ' (Heeroo)'));
    lignes.push('  Heure          : ' + heureLisible(alerte.at, pays));
    lignes.push('');
    lignes.push('CHAUFFEUR');
    lignes.push('  Nom       : ' + (nomComplet(chauffeur) || '(inconnu)'));
    lignes.push('  Téléphone : ' + (chauffeur.mobile || '(inconnu)'));
    lignes.push('  E-mail    : ' + (chauffeur.email || '(inconnu)'));
    if (chauffeur.vehicleModel || chauffeur.vehicleNumber) {
        lignes.push('  Véhicule  : ' + [chauffeur.vehicleModel, chauffeur.vehicleNumber].filter(Boolean).join(' — '));
    }
    if (pays) { lignes.push('  Pays      : ' + pays); }
    lignes.push('');
    lignes.push('DERNIÈRE POSITION CONNUE');
    if (carte) {
        if (position.add) { lignes.push('  ' + position.add); }
        lignes.push('  ' + position.lat + ', ' + position.lng);
        lignes.push('  ' + carte);
        lignes.push('  Position enregistrée par l’application : elle peut dater de quelques minutes.');
    } else {
        lignes.push('  Aucune position enregistrée pour ce chauffeur.');
    }
    lignes.push('');
    if (course) {
        lignes.push('COURSE EN COURS');
        lignes.push('  Référence : ' + (alerte.bookingId || '(inconnue)'));
        const passager = [course.customer_name, course.customer_contact].filter(Boolean).join(' — ');
        lignes.push('  Passager  : ' + (passager || '(inconnu)'));
        if (course.pickupAddress) { lignes.push('  Départ    : ' + course.pickupAddress); }
        if (course.dropAddress) { lignes.push('  Arrivée   : ' + course.dropAddress); }
        if (course.status) { lignes.push('  État      : ' + course.status); }
        if (course.vehicle_number) { lignes.push('  Véhicule  : ' + course.vehicle_number); }
    } else {
        lignes.push('COURSE');
        lignes.push('  Aucune course en cours au moment de l’appel.');
    }
    lignes.push('');
    lignes.push('Téléphone : ' + (alerte.plateforme || 'inconnu')
        + (alerte.version ? ', application ' + alerte.version : ''));
    lignes.push('');
    lignes.push('Message envoyé automatiquement par Heeroo. Il signale un appel, il ne le remplace pas.');

    const texte = lignes.join('\n');

    // ---------------------------------------------------------- version HTML
    const h = [];
    h.push('<p><strong>' + echapper(versSecours
        ? 'Un chauffeur Heeroo vient d’appeler les secours'
        : 'Un chauffeur Heeroo vient d’appeler Heeroo') + '</strong> depuis le bouton SOS de l’application.</p>');
    h.push('<table cellpadding="4" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">');
    const ligne = (titre, valeur) => {
        h.push('<tr><td style="color:#666">' + echapper(titre) + '</td><td>' + valeur + '</td></tr>');
    };
    ligne('Numéro composé', echapper(numero) + (versSecours ? ' (secours)' : ' (Heeroo)'));
    ligne('Heure', echapper(heureLisible(alerte.at, pays)));
    ligne('Chauffeur', echapper(nomComplet(chauffeur) || '(inconnu)'));
    if (chauffeur.mobile) {
        ligne('Téléphone', '<a href="tel:' + echapper(String(chauffeur.mobile).replace(/\s/g, '')) + '">' + echapper(chauffeur.mobile) + '</a>');
    }
    if (chauffeur.email) { ligne('E-mail', echapper(chauffeur.email)); }
    if (chauffeur.vehicleModel || chauffeur.vehicleNumber) {
        ligne('Véhicule', echapper([chauffeur.vehicleModel, chauffeur.vehicleNumber].filter(Boolean).join(' — ')));
    }
    if (pays) { ligne('Pays', echapper(pays)); }
    if (carte) {
        ligne('Position', (position.add ? echapper(position.add) + '<br>' : '')
            + '<a href="' + echapper(carte) + '">Ouvrir la carte</a>');
    } else {
        ligne('Position', 'Aucune position enregistrée');
    }
    if (course) {
        ligne('Course', echapper(alerte.bookingId || '(inconnue)'));
        if (course.customer_name || course.customer_contact) {
            ligne('Passager', echapper([course.customer_name, course.customer_contact].filter(Boolean).join(' — ')));
        }
        if (course.pickupAddress) { ligne('Départ', echapper(course.pickupAddress)); }
        if (course.dropAddress) { ligne('Arrivée', echapper(course.dropAddress)); }
        if (course.status) { ligne('État', echapper(course.status)); }
    } else {
        ligne('Course', 'Aucune course en cours');
    }
    ligne('Téléphone', echapper((alerte.plateforme || 'inconnu') + (alerte.version ? ', application ' + alerte.version : '')));
    h.push('</table>');
    h.push('<p style="color:#666;font-family:sans-serif;font-size:12px">Message envoyé automatiquement par Heeroo. Il signale un appel, il ne le remplace pas.</p>');

    return { sujet, texte, html: h.join('\n') };
}

module.exports = { adresseSOS, composerCourriel, heureLisible, lienCarte, nomComplet, FUSEAUX };
