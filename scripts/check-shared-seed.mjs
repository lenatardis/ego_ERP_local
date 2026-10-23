// Checks that the data shared by the ERP and CRM demos is identical in both repos
// (see the workspace CLAUDE.md, "Cross-app contract"). Expects the sibling layout of the workspace:
//   ego_local/ego_ERP_local  and  ego_local/ego_CRM_local
// Same script in both repos. Usage: node scripts/check-shared-seed.mjs  (exit code 1 when the copies differ)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_FILES = ['src/mocks/shared/seed.js', 'public/demo/customer-receipt.svg'];
const REPOS = ['ego_ERP_local', 'ego_CRM_local'];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const self = path.basename(repoRoot);
const other = REPOS.find((name) => name !== self);
const otherRoot = path.resolve(repoRoot, '..', other);

if (!REPOS.includes(self) || !fs.existsSync(otherRoot)) {
    console.log(`Shared seed check skipped: ../${other} not found next to ${self}.`);
    process.exit(0);
}

let failed = false;
for (const file of SHARED_FILES) {
    const mine = path.join(repoRoot, file);
    const theirs = path.join(otherRoot, file);
    if (!fs.existsSync(mine) || !fs.existsSync(theirs)) {
        console.error(`MISSING  ${file} (${fs.existsSync(mine) ? other : self})`);
        failed = true;
    } else if (!fs.readFileSync(mine).equals(fs.readFileSync(theirs))) {
        console.error(`DIFFERS  ${file} — copy the up-to-date version to the other repo`);
        failed = true;
    } else {
        console.log(`ok       ${file}`);
    }
}
process.exit(failed ? 1 : 0);
