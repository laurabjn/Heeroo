// Fabrique les sonneries de nouvelle course de l'app chauffeur.
//
//   node tools/make-alert-sound.js
//
// Les fichiers sont synthétisés ici plutôt que téléchargés : aucune question de
// licence, et le son reste modifiable (hauteur, rythme, durée) sans repasser par
// un éditeur audio. Sortie en WAV PCM 16 bits, format lu tel quel par Android et
// iOS, et par les navigateurs pour la page d'écoute.
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const PEAK = 0.97;        // proche du maximum : la sonnerie doit couvrir le bruit de la route
const SATURATION = 2;     // remplissage de la forme d'onde, sans distorsion audible sur un bip

/** Enveloppe attaque/extinction, sinon chaque bip claque. */
function envelope(position, length) {
  const edge = Math.min(0.012 * RATE, length / 4);
  if (position < edge) return position / edge;
  if (position > length - edge) return (length - position) / edge;
  return 1;
}

/** Un bip : fondamentale plus une tierce harmonique, qui porte mieux sur un petit haut-parleur. */
function beep(samples, offset, frequency, duration) {
  const length = Math.round(duration * RATE);
  for (let i = 0; i < length && offset + i < samples.length; i++) {
    const t = i / RATE;
    const wave = Math.sin(2 * Math.PI * frequency * t) + 0.35 * Math.sin(2 * Math.PI * 3 * frequency * t);
    samples[offset + i] += wave * envelope(i, length);
  }
}

// Une sinusoïde n'occupe pleinement l'échelle qu'à l'instant de sa crête : les
// trois décibels d'écart entre son pic et son niveau moyen sont autant de
// puissance perdue. La saturation douce arrondit les crêtes et remplit la forme
// d'onde, procédé courant sur les sonneries d'alerte : le pic reste le même, le
// son porte nettement plus loin.
function sature(samples, force) {
  const division = Math.tanh(force);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(force * samples[i]) / division;
}

// Le gain final se calcule sur le signal obtenu, et non en divisant chaque bip
// par son maximum théorique : deux sinusoïdes ne culminent presque jamais au
// même instant, et une division à l'aveugle laissait un tiers de l'échelle
// inutilisé — soit trois décibels perdus sur une sonnerie qui doit s'entendre
// au volant.
function normalise(samples, peak) {
  let loudest = 0;
  for (let i = 0; i < samples.length; i++) {
    const level = Math.abs(samples[i]);
    if (level > loudest) loudest = level;
  }
  if (!loudest) return;
  const gain = peak / loudest;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

/** Écrit un WAV mono 16 bits. */
function writeWav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);          // PCM
  header.writeUInt16LE(1, 22);          // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
  return data.length + 44;
}

// Chaque sonnerie dure une boucle complète : l'app la répète tant que la demande
// de course n'est ni acceptée ni refusée, le silence final donne la respiration.
const SOUNDS = {
  // Trois bips montants, deux fois : le motif « appel » classique d'un dispatch.
  'nouvelle-course': (samples) => {
    [0, 1.4].forEach((start) => {
      beep(samples, Math.round(start * RATE), 1760, 0.16);
      beep(samples, Math.round((start + 0.22) * RATE), 2217, 0.16);
      beep(samples, Math.round((start + 0.44) * RATE), 2637, 0.26);
    });
  },
  // Deux tons alternés façon sirène : le plus perçant des trois.
  'sirene': (samples) => {
    for (let i = 0; i < 6; i++) {
      beep(samples, Math.round(i * 0.42 * RATE), i % 2 ? 2093 : 3136, 0.36);
    }
  },
  // Le carillon de l'app chauffeur. Le motif descendant d'origine sonnait une
  // octave plus bas : un haut-parleur de téléphone, large de quelques
  // millimètres, ne descend pas sous le kilohertz sans y perdre l'essentiel de
  // sa puissance, et l'oreille est elle-même la plus sensible entre deux et
  // quatre kilohertz. Transposé dans cette bande, à amplitude égale, le même
  // carillon s'entend bien plus fort. Les notes restent jointives sans se
  // recouvrir : deux notes superposées additionnent leurs crêtes, et la
  // normalisation redescend alors tout le morceau sans rien gagner.
  'carillon': (samples) => {
    [[0, 2637], [0.3, 2093], [0.6, 1760], [1.5, 2637], [1.8, 2093], [2.1, 1760]].forEach(([start, frequency]) => {
      beep(samples, Math.round(start * RATE), frequency, 0.3);
    });
  },
  // Double bip serre, repete : le motif d'un camion qui recule. Le plus
  // insistant du lot, difficile a ignorer et difficile a aimer — c'est le but.
  'urgence': (samples) => {
    for (let i = 0; i < 4; i++) {
      const base = i * 0.6;
      beep(samples, Math.round(base * RATE), 2794, 0.11);
      beep(samples, Math.round((base + 0.17) * RATE), 2794, 0.11);
    }
  },
  // Arpege montant, deux fois : annonce une bonne nouvelle plutot qu'un danger.
  // Les quatre notes dessinent un accord majeur, d'ou son caractere avenant.
  'montee': (samples) => {
    [0, 1.5].forEach((start) => {
      [[0, 1760], [0.14, 2217], [0.28, 2637], [0.42, 3520]].forEach(([decalage, frequence]) => {
        beep(samples, Math.round((start + decalage) * RATE), frequence, decalage === 0.42 ? 0.34 : 0.15);
      });
    });
  },
  // Deux notes alternees tres rapidement, facon trille de telephone fixe. Se
  // distingue des autres par son grain, pas par sa hauteur.
  'trille': (samples) => {
    [0, 1.2, 2.4].forEach((debut) => {
      for (let i = 0; i < 10; i++) {
        beep(samples, Math.round((debut + i * 0.05) * RATE), i % 2 ? 2349 : 3136, 0.055);
      }
    });
  },
};

const LOOP_SECONDS = 2.8;
const outDir = path.join(__dirname, '..', 'heeroo-driver', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, fill] of Object.entries(SOUNDS)) {
  const samples = new Float64Array(Math.round(LOOP_SECONDS * RATE));
  fill(samples);
  normalise(samples, 1);
  sature(samples, SATURATION);
  normalise(samples, PEAK);
  const file = path.join(outDir, name + '.wav');
  const size = writeWav(file, samples);
  console.log(`${name}.wav — ${(size / 1024).toFixed(0)} Ko`);
}
