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
const PEAK = 0.95;   // proche du maximum : la sonnerie doit couvrir le bruit de la route

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
    samples[offset + i] += (wave / 1.35) * envelope(i, length) * PEAK;
  }
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
      beep(samples, Math.round(start * RATE), 880, 0.16);
      beep(samples, Math.round((start + 0.22) * RATE), 1108, 0.16);
      beep(samples, Math.round((start + 0.44) * RATE), 1318, 0.26);
    });
  },
  // Deux tons alternés façon sirène : le plus perçant des trois.
  'sirene': (samples) => {
    for (let i = 0; i < 6; i++) {
      beep(samples, Math.round(i * 0.42 * RATE), i % 2 ? 1046 : 1568, 0.36);
    }
  },
  // Carillon plus doux, pour un usage en intérieur ou de nuit.
  'carillon': (samples) => {
    [[0, 1318], [0.3, 1046], [0.6, 880], [1.5, 1318], [1.8, 1046], [2.1, 880]].forEach(([start, frequency]) => {
      beep(samples, Math.round(start * RATE), frequency, 0.3);
    });
  },
};

const LOOP_SECONDS = 2.8;
const outDir = path.join(__dirname, '..', 'heeroo-driver', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, fill] of Object.entries(SOUNDS)) {
  const samples = new Float64Array(Math.round(LOOP_SECONDS * RATE));
  fill(samples);
  const file = path.join(outDir, name + '.wav');
  const size = writeWav(file, samples);
  console.log(`${name}.wav — ${(size / 1024).toFixed(0)} Ko`);
}
