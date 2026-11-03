// Offline review consistency only: no issuer, authority lookup, database, or grant writer.
import { createHash } from 'node:crypto';
import { prepareAssignmentReview } from './campaign-assignment-contract.mjs';

const fail = field => { throw new TypeError('Invalid governance review field: ' + field); };
const hash = /^[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function plainJson(value, field, depth = 0) {
  if (depth > 12) fail(field);
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (!value || typeof value !== 'object') fail(field);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail(field);
  const keys = Reflect.ownKeys(value);
  if (array && (keys.length !== value.length + 1 || !keys.includes('length'))) fail(field);
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string' || (array && !/^(0|[1-9][0-9]*)$/.test(key))) fail(field);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail(field);
    plainJson(descriptor.value, field + '.' + key, depth + 1);
  }
}
function shape(value, keys, field) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) fail(field);
  for (const key of keys) {
    if (!Object.hasOwn(value, key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail(field);
  }
}
function digest(value, field) { if (typeof value !== 'string' || !hash.test(value)) fail(field); }
function stamp(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(field);
  const n = Date.parse(value);
  if (!Number.isFinite(n) || new Date(n).toISOString() !== value) fail(field);
  return n;
}
// Canonicalize only already validated records assembled below; never arbitrary caller objects.
function canonical(value) {
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const gates = Object.freeze([
  'owner_approved_campaign_specific_issuer_and_independent_reviewer_authority',
  'server_verified_distinct_humans_and_current_sessions',
  'approved_source_provenance_and_mapping_writer',
  'approved_assignment_and_review_validity_policy',
  'serialized_current_authority_source_identity_revision_and_revocation_checks',
  'atomic_immutable_issuance_audit_and_approved_retention',
  'separately_reviewed_and_authorized_issuer_implementation'
]);

export function prepareAssignmentGovernanceReview(packet) {
  plainJson(packet, 'packet');
  shape(packet, ['request', 'policy', 'actors', 'provenance', 'controls'], 'packet');
  const request = prepareAssignmentReview(packet.request);
  const p = JSON.parse(request.canonicalRequest);
  const policyKeys = ['reference_sha256', 'max_assignment_seconds', 'max_review_seconds', 'retention_reference_sha256'];
  shape(packet.policy, policyKeys, 'policy');
  digest(packet.policy.reference_sha256, 'policy.reference_sha256');
  digest(packet.policy.retention_reference_sha256, 'policy.retention_reference_sha256');
  for (const key of ['max_assignment_seconds', 'max_review_seconds']) {
    if (!Number.isSafeInteger(packet.policy[key]) || packet.policy[key] < 1 || packet.policy[key] > 2147483647) fail('policy.' + key);
  }
  const policy = Object.fromEntries(policyKeys.map(key => [key, packet.policy[key]]));
  shape(packet.actors, ['issuer', 'reviewer', 'worker'], 'actors');
  const actorKeys = ['user_id', 'human_binding_sha256', 'identity_snapshot_sha256', 'authority_snapshot_sha256'];
  const actors = {};
  for (const role of ['issuer', 'reviewer', 'worker']) {
    shape(packet.actors[role], actorKeys, 'actors.' + role);
    const actor = packet.actors[role];
    if (typeof actor.user_id !== 'string' || !uuid.test(actor.user_id)) fail('actors.' + role + '.user_id');
    for (const key of actorKeys.slice(1)) digest(actor[key], 'actors.' + role + '.' + key);
    actors[role] = Object.fromEntries(actorKeys.map(key => [key, actor[key]]));
  }
  if (actors.issuer.user_id !== p.requester_user_id || actors.reviewer.user_id !== p.reviewer_user_id || actors.worker.user_id !== p.worker_user_id) fail('actor_request_binding');
  if (new Set(Object.values(actors).map(actor => actor.human_binding_sha256)).size !== 3) fail('distinct_proposed_humans');
  if (actors.issuer.authority_snapshot_sha256 !== p.administrator_authority_evidence_sha256 || actors.worker.identity_snapshot_sha256 !== p.worker_identity_evidence_sha256) fail('actor_evidence_binding');
  shape(packet.provenance, ['source_table', 'steward_authority_snapshot_sha256', 'mapping_writer_policy_sha256'], 'provenance');
  if (packet.provenance.source_table !== 'public.outreach_registrations') fail('provenance.source_table');
  digest(packet.provenance.steward_authority_snapshot_sha256, 'provenance.steward_authority_snapshot_sha256');
  digest(packet.provenance.mapping_writer_policy_sha256, 'provenance.mapping_writer_policy_sha256');
  shape(packet.controls, ['audit_design_sha256', 'revocation_design_sha256'], 'controls');
  digest(packet.controls.audit_design_sha256, 'controls.audit_design_sha256');
  digest(packet.controls.revocation_design_sha256, 'controls.revocation_design_sha256');
  if (packet.controls.audit_design_sha256 !== p.audit_policy_sha256) fail('audit_request_binding');
  const canonicalBinding = canonical({ request_sha256: request.requestSha256, policy, actors,
    provenance: { source_table: packet.provenance.source_table, steward_authority_snapshot_sha256: packet.provenance.steward_authority_snapshot_sha256, mapping_writer_policy_sha256: packet.provenance.mapping_writer_policy_sha256 },
    controls: { audit_design_sha256: packet.controls.audit_design_sha256, revocation_design_sha256: packet.controls.revocation_design_sha256 } });
  return Object.freeze({ kind: 'unverified-assignment-governance-review', executable: false, authority: 'unverified', policyStatus: 'unapproved',
    bindingSha256: createHash('sha256').update(canonicalBinding).digest('hex'), canonicalBinding, canonicalRequest: request.canonicalRequest,
    contactAllowed: false, exportAllowed: false, messagingAllowed: false, requiredGates: gates });
}

// All arguments are untrusted review-document observations, NOT server attestations.
export function inspectAssignmentGovernanceReview(input) {
  plainJson(input, 'comparison');
  shape(input, ['original', 'current', 'review', 'observedAt'], 'comparison');
  const { original, current, review, observedAt } = input;
  const before = prepareAssignmentGovernanceReview(original);
  const after = prepareAssignmentGovernanceReview(current);
  shape(review, ['binding_sha256', 'reviewer_user_id', 'reviewer_human_binding_sha256', 'reviewed_at', 'expires_at', 'status'], 'review');
  digest(review.binding_sha256, 'review.binding_sha256');
  digest(review.reviewer_human_binding_sha256, 'review.reviewer_human_binding_sha256');
  if (typeof review.reviewer_user_id !== 'string' || !uuid.test(review.reviewer_user_id)) fail('review.reviewer_user_id');
  if (!['proposed', 'revoked'].includes(review.status)) fail('review.status');
  const now = stamp(observedAt, 'observedAt');
  const reviewed = stamp(review.reviewed_at, 'review.reviewed_at');
  const expires = stamp(review.expires_at, 'review.expires_at');
  const p = JSON.parse(after.canonicalRequest);
  const binding = JSON.parse(after.canonicalBinding);
  const findings = [];
  if (review.binding_sha256 !== before.bindingSha256 || before.bindingSha256 !== after.bindingSha256) findings.push('review_binding_changed');
  if (review.reviewer_user_id !== binding.actors.reviewer.user_id || review.reviewer_human_binding_sha256 !== binding.actors.reviewer.human_binding_sha256) findings.push('reviewer_binding_changed');
  if (review.status === 'revoked') findings.push('review_revoked');
  if (reviewed > now || expires <= reviewed || expires <= now) findings.push('review_time_invalid_or_expired');
  if (expires - reviewed > binding.policy.max_review_seconds * 1000) findings.push('review_exceeds_proposed_limit');
  const effective = stamp(p.effective_at, 'request.effective_at');
  const grantExpires = stamp(p.expires_at, 'request.expires_at');
  if (grantExpires - effective > binding.policy.max_assignment_seconds * 1000) findings.push('assignment_exceeds_proposed_limit');
  if (effective < reviewed || effective < now || grantExpires <= now) findings.push('assignment_retroactive_or_expired');
  return Object.freeze({ kind: 'unverified-assignment-governance-comparison', disposition: findings.length ? 'review-needed' : 'unverified-consistent',
    executable: false, authority: 'unverified', policyStatus: 'unapproved', findings: Object.freeze(findings), requiredGates: gates });
}
