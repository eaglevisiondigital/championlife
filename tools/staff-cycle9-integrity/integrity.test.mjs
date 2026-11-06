import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyComposition, current, checkpointReader, original} from './overrides.mjs';
const bytes = current('tools/staff-cycle9-integrity/overrides.json');
const manifest = JSON.parse(bytes);
test('actual reviewed composition passes before original comparisons', () => {
  verifyComposition();
  const checkpoint = checkpointReader();
  assert.deepEqual(checkpoint('assets/js/outreach-people.js'), original('assets/js/outreach-people.js'));
  assert.deepEqual(checkpoint('assets/js/outreach-registration-staff.js'), original('assets/js/outreach-registration-staff.js'));
});
for (const path of [...Object.keys(manifest.existing), ...Object.keys(manifest.additions), ...Object.keys(manifest.provenance)]) {
  test('reject tampered actual composition: ' + path, () => {
    assert.throws(() => verifyComposition(bytes, p => p === path ? Buffer.concat([current(p), Buffer.from('\n/* unreviewed */')]) : current(p)), /Reviewed Cycle9/);
  });
}
for (const path of ['index.html', 'baptism-interest.html', 'events.html', 'give.html', 'assets/js/champion-life-auth.js', 'assets/js/staff-session.js', 'assets/js/communications.js', 'assets/js/staff-workspace.js', 'netlify.toml', 'tools/site-build/build.mjs']) {
  test('reject protected public/backend/config tamper: ' + path, () => {
    assert.throws(() => verifyComposition(bytes, p => p === path ? Buffer.concat([current(p), Buffer.from(' ')]) : current(p)), /Protected/);
  });
}
for (const mutate of [m => m.base = 'HEAD', m => delete m.existing['assets/js/outreach-people.js'], m => m.additions['private.txt'] = {reviewedSHA256: '0'.repeat(64)}, m => m.existing['assets/js/outreach-people.js'].reviewedSHA256 = '0'.repeat(64)]) {
  test('reject changed reviewed manifest: ' + mutate.toString(), () => {
    const changed = structuredClone(manifest); mutate(changed);
    assert.throws(() => verifyComposition(Buffer.from(JSON.stringify(changed))), /Exact independently reviewed Cycle9 manifest/);
  });
}
