const assert = require('node:assert');
const { describe, it } = require('node:test');

const { MESSAGES, langueValide, localeDe, message } = require('../lib/messages');

const MARQUES = /\{(\w+)\}/g;

function marquesDe(gabarit) {
  return new Set(Array.from(String(gabarit).matchAll(MARQUES), (m) => m[1]));
}

describe('catalogue des notifications', () => {
  it('les deux langues portent exactement les memes cles', () => {
    assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.fr).sort());
  });

  it('chaque message a un titre et un corps non vides', () => {
    for (const [langue, catalogue] of Object.entries(MESSAGES)) {
      for (const [cle, modele] of Object.entries(catalogue)) {
        assert.ok(modele.titre, `${langue}.${cle} : titre manquant`);
        assert.ok(modele.corps, `${langue}.${cle} : corps manquant`);
      }
    }
  });

  // Une traduction qui oublie {montant} enverrait « Ride total: . Thank you ».
  it('une traduction ne perd aucune marque de substitution', () => {
    for (const cle of Object.keys(MESSAGES.fr)) {
      assert.deepEqual(
        marquesDe(MESSAGES.en[cle].corps),
        marquesDe(MESSAGES.fr[cle].corps),
        `${cle} : les marques du corps different entre les deux langues`
      );
      assert.deepEqual(
        marquesDe(MESSAGES.en[cle].titre),
        marquesDe(MESSAGES.fr[cle].titre),
        `${cle} : les marques du titre different entre les deux langues`
      );
    }
  });

  // Un defaut declare d'un seul cote laisserait un trou dans l'autre langue.
  it('les defauts sont declares dans les deux langues', () => {
    for (const cle of Object.keys(MESSAGES.fr)) {
      assert.deepEqual(
        Object.keys(MESSAGES.en[cle].defauts || {}).sort(),
        Object.keys(MESSAGES.fr[cle].defauts || {}).sort(),
        `${cle} : les defauts different entre les deux langues`
      );
    }
  });
});

describe('langueValide', () => {
  it('reconnait les langues du catalogue', () => {
    assert.equal(langueValide('fr'), 'fr');
    assert.equal(langueValide('en'), 'en');
    assert.equal(langueValide('EN'), 'en');
  });

  // Tout compte anterieur a la 1.6.0 n'a pas de champ language.
  it('retombe sur le francais sans langue connue', () => {
    assert.equal(langueValide(undefined), 'fr');
    assert.equal(langueValide(null), 'fr');
    assert.equal(langueValide(''), 'fr');
    assert.equal(langueValide('de'), 'fr');
  });

  it('ne se laisse pas confondre par une cle heritee d\'Object', () => {
    assert.equal(langueValide('constructor'), 'fr');
    assert.equal(langueValide('toString'), 'fr');
  });
});

describe('localeDe', () => {
  it('donne la locale de mise en forme de chaque langue', () => {
    assert.equal(localeDe('fr'), 'fr-FR');
    assert.equal(localeDe('en'), 'en-GB');
    assert.equal(localeDe('xx'), 'fr-FR');
  });
});

describe('message', () => {
  it('compose dans la langue demandee', () => {
    assert.equal(message('fr', 'payment_due').titre, 'Règlement attendu');
    assert.equal(message('en', 'payment_due').titre, 'Payment due');
  });

  it('remplace les marques par les parametres', () => {
    const { corps } = message('en', 'booking_accepted', { chauffeur: 'Mamadou' });
    assert.equal(corps, 'Mamadou has accepted your ride and is on the way.');
  });

  it('applique le defaut quand le parametre manque ou est vide', () => {
    assert.equal(message('fr', 'booking_accepted', {}).corps,
      'Un chauffeur a accepté votre course et se met en route.');
    assert.equal(message('fr', 'booking_accepted', { chauffeur: '' }).corps,
      'Un chauffeur a accepté votre course et se met en route.');
    assert.equal(message('fr', 'booking_accepted', { chauffeur: null }).corps,
      'Un chauffeur a accepté votre course et se met en route.');
  });

  // Sans defaut declare, une marque non fournie s'efface : c'est voulu pour les
  // fragments optionnels comme « — 12 rue de la Paix » ou « avec Mamadou ».
  it('efface une marque optionnelle non fournie', () => {
    assert.equal(message('fr', 'booking_request').corps, 'Un passager cherche un chauffeur');
    assert.equal(message('fr', 'booking_started').corps,
      'Bonne route ! Vous pouvez suivre le trajet dans l\'application.');
  });

  it('ne laisse jamais de marque non remplacee', () => {
    for (const langue of Object.keys(MESSAGES)) {
      for (const cle of Object.keys(MESSAGES[langue])) {
        const { titre, corps } = message(langue, cle, {});
        assert.equal(marquesDe(titre).size, 0, `${langue}.${cle} : marque restante dans le titre`);
        assert.equal(marquesDe(corps).size, 0, `${langue}.${cle} : marque restante dans le corps`);
      }
    }
  });

  it('leve sur une cle inconnue', () => {
    assert.throws(() => message('fr', 'course_envolee'), /Notification inconnue/);
  });
});
