import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {checkpointReader} from '../staff-runtime-cycle14/source.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const manifest = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url)));
const hash = data => createHash('sha256').update(data).digest('hex');
const original = entry => {
  const mode = execFileSync('git', ['--no-replace-objects', 'ls-tree', entry.commit, '--', entry.path], {cwd: root, encoding: 'utf8'});
  assert.match(mode, /^100644 blob [0-9a-f]{40}\t/);
  assert.equal(mode.trim().split('\t')[1], entry.path, 'selected regular blob path');
  return execFileSync('git', ['--no-replace-objects', 'show', `${entry.commit}:${entry.path}`], {cwd: root});
};
export function verifyComposition() {
  const readCheckpoint = checkpointReader();
  const entries = [...manifest.imports, ...manifest.preservedDependencies];
  assert.equal(new Set(entries.map(e => e.path)).size, entries.length, 'unique explicit paths');
  for (const entry of entries) {
    assert.match(entry.commit, /^[0-9a-f]{40}$/);
    assert(!path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'));
    const source = original(entry), current = readCheckpoint(entry.path);
    assert.equal(hash(source), entry.sourceSHA256, `${entry.path}: exact selected source`);
    let expected = source;
    if (entry.retainedFunction) {
      assert.equal(entry.path, 'assets/js/outreach-people.js');
      const retained = entry.retainedFunction, prior = original(retained);
      assert.equal(hash(prior), retained.sourceSHA256, 'exact reviewed host People source');
      assert.equal(retained.startMarker, ' async function request(run){');
      assert.equal(retained.endMarker, ' const people=');
      const extract = bytes => {
        const text = bytes.toString(), start = text.indexOf(retained.startMarker), end = text.indexOf(retained.endMarker, start);
        assert(start >= 0 && end > start);
        assert.equal(text.split(retained.startMarker).length, 2);
        assert.equal(text.split(retained.endMarker).length, 2);
        return text.slice(start, end);
      };
      const retainedBlock = extract(prior);
      assert.equal(hash(retainedBlock), retained.sha256, 'reviewed request guard unchanged');
      expected = Buffer.from(source.toString().replace(extract(source), retainedBlock));
    } else if (entry.routeValidation || entry.retirementValidation) {
      assert.equal(entry.path, entry.routeValidation ? 'assets/js/forms-admin.js' : 'assets/js/forms-context.js');
      const changes = entry.routeValidation || entry.retirementValidation;
      assert.equal(changes.length, 2);
      let text = source.toString();
      for (const change of changes) {
        assert.equal(text.split(change.before).length, 2, 'unique Forms integration marker');
        text = text.replace(change.before, change.after);
      }
      expected = Buffer.from(text);
    } else if (entry.adaptation) {
      assert(entry.path.endsWith('.html'), 'only explicit HTML navigation adaptation');
      const marker = '<nav aria-label="Staff workspace">';
      assert.equal(source.toString().split(marker).length, 2);
      expected = Buffer.from(source.toString().replace(marker, marker + '\n    <a href="staff-home.html">Staff home</a>'));
    }
    assert.deepEqual(current, expected, `${entry.path}: no unreviewed source transformation`);
    assert.equal(hash(current), entry.compositionSHA256 || entry.sourceSHA256);
  }
  return { imported: manifest.imports.length, preservedDependencies: manifest.preservedDependencies.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyComposition()));
}
