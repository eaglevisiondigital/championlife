import assert from 'node:assert/strict';
import {current as actualCurrent} from '../staff-financial-navigation-cycle21/source.mjs';
import {readdirSync, lstatSync, readFileSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyComposition, checkpointReader, current, original, root, sha, base} from './overrides.mjs';
const manifest = verifyComposition();
checkpointReader();
const publicFiles = JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir, prefix = '') {
  return readdirSync(dir).sort().flatMap(name => {
    const path = new URL(name, dir);
    assert(!lstatSync(path).isSymbolicLink());
    return lstatSync(path).isDirectory() ? inventory(new URL(name + '/', dir), prefix + name + '/') : [[prefix + name, sha(readFileSync(path))]];
  });
}
await buildSite({env: {}});
const first = inventory(new URL('dist/', root));
await buildSite({env: {}});
assert.deepEqual(inventory(new URL('dist/', root)), first, 'Two deterministic actual composition builds');
assert.deepEqual(first.map(([path]) => path).sort(), publicFiles);
for (const [path, digest] of first) assert.equal(digest, sha(actualCurrent(path)), 'Actual source/output binding ' + path);
console.log(JSON.stringify({status: 'PASS', base, builds: 2, publicFiles: publicFiles.length, changedPublic: Object.keys(manifest.existing).filter(path => JSON.parse(original('tools/site-build/public-files.json')).includes(path)), addedPublic: Object.keys(manifest.additions), buildManifestSHA256: sha(JSON.stringify(first)), hostedAcceptance: false, releaseAuthorized: false}));
