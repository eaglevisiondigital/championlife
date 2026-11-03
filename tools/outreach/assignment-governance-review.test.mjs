import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FOUNDATION } from './campaign-assignment-contract.mjs';
import { prepareAssignmentGovernanceReview as prepare, inspectAssignmentGovernanceReview as inspect } from './assignment-governance-review.mjs';

let count = 0;
const check = (message, run) => { run(); console.log('PASS ' + (++count) + ' ' + message); };
const hash = n => n.toString(16).padStart(64, '0');
const clone = value => structuredClone(value);
const user = { issuer: randomUUID(), reviewer: randomUUID(), worker: randomUUID() };
const request = { version: 'campaign-assignment-review.v1', request_id: randomUUID(), foundation_sha256: FOUNDATION.sha256,
  organization_id: randomUUID(), campaign_id: randomUUID(), registration_id: randomUUID(), source: 'synthetic_decision_a',
  worker_user_id: user.worker, requester_user_id: user.issuer, reviewer_user_id: user.reviewer,
  effective_at: '2026-11-03T12:00:00.000Z', expires_at: '2026-11-03T13:00:00.000Z', capabilities: ['view', 'decisions.read'],
  expected_campaign_assignment_revision: 1, expected_record_revision: 2, source_mapping_snapshot_sha256: hash(1), record_binding_snapshot_sha256: hash(2),
  worker_identity_evidence_sha256: hash(3), administrator_authority_evidence_sha256: hash(4), audit_policy_sha256: hash(5), reason: 'initial_assigned_care' };
const packet = { request,
  // Fictional numbers exercise the proposed-parameter comparator; neither is an approved policy.
  policy: { reference_sha256: hash(6), max_assignment_seconds: 3600, max_review_seconds: 1200, retention_reference_sha256: hash(7) },
  actors: Object.fromEntries(['issuer', 'reviewer', 'worker'].map((role, i) => [role, { user_id: user[role], human_binding_sha256: hash(10 + i),
    identity_snapshot_sha256: role === 'worker' ? hash(3) : hash(20 + i), authority_snapshot_sha256: role === 'issuer' ? hash(4) : hash(30 + i) }])),
  provenance: { source_table: 'public.outreach_registrations', steward_authority_snapshot_sha256: hash(40), mapping_writer_policy_sha256: hash(41) },
  controls: { audit_design_sha256: hash(5), revocation_design_sha256: hash(50) } };
const prepared = prepare(packet);
const review = { binding_sha256: prepared.bindingSha256, reviewer_user_id: user.reviewer, reviewer_human_binding_sha256: hash(11),
  reviewed_at: '2026-11-03T11:50:00.000Z', expires_at: '2026-11-03T12:10:00.000Z', status: 'proposed' };
const input = { original: packet, current: packet, review, observedAt: '2026-11-03T12:00:00.000Z' };
function blocked(result) {
  assert.equal(result.executable, false); assert.equal(result.authority, 'unverified'); assert.equal(result.policyStatus, 'unapproved');
  assert.ok(result.requiredGates.includes('separately_reviewed_and_authorized_issuer_implementation'));
}
function finding(changed, expected) { const result = inspect(changed); blocked(result); assert.equal(result.disposition, 'review-needed'); assert.ok(result.findings.includes(expected)); }

check('consistent caller-authored packet still cannot authorize or approve policy', () => { blocked(prepared); blocked(inspect(input)); assert.equal(inspect(input).disposition, 'unverified-consistent'); });
check('canonical request is exactly the reused PR81 request', () => assert.equal(JSON.parse(prepared.canonicalRequest).foundation_sha256, FOUNDATION.sha256));
check('ordering does not change binding', () => assert.equal(prepare({ ...packet, request: { ...request, capabilities: ['decisions.read', 'view'] }, policy: Object.fromEntries(Object.entries(packet.policy).reverse()) }).bindingSha256, prepared.bindingSha256));
check('no contact export or messaging allowed', () => { for (const key of ['contactAllowed', 'exportAllowed', 'messagingAllowed']) assert.equal(prepared[key], false); });
check('results and gates cannot be mutated', () => { assert.ok(Object.isFrozen(prepared)); assert.ok(Object.isFrozen(prepared.requiredGates)); assert.ok(Object.isFrozen(inspect(input).findings)); });

for (const key of Object.keys(packet)) check('missing envelope field ' + key, () => { const next = clone(packet); delete next[key]; assert.throws(() => prepare(next)); });
for (const key of Object.keys(packet.policy)) check('no default for missing policy ' + key, () => { const next = clone(packet); delete next.policy[key]; assert.throws(() => prepare(next)); });
for (const key of ['max_assignment_seconds', 'max_review_seconds']) for (const value of [null, 0, -1, '3600', true, 0.5, Infinity, 2147483648, [], {}]) {
  check('invalid proposed numeric limit ' + key + ' ' + JSON.stringify(value), () => { const next = clone(packet); next.policy[key] = value; assert.throws(() => prepare(next)); });
}
for (const branch of ['policy', 'actors.issuer', 'actors.reviewer', 'actors.worker', 'provenance', 'controls']) {
  check('claimed authority field rejected on ' + branch, () => { const next = clone(packet); const node = branch.split('.').reduce((v, k) => v[k], next); node.approved = true; assert.throws(() => prepare(next)); });
}
for (const [a, b] of [['issuer', 'reviewer'], ['issuer', 'worker'], ['reviewer', 'worker']]) {
  check('same proposed human under separate accounts rejected: ' + a + '/' + b, () => { const next = clone(packet); next.actors[a].human_binding_sha256 = next.actors[b].human_binding_sha256; assert.throws(() => prepare(next), /distinct_proposed_humans/); });
}
for (const role of ['issuer', 'reviewer', 'worker']) check('actor cannot substitute different account: ' + role, () => { const next = clone(packet); next.actors[role].user_id = randomUUID(); assert.throws(() => prepare(next), /actor_request_binding/); });
for (const path of ['actors.issuer.authority_snapshot_sha256', 'actors.worker.identity_snapshot_sha256', 'controls.audit_design_sha256']) {
  check('contradictory canonical evidence rejected: ' + path, () => { const next = clone(packet); const keys = path.split('.'); const key = keys.pop(); keys.reduce((v, k) => v[k], next)[key] = hash(99); assert.throws(() => prepare(next)); });
}
check('event registration source forbidden', () => assert.throws(() => prepare({ ...packet, provenance: { ...packet.provenance, source_table: 'public.outreach_event_registrations' } })));
for (const path of ['request.campaign_id', 'request.organization_id', 'request.registration_id', 'request.request_id', 'request.source_mapping_snapshot_sha256', 'request.record_binding_snapshot_sha256',
  'actors.reviewer.identity_snapshot_sha256', 'actors.reviewer.authority_snapshot_sha256', 'actors.worker.authority_snapshot_sha256', 'actors.issuer.human_binding_sha256',
  'provenance.steward_authority_snapshot_sha256', 'provenance.mapping_writer_policy_sha256', 'policy.reference_sha256', 'policy.retention_reference_sha256', 'controls.revocation_design_sha256']) {
  check('stale review invalidated by ' + path, () => { const next = clone(packet); const keys = path.split('.'); const key = keys.pop(); keys.reduce((v, k) => v[k], next)[key] = key.endsWith('_id') ? randomUUID() : hash(99); finding({ ...input, current: next }, 'review_binding_changed'); });
}
for (const [key, value] of [['expected_record_revision', 3], ['expected_campaign_assignment_revision', 2], ['source', 'synthetic_decision_b'], ['reason', 'reassignment'], ['capabilities', ['view', 'decisions.read', 'followup.manage']]]) {
  check('stale review rejects request change ' + key, () => finding({ ...input, current: { ...packet, request: { ...request, [key]: value } } }, 'review_binding_changed'));
}
check('freshly minted fake review still does not confer authority', () => { const next = clone(packet); next.actors.reviewer.authority_snapshot_sha256 = hash(90); const fabricated = { ...input, original: next, current: next, review: { ...review, binding_sha256: prepare(next).bindingSha256 } }; blocked(inspect(fabricated)); });
check('arbitrary proposed limits remain unapproved', () => { const next = clone(packet); next.policy.max_assignment_seconds = 42; next.policy.max_review_seconds = 7; blocked(prepare(next)); });
check('revoked review cannot be reused', () => finding({ ...input, review: { ...review, status: 'revoked' } }, 'review_revoked'));
check('approved status is not accepted as an attestation', () => assert.throws(() => inspect({ ...input, review: { ...review, status: 'approved' } })));
check('reviewer account mismatch', () => finding({ ...input, review: { ...review, reviewer_user_id: user.issuer } }, 'reviewer_binding_changed'));
check('reviewer human mismatch', () => finding({ ...input, review: { ...review, reviewer_human_binding_sha256: hash(10) } }, 'reviewer_binding_changed'));
check('original review hash must match original immutable envelope', () => finding({ ...input, review: { ...review, binding_sha256: hash(99) } }, 'review_binding_changed'));
check('approval expiry boundary invalidates immediately', () => finding({ ...input, observedAt: review.expires_at }, 'review_time_invalid_or_expired'));
check('future claimed review is not accepted', () => finding({ ...input, observedAt: '2026-11-03T11:49:59.999Z' }, 'review_time_invalid_or_expired'));
check('nonpositive review interval rejected', () => finding({ ...input, review: { ...review, expires_at: review.reviewed_at } }, 'review_time_invalid_or_expired'));
check('proposed review limit exceeded', () => finding({ ...input, review: { ...review, expires_at: '2026-11-03T12:10:00.001Z' } }, 'review_exceeds_proposed_limit'));
check('proposed assignment limit exceeded', () => finding({ ...input, current: { ...packet, request: { ...request, expires_at: '2026-11-03T13:00:00.001Z' } } }, 'assignment_exceeds_proposed_limit'));
check('retroactive issuance rejected even with unexpired review', () => finding({ ...input, observedAt: '2026-11-03T12:00:00.001Z' }, 'assignment_retroactive_or_expired'));
for (const time of ['2026-11-03T12:00:00Z', '2026-02-30T12:00:00.000Z', null, Infinity]) check('invalid clock observation ' + time, () => assert.throws(() => inspect({ ...input, observedAt: time })));

for (const path of ['policy', 'actors', 'actors.issuer', 'provenance', 'controls', 'request']) {
  check('nested getter never executes ' + path, () => { const next = clone(packet); const keys = path.split('.'); const key = keys.pop(); let called = false;
    Object.defineProperty(keys.reduce((v, k) => v[k], next), key, { enumerable: true, get() { called = true; throw Error('getter ran'); } });
    assert.throws(() => prepare(next), /Invalid governance/); assert.equal(called, false); });
}
check('nested array getter never executes', () => { const next = clone(packet); let called = false; Object.defineProperty(next.request.capabilities, '0', { enumerable: true, get() { called = true; return 'view'; } }); assert.throws(() => prepare(next)); assert.equal(called, false); });
check('comparison getter never executes', () => { let called = false; const next = { ...input }; Object.defineProperty(next, 'current', { enumerable: true, get() { called = true; return packet; } }); assert.throws(() => inspect(next)); assert.equal(called, false); });
for (const change of [next => { next.policy = Object.assign(Object.create({ approved: true }), next.policy); }, next => { next.policy[Symbol('approved')] = true; }, next => { next.request.capabilities[4] = 'view'; }, next => { next.controls.loop = next; }]) {
  check('prototype/symbol/sparse/cyclic JSON rejected', () => { const next = clone(packet); change(next); assert.throws(() => prepare(next)); });
}
check('comparison unknown authority option rejected', () => assert.throws(() => inspect({ ...input, trusted: true })));
check('original inputs preserved', () => assert.equal(prepare(packet).bindingSha256, prepared.bindingSha256));
console.log(count + ' governance review checks PASS; no grants or authoritative verification executed');
