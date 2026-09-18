#!/usr/bin/env node
'use strict';

// Compile avec Babel (preset Expo) tous les fichiers source d'une app, sans
// rien écrire : détecte les erreurs de syntaxe que l'app ne révélerait qu'au
// lancement. Usage : node tools/compile-sources.js heeroo-rider heeroo-driver

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const apps = process.argv.slice(2);
if (apps.length === 0) {
  console.error('Usage : node tools/compile-sources.js <app> [<app>...]');
  process.exit(2);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', 'android', 'ios'].includes(name) && !name.startsWith('.')) walk(full, out);
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

let failures = 0;
for (const app of apps) {
  const appDir = path.join(ROOT, app);
  const babel = require(path.join(appDir, 'node_modules', '@babel', 'core'));
  const files = ['App.js', 'app.config.js'].map((f) => path.join(appDir, f)).filter(fs.existsSync)
    .concat(walk(path.join(appDir, 'src')), walk(path.join(appDir, 'plugins')));
  let errors = 0;
  for (const file of files) {
    try {
      babel.transformFileSync(file, { presets: ['babel-preset-expo'], babelrc: false, configFile: false, cwd: appDir });
    } catch (e) {
      errors++;
      console.log(`ERREUR ${path.relative(ROOT, file)} : ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`${app} : ${files.length} fichiers compilés, ${errors} erreur(s)`);
  failures += errors;
}
process.exit(failures ? 1 : 0);
