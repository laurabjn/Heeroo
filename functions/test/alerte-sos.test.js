'use strict';

// Tests du signalement des appels d'urgence (node --test).
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//   1. qu'une alerte trouve toujours un destinataire dès qu'UNE adresse
//      existe quelque part — une alerte perdue est le seul vrai échec ;
//   2. que le courriel dise où est le chauffeur et qui est à bord ;
//   3. qu'une messagerie mal configurée ne fasse jamais lever quoi que ce
//      soit, sinon Cloud Functions rejoue le déclencheur en boucle.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { adresseSOS, composerCourriel, heureLisible, lienCarte, nomComplet } = require('../lib/alerteSOS');
const { lireConfiguration, envoyer } = require('../lib/courriel');

const REGLAGES = [
    { country: 'FR', panic: '+33 1 23 45 67 89', sosEmail: 'alerte@heeroo.fr' },
    { country: 'SN', panic: '+221 77 000 00 00', sosEmail: 'dakar@heeroo.fr' },
    { country: 'BE', panic: '+32 7 13 13 13 13' },
];

describe('adresseSOS', () => {
    test('le pays a son adresse', () => {
        assert.equal(adresseSOS(REGLAGES, 'SN'), 'dakar@heeroo.fr');
        assert.equal(adresseSOS(REGLAGES, 'FR'), 'alerte@heeroo.fr');
    });
    test('le code pays est insensible a la casse', () => {
        assert.equal(adresseSOS(REGLAGES, 'sn'), 'dakar@heeroo.fr');
    });
    test('un pays sans adresse retombe sur la France', () => {
        assert.equal(adresseSOS(REGLAGES, 'BE'), 'alerte@heeroo.fr');
    });
    test('le repli vise bien la France, et non la premiere ligne venue', () => {
        // La France n'est PAS en tete ici : sans ce jeu d'essai, supprimer le
        // repli sur la France passerait inapercu, le repli generique rendant
        // par hasard la meme adresse.
        const franceEnDeuxieme = [
            { country: 'SN', sosEmail: 'dakar@heeroo.fr' },
            { country: 'FR', sosEmail: 'alerte@heeroo.fr' },
            { country: 'BE' },
        ];
        assert.equal(adresseSOS(franceEnDeuxieme, 'BE'), 'alerte@heeroo.fr');
        assert.equal(adresseSOS(franceEnDeuxieme, 'DE'), 'alerte@heeroo.fr');
    });
    test('un pays absent de la table retombe aussi sur la France', () => {
        assert.equal(adresseSOS(REGLAGES, 'DE'), 'alerte@heeroo.fr');
        assert.equal(adresseSOS(REGLAGES, null), 'alerte@heeroo.fr');
    });
    test('sans ligne France, la premiere adresse renseignee sert', () => {
        const sansFrance = [{ country: 'BE' }, { country: 'SN', sosEmail: 'dakar@heeroo.fr' }];
        assert.equal(adresseSOS(sansFrance, 'BE'), 'dakar@heeroo.fr');
    });
    test('settings sous forme d objet est accepte comme un tableau', () => {
        const objet = { a: REGLAGES[0], b: REGLAGES[1] };
        assert.equal(adresseSOS(objet, 'SN'), 'dakar@heeroo.fr');
    });
    test('une valeur qui n est pas une adresse est ignoree', () => {
        assert.equal(adresseSOS([{ country: 'FR', sosEmail: 'a renseigner' }], 'FR'), null);
        assert.equal(adresseSOS([{ country: 'FR', sosEmail: '' }], 'FR'), null);
        assert.equal(adresseSOS([{ country: 'FR', sosEmail: '@heeroo.fr' }], 'FR'), null);
    });
    test('les espaces autour de l adresse sont retires', () => {
        assert.equal(adresseSOS([{ country: 'FR', sosEmail: '  a@b.fr ' }], 'FR'), 'a@b.fr');
    });
    test('aucune adresse nulle part rend null, sans lever', () => {
        assert.equal(adresseSOS([{ country: 'FR' }], 'FR'), null);
        assert.equal(adresseSOS(null, 'FR'), null);
        assert.equal(adresseSOS(undefined, undefined), null);
    });
});

describe('lienCarte', () => {
    test('des coordonnees valides donnent un lien', () => {
        assert.equal(lienCarte({ lat: 48.86, lng: 2.33 }), 'https://www.google.com/maps?q=48.86,2.33');
    });
    test('le point nul est traite comme une absence', () => {
        assert.equal(lienCarte({ lat: 0, lng: 0 }), null);
    });
    test('une position absente ou illisible ne donne pas de lien', () => {
        assert.equal(lienCarte(null), null);
        assert.equal(lienCarte({}), null);
        assert.equal(lienCarte({ lat: 'ici', lng: 'la' }), null);
    });
});

describe('nomComplet', () => {
    test('assemble prenom et nom', () => {
        assert.equal(nomComplet({ firstName: 'Jean', lastName: 'Dupont' }), 'Jean Dupont');
    });
    test('se contente de ce qui existe', () => {
        assert.equal(nomComplet({ firstName: 'Jean' }), 'Jean');
        assert.equal(nomComplet({}), null);
        assert.equal(nomComplet(null), null);
    });
});

describe('heureLisible', () => {
    const QUAND = Date.UTC(2026, 10, 12, 13, 5); // 12 nov. 2026, 13h05 UTC
    test('l heure UTC est toujours presente', () => {
        assert.match(heureLisible(QUAND, 'FR'), /UTC/);
        assert.match(heureLisible(QUAND, null), /UTC/);
    });
    test('un pays connu ajoute son fuseau', () => {
        const fr = heureLisible(QUAND, 'FR');
        assert.match(fr, /Europe\/Paris/);
        assert.match(fr, /14:05/); // UTC+1 en novembre
    });
    test('le Senegal est a l heure UTC', () => {
        assert.match(heureLisible(QUAND, 'SN'), /Africa\/Dakar/);
    });
    test('un pays a plusieurs fuseaux reste en UTC seul', () => {
        const us = heureLisible(QUAND, 'US');
        assert.match(us, /UTC/);
        assert.ok(!us.includes('America/'));
    });
    test('un horodatage absent ne fait pas lever', () => {
        assert.match(heureLisible(undefined, 'FR'), /UTC/);
    });
});

const CHAUFFEUR = {
    firstName: 'Jean', lastName: 'Dupont',
    mobile: '+33 6 12 34 56 78', email: 'jean@exemple.fr',
    vehicleModel: 'Peugeot 508', vehicleNumber: 'AB-123-CD',
    country: 'FR',
    location: { lat: 48.8698, lng: 2.3312, add: '12 rue de la Paix, 75002 Paris' },
};
const ALERTE = { driver: 'u1', destinataire: 'secours', numero: '112', pays: 'FR', at: Date.UTC(2026, 10, 12, 13, 5), plateforme: 'android', version: '1.6.4' };
const COURSE = {
    customer_name: 'Marie Martin', customer_contact: '+33 6 98 76 54 32',
    pickupAddress: '1 place de la Bourse, Bordeaux',
    dropAddress: 'Aeroport de Merignac',
    status: 'STARTED',
};

describe('composerCourriel', () => {
    test('le sujet nomme le chauffeur et le numero appele', () => {
        const { sujet } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.equal(sujet, 'SOS Heeroo — Jean Dupont a appelé les secours (112)');
    });
    test('un appel a Heeroo ne dit pas « les secours »', () => {
        const { sujet, texte } = composerCourriel({
            alerte: Object.assign({}, ALERTE, { destinataire: 'heeroo', numero: '+33 1 23 45 67 89' }),
            chauffeur: CHAUFFEUR,
        });
        assert.equal(sujet, 'SOS Heeroo — Jean Dupont a appelé Heeroo');
        assert.ok(!texte.includes('appeler les secours'));
    });
    test('un chauffeur sans nom ne casse pas le sujet', () => {
        const { sujet } = composerCourriel({ alerte: ALERTE, chauffeur: {} });
        assert.equal(sujet, 'SOS Heeroo — Un chauffeur a appelé les secours (112)');
    });
    test('le corps porte de quoi joindre le chauffeur', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.match(texte, /Jean Dupont/);
        assert.match(texte, /\+33 6 12 34 56 78/);
        assert.match(texte, /jean@exemple\.fr/);
        assert.match(texte, /Peugeot 508 — AB-123-CD/);
    });
    test('le corps porte la position et un lien de carte', () => {
        const { texte, html } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.match(texte, /12 rue de la Paix/);
        assert.match(texte, /https:\/\/www\.google\.com\/maps\?q=48\.8698,2\.3312/);
        assert.match(html, /href="https:\/\/www\.google\.com\/maps\?q=48\.8698,2\.3312"/);
    });
    test('la fraicheur de la position est annoncee, pas tue', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.match(texte, /peut dater/);
    });
    test('sans position, le message le dit au lieu d inventer', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: { firstName: 'Jean' } });
        assert.match(texte, /Aucune position/);
        assert.ok(!texte.includes('google.com/maps'));
    });
    test('avec une course, le passager et les adresses y sont', () => {
        const { texte } = composerCourriel({
            alerte: Object.assign({}, ALERTE, { bookingId: '-NabcDEF' }),
            chauffeur: CHAUFFEUR, course: COURSE,
        });
        assert.match(texte, /-NabcDEF/);
        assert.match(texte, /Marie Martin — \+33 6 98 76 54 32/);
        assert.match(texte, /1 place de la Bourse/);
        assert.match(texte, /Aeroport de Merignac/);
        assert.match(texte, /STARTED/);
    });
    test('une course sans passager nomme ne laisse pas un champ vide', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR, course: { status: 'STARTED' } });
        assert.match(texte, /Passager {2}: \(inconnu\)/);
    });
    test('sans course, le message le dit', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.match(texte, /Aucune course en cours/);
    });
    test('le telephone et la version sont rapportes', () => {
        const { texte } = composerCourriel({ alerte: ALERTE, chauffeur: CHAUFFEUR });
        assert.match(texte, /android/);
        assert.match(texte, /1\.6\.4/);
    });
    test('le HTML echappe ce qui vient de la base', () => {
        const { html } = composerCourriel({
            alerte: ALERTE, chauffeur: CHAUFFEUR,
            course: { customer_name: '<script>alert(1)</script>' },
        });
        assert.ok(!html.includes('<script>'));
        assert.match(html, /&lt;script&gt;/);
    });
    test('des donnees vides ne font jamais lever', () => {
        assert.doesNotThrow(() => composerCourriel({}));
        assert.doesNotThrow(() => composerCourriel(null));
        assert.doesNotThrow(() => composerCourriel({ alerte: {}, chauffeur: {}, course: {} }));
    });
});

describe('lireConfiguration', () => {
    const COMPLET = JSON.stringify({ host: 'smtp.exemple.fr', port: 465, user: 'u', pass: 'p', from: 'Heeroo <a@b.fr>' });
    test('une configuration complete est acceptee', () => {
        const lu = lireConfiguration(COMPLET);
        assert.equal(lu.ok, true);
        assert.equal(lu.config.host, 'smtp.exemple.fr');
        assert.equal(lu.config.secure, true);
        assert.equal(lu.config.from, 'Heeroo <a@b.fr>');
    });
    test('le port 465 est le defaut et implique le chiffrement', () => {
        const lu = lireConfiguration(JSON.stringify({ host: 'h', user: 'u', pass: 'p' }));
        assert.equal(lu.config.port, 465);
        assert.equal(lu.config.secure, true);
    });
    test('le port 587 n est pas en chiffrement implicite', () => {
        const lu = lireConfiguration(JSON.stringify({ host: 'h', port: 587, user: 'u', pass: 'p' }));
        assert.equal(lu.config.secure, false);
    });
    test('sans « from », l identifiant sert d expediteur', () => {
        const lu = lireConfiguration(JSON.stringify({ host: 'h', user: 'u@b.fr', pass: 'p' }));
        assert.equal(lu.config.from, 'u@b.fr');
    });
    test('le secret absent est signale, pas lance', () => {
        assert.equal(lireConfiguration('').ok, false);
        assert.equal(lireConfiguration(null).ok, false);
        assert.match(lireConfiguration(undefined).raison, /absent/);
    });
    test('du JSON invalide est signale', () => {
        assert.match(lireConfiguration('{pas du json').raison, /illisible/);
    });
    test('les champs manquants sont nommes', () => {
        const lu = lireConfiguration(JSON.stringify({ host: 'h' }));
        assert.equal(lu.ok, false);
        assert.match(lu.raison, /user/);
        assert.match(lu.raison, /pass/);
    });
});

describe('envoyer', () => {
    const COMPLET = JSON.stringify({ host: 'smtp.exemple.fr', user: 'u', pass: 'p', from: 'Heeroo <a@b.fr>' });

    function banc(comportement) {
        const journal = { transports: [], envois: [] };
        const fabrique = (options) => {
            journal.transports.push(options);
            return {
                sendMail: async (message) => {
                    journal.envois.push(message);
                    if (comportement === 'echec') { throw new Error('serveur injoignable'); }
                    return { messageId: '<abc@heeroo>' };
                },
            };
        };
        return { journal, fabrique };
    }

    test('un envoi nominal part avec le bon contenu', async () => {
        const { journal, fabrique } = banc();
        const r = await envoyer(COMPLET, { to: 'x@y.fr', sujet: 'S', texte: 'T', html: '<p>H</p>' }, fabrique);
        assert.equal(r.envoye, true);
        assert.equal(r.id, '<abc@heeroo>');
        assert.equal(journal.envois.length, 1);
        assert.equal(journal.envois[0].to, 'x@y.fr');
        assert.equal(journal.envois[0].subject, 'S');
        assert.equal(journal.envois[0].text, 'T');
        assert.equal(journal.envois[0].html, '<p>H</p>');
        assert.equal(journal.envois[0].from, 'Heeroo <a@b.fr>');
    });
    test('le transport recoit hote, port et identifiants', async () => {
        const { journal, fabrique } = banc();
        await envoyer(COMPLET, { to: 'x@y.fr', sujet: 'S' }, fabrique);
        assert.equal(journal.transports[0].host, 'smtp.exemple.fr');
        assert.equal(journal.transports[0].port, 465);
        assert.equal(journal.transports[0].secure, true);
        assert.equal(journal.transports[0].auth.user, 'u');
    });
    test('sans configuration, rien n est tente et la raison est dite', async () => {
        const { journal, fabrique } = banc();
        const r = await envoyer('', { to: 'x@y.fr' }, fabrique);
        assert.equal(r.envoye, false);
        assert.match(r.raison, /absent/);
        assert.equal(journal.envois.length, 0);
    });
    test('sans destinataire, rien n est tente', async () => {
        const { journal, fabrique } = banc();
        const r = await envoyer(COMPLET, { sujet: 'S' }, fabrique);
        assert.equal(r.envoye, false);
        assert.match(r.raison, /destinataire/);
        assert.equal(journal.envois.length, 0);
    });
    test('un serveur injoignable est rapporte, jamais lance', async () => {
        const { fabrique } = banc('echec');
        const r = await envoyer(COMPLET, { to: 'x@y.fr', sujet: 'S' }, fabrique);
        assert.equal(r.envoye, false);
        assert.match(r.raison, /injoignable/);
    });
    test('une fabrique qui leve est rapportee, jamais lancee', async () => {
        const r = await envoyer(COMPLET, { to: 'x@y.fr' }, () => { throw new Error('module absent'); });
        assert.equal(r.envoye, false);
        assert.match(r.raison, /module absent/);
    });
});
