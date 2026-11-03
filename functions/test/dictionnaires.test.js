'use strict';

// Les deux dictionnaires de chaque application portent-ils les memes clefs ?
//
// Une clef presente en francais et absente en anglais n'echoue nulle part :
// l'ecran affiche « undefined » a un lecteur anglophone, et personne ne le voit
// avant lui. Les applications sont bilingues depuis le 3 nov. 2026, et chaque
// ajout de texte double donc le risque d'en oublier la moitie.
//
// Le test vit ici parce que c'est la seule suite du depot. Il lit les fichiers
// des applications comme du texte, faute de pouvoir importer un module ES
// depuis ces tests ; c'est le meme procede que la comparaison des listes de
// moyens encaisses, dans helpers.test.js.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Les clefs de premier niveau : quatre espaces d'indentation, un identifiant,
// deux points. Les lignes de commentaire commencent par « // » et ne peuvent
// donc pas correspondre.
const CLEF = /^ {4}(?:['"]?)([A-Za-z_$][A-Za-z0-9_$]*)(?:['"]?)\s*:/gm;

function clefs(chemin) {
  const source = fs.readFileSync(chemin, 'utf8');
  const trouvees = new Set();
  let m;
  CLEF.lastIndex = 0;
  while ((m = CLEF.exec(source)) !== null) trouvees.add(m[1]);
  return trouvees;
}

const APPLICATIONS = [
  ['passager', 'heeroo-rider'],
  ['chauffeur', 'heeroo-driver'],
];

describe('dictionnaires', () => {
  for (const [nom, dossier] of APPLICATIONS) {
    test(`application ${nom} : francais et anglais portent les memes clefs`, () => {
      const base = path.join(__dirname, '..', '..', dossier, 'src', 'common');
      let fr;
      let en;
      try {
        fr = clefs(path.join(base, 'language.fr.js'));
        en = clefs(path.join(base, 'language.en.js'));
      } catch (error) {
        // Les tests doivent pouvoir tourner sur un depot ou seules les
        // fonctions sont presentes.
        assert.equal(error.code, 'ENOENT');
        return;
      }

      // Garde-fou contre un test creux : une expression devenue fausse
      // rendrait deux ensembles vides, donc egaux, et le test passerait en
      // n'ayant rien verifie.
      assert.ok(fr.size > 100, `seulement ${fr.size} clefs lues en francais : l'extraction est cassee`);

      const manquantEnAnglais = [...fr].filter((c) => !en.has(c)).sort();
      const manquantEnFrancais = [...en].filter((c) => !fr.has(c)).sort();
      assert.deepEqual(manquantEnAnglais, [], `clefs absentes de language.en.js : ${manquantEnAnglais.join(', ')}`);
      assert.deepEqual(manquantEnFrancais, [], `clefs absentes de language.fr.js : ${manquantEnFrancais.join(', ')}`);
    });
  }
});
