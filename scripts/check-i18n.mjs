#!/usr/bin/env node
// Demo build (2026-11-18): checks the English dictionary (src/i18n/en.js).
//   node scripts/check-i18n.mjs                  – t('…') keys in src/ that en.js lacks (exit 1 if any)
//   node scripts/check-i18n.mjs --untranslated   – also: per file, lines with Ukrainian text outside t('…')
// Keys are plain string literals: t('…') / t("…"), also in the mocks (messages they send); --untranslated skips
// src/mocks (seed data is translated by src/mocks/shared/catalog/en.js) and the dictionary itself.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const showUntranslated = process.argv.includes('--untranslated');

const enSource = readFileSync(join(src, 'i18n/en.js'), 'utf8');
const en = (await import(`data:text/javascript;base64,${Buffer.from(enSource).toString('base64')}`)).default;

const files = [];
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (path !== join(src, 'i18n')) walk(path);
        } else if (/\.(jsx?|tsx?)$/.test(name)) {
            files.push(path);
        }
    }
};
walk(src);

const CYR = /[\u0400-\u04FF]/;
const KEY = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const missing = new Map();
const untranslated = [];

for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(KEY)) {
        const key = m[2].replace(/\\n/g, '\n').replace(/\\(['"\\])/g, '$1');
        if (CYR.test(key) && !(key in en)) {
            if (!missing.has(key)) missing.set(key, new Set());
            missing.get(key).add(relative(root, file));
        }
    }
    if (showUntranslated && !file.startsWith(join(src, 'mocks'))) {
        let count = 0;
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*')) continue;
            const rest = line.replace(KEY, '').replace(/\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '');
            if (CYR.test(rest)) count += 1;
        }
        if (count) untranslated.push([relative(root, file), count]);
    }
}

if (showUntranslated) {
    untranslated.sort((a, b) => b[1] - a[1]);
    const total = untranslated.reduce((sum, [, n]) => sum + n, 0);
    console.log(`Lines with Ukrainian text outside t(): ${total} in ${untranslated.length} files`);
    for (const [file, n] of untranslated) console.log(`  ${String(n).padStart(4)}  ${file}`);
    console.log('');
}

if (missing.size) {
    console.log(`Missing in src/i18n/en.js: ${missing.size}`);
    for (const [key, where] of missing) console.log(`  '${key}'  ← ${[...where].join(', ')}`);
    process.exit(1);
}
console.log(`en.js: all ${Object.keys(en).length} entries in place, no t() key missing.`);
