#!/usr/bin/env node
'use strict';

// Vérificateur statique des apps Heeroo (passager / chauffeur).
//
// Il cible les familles d'erreurs qui ne se voient qu'à l'exécution dans une
// app React Native (pas de compilation) et qui ont toutes été rencontrées sur
// ce projet :
//   - identifiant non déclaré (import oublié, variable jamais définie) ;
//   - composant JSX non importé ;
//   - style `styles.X` absent de la feuille StyleSheet du fichier ;
//   - couleur `colors.X` absente du thème ;
//   - texte `languageJSON.X` absent du fichier de langue ;
//   - import relatif ou `require()` d'asset vers un fichier inexistant ;
//   - `navigate('Écran')` vers un écran qu'aucun navigateur ne déclare.
//
// Usage : node tools/check-sources.js heeroo-rider heeroo-driver

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const apps = process.argv.slice(2);
if (apps.length === 0) {
  console.error('Usage : node tools/check-sources.js <app> [<app>...]');
  process.exit(2);
}

// Globaux légitimes d'un environnement React Native / Hermes.
const GLOBALS = new Set([
  'console', 'require', 'module', 'exports', 'global', 'globalThis', '__DEV__', 'process',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'fetch', 'Headers', 'Request', 'Response', 'XMLHttpRequest', 'FormData', 'Blob', 'File', 'URL', 'URLSearchParams',
  'WebSocket', 'AbortController', 'TextEncoder', 'TextDecoder', 'atob', 'btoa',
  'alert', 'navigator', 'window', 'document', 'self', 'performance', 'crypto',
  'Promise', 'JSON', 'Math', 'Object', 'Array', 'Date', 'Number', 'String', 'Boolean', 'Symbol', 'BigInt',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AggregateError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Proxy', 'Reflect', 'RegExp', 'Function', 'Intl',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
  'undefined', 'NaN', 'Infinity', 'arguments', 'ArrayBuffer', 'DataView', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
  'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'Uint8ClampedArray', 'SharedArrayBuffer', 'Atomics',
  'HermesInternal', 'nativeFabricUIManager', 'ErrorUtils', '__fbBatchedBridge', 'structuredClone',
]);

const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.json'];
const ASSET_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ttf', '.otf', '.mp3', '.wav', '.json'];

function listSources(dir) {
  const out = [];
  (function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'node_modules' || name === 'android' || name === 'ios' || name.startsWith('.')) continue;
        walk(full);
      } else if (/\.jsx?$/.test(name)) {
        out.push(full);
      }
    }
  })(dir);
  return out;
}

function resolveRelative(fromFile, spec, exts) {
  const base = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of exts) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of exts) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function parse(code, babel) {
  return babel.parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread', 'dynamicImport'],
    errorRecovery: false,
  });
}

/** Clés d'un objet littéral exporté sous un nom donné (ex. `export const colors = {...}`). */
function exportedObjectKeys(file, exportName, babel) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = parse(code, babel);
  const keys = new Set();
  babel.traverse(ast, {
    VariableDeclarator(p) {
      if (p.node.id.type === 'Identifier' && p.node.id.name === exportName && p.node.init && p.node.init.type === 'ObjectExpression') {
        for (const prop of p.node.init.properties) {
          if (prop.type === 'ObjectProperty') {
            if (prop.key.type === 'Identifier') keys.add(prop.key.name);
            else if (prop.key.type === 'StringLiteral') keys.add(prop.key.value);
          }
        }
      }
    },
  });
  return keys;
}

/** Noms d'écrans déclarés dans tous les navigateurs de l'app (`<X.Screen name="..." />`). */
function screenNames(files, babel) {
  const names = new Set();
  for (const f of files) {
    const ast = parse(fs.readFileSync(f, 'utf8'), babel);
    babel.traverse(ast, {
      JSXOpeningElement(p) {
        const name = p.node.name;
        const isScreen = (name.type === 'JSXMemberExpression' && name.property.name === 'Screen')
          || (name.type === 'JSXIdentifier' && /Screen$/.test(name.name) && name.name !== 'Screen');
        if (!isScreen) return;
        for (const attr of p.node.attributes) {
          if (attr.type === 'JSXAttribute' && attr.name.name === 'name' && attr.value && attr.value.type === 'StringLiteral') {
            names.add(attr.value.value);
          }
        }
      },
    });
  }
  return names;
}

function checkApp(app) {
  const appDir = path.join(ROOT, app);
  const babel = {
    parser: require(path.join(appDir, 'node_modules', '@babel', 'parser')),
    traverse: require(path.join(appDir, 'node_modules', '@babel', 'traverse')).default,
  };
  const files = [path.join(appDir, 'App.js'), ...listSources(path.join(appDir, 'src')), ...listSources(path.join(appDir, 'plugins'))].filter(fs.existsSync);
  const themeKeys = exportedObjectKeys(path.join(appDir, 'src', 'common', 'theme.js'), 'colors', babel);
  const langKeys = exportedObjectKeys(path.join(appDir, 'src', 'common', 'language.js'), 'language', babel);
  const screens = screenNames(files.filter((f) => f.includes(path.sep + 'navigation' + path.sep)), babel);

  const findings = [];
  const report = (file, node, kind, message) => {
    const loc = node && node.loc ? `${node.loc.start.line}:${node.loc.start.column + 1}` : '?';
    findings.push({ file: path.relative(ROOT, file), loc, kind, message });
  };

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parse(code, babel);
    } catch (e) {
      report(file, { loc: e.loc ? { start: e.loc } : null }, 'syntaxe', e.message);
      continue;
    }

    // Clés de la feuille de styles du fichier (const styles = StyleSheet.create({...})).
    const styleKeys = new Map(); // nom de variable -> Set de clés
    babel.traverse(ast, {
      VariableDeclarator(p) {
        const init = p.node.init;
        if (p.node.id.type === 'Identifier' && init && init.type === 'CallExpression'
          && init.callee.type === 'MemberExpression' && init.callee.object.name === 'StyleSheet' && init.callee.property.name === 'create'
          && init.arguments[0] && init.arguments[0].type === 'ObjectExpression') {
          const keys = new Set();
          let hasSpread = false;
          for (const prop of init.arguments[0].properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') keys.add(prop.key.name);
            else if (prop.type === 'ObjectProperty' && prop.key.type === 'StringLiteral') keys.add(prop.key.value);
            else hasSpread = true;
          }
          if (!hasSpread) styleKeys.set(p.node.id.name, keys);
        }
      },
    });

    const isPlugin = file.includes(path.sep + 'plugins' + path.sep);

    babel.traverse(ast, {
      // Identifiants référencés sans déclaration.
      ReferencedIdentifier(p) {
        const name = p.node.name;
        if (p.parentPath.isJSXAttribute() || p.node.type === 'JSXIdentifier' && /^[a-z]/.test(name)) return; // balises natives (View minuscule ? non) et attributs
        if (p.scope.hasBinding(name, true)) return;
        if (GLOBALS.has(name)) return;
        if (isPlugin && (name === '__dirname' || name === '__filename' || name === 'Buffer')) return;
        // this.props / propriétés d'objets : ce ne sont pas des références
        report(file, p.node, 'non-déclaré', `« ${name} » n'est ni déclaré ni importé`);
      },
      // styles.X
      MemberExpression(p) {
        const { object, property, computed } = p.node;
        if (computed || object.type !== 'Identifier' || property.type !== 'Identifier') return;
        if (styleKeys.has(object.name)) {
          if (!styleKeys.get(object.name).has(property.name)) {
            report(file, property, 'style', `${object.name}.${property.name} n'existe pas dans la feuille de styles`);
          }
        } else if (object.name === 'colors' && themeKeys.size && p.scope.hasBinding('colors')) {
          if (!themeKeys.has(property.name)) report(file, property, 'couleur', `colors.${property.name} n'existe pas dans le thème`);
        } else if (object.name === 'languageJSON' && langKeys.size && p.scope.hasBinding('languageJSON')) {
          if (!langKeys.has(property.name)) report(file, property, 'texte', `languageJSON.${property.name} n'existe pas dans language.js`);
        }
      },
      // import './x' et require('./asset.png')
      ImportDeclaration(p) {
        const spec = p.node.source.value;
        if (!spec.startsWith('.')) return;
        if (!resolveRelative(file, spec, SOURCE_EXTS)) report(file, p.node.source, 'import', `import introuvable : ${spec}`);
      },
      CallExpression(p) {
        const { callee, arguments: args } = p.node;
        if (callee.type === 'Identifier' && callee.name === 'require' && args[0] && args[0].type === 'StringLiteral' && args[0].value.startsWith('.')) {
          if (!resolveRelative(file, args[0].value, [...ASSET_EXTS, ...SOURCE_EXTS])) report(file, args[0], 'asset', `fichier introuvable : ${args[0].value}`);
        }
        // navigation.navigate('Écran' | { name }) / push / replace
        if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
          && ['navigate', 'push', 'replace'].includes(callee.property.name) && args[0]) {
          const isNav = callee.object.type === 'Identifier' && callee.object.name === 'navigation'
            || callee.object.type === 'MemberExpression' && callee.object.property && callee.object.property.name === 'navigation';
          if (!isNav) return;
          if (args[0].type === 'StringLiteral' && screens.size && !screens.has(args[0].value)) {
            report(file, args[0], 'navigation', `écran « ${args[0].value} » déclaré dans aucun navigateur`);
          }
          // navigate('Parent', { screen: 'Enfant' })
          if (args[1] && args[1].type === 'ObjectExpression') {
            for (const prop of args[1].properties) {
              if (prop.type === 'ObjectProperty' && prop.key.name === 'screen' && prop.value.type === 'StringLiteral' && !screens.has(prop.value.value)) {
                report(file, prop.value, 'navigation', `écran « ${prop.value.value} » déclaré dans aucun navigateur`);
              }
            }
          }
        }
      },
    });
  }
  return { files: files.length, screens: screens.size, findings };
}

let total = 0;
for (const app of apps) {
  const { files, screens, findings } = checkApp(app);
  console.log(`\n${app} — ${files} fichiers analysés, ${screens} écrans connus, ${findings.length} anomalie(s)`);
  const byKind = {};
  for (const f of findings) (byKind[f.kind] = byKind[f.kind] || []).push(f);
  for (const kind of Object.keys(byKind).sort()) {
    console.log(`  [${kind}] ${byKind[kind].length}`);
    for (const f of byKind[kind]) console.log(`    ${f.file}:${f.loc}  ${f.message}`);
  }
  total += findings.length;
}
process.exit(total ? 1 : 0);
