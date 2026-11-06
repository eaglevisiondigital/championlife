// Offline FICTIONAL contract exercise. Never imports a database, provider or writer.
// Signatures prove fixture byte integrity, not real identity or accepted custody.
import {createHash, createPublicKey, verify} from 'node:crypto';

export const provenanceDigest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = () => { throw new Error('Invalid fixture provenance'); };
const check = value => { if (!value) fail(); };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const revision = value => Number.isSafeInteger(value) && value > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const keys = (value, expected) => {
  check(value && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).sort().join('|') === expected.split(' ').sort().join('|'));
};
const instant = value => {
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value));
  const ms = Date.parse(value); check(Number.isFinite(ms) && new Date(ms).toISOString() === value); return ms;
};
const parse = bytes => {
  check(typeof bytes === 'string' && bytes.length > 0 && bytes.length <= 100000);
  const result = JSON.parse(bytes);
  // One unambiguous encoding; rejects duplicate JSON keys and whitespace disguises.
  check(JSON.stringify(result) === bytes); return result;
};
function signed(envelope, key) {
  keys(envelope, 'bytes signature');
  check(typeof envelope.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature));
  check(verify(null, Buffer.from(envelope.bytes), key, Buffer.from(envelope.signature, 'base64')));
  return parse(envelope.bytes);
}
const output = (status, reason) => Object.freeze({status, reason,
  canLink: false, canWrite: false, canContact: false, realEvidenceVerified: false});

/** Fixture trust roots are injected by a test owner, never by an evidence envelope.
 * No production constructor, flag, activation setter, output receipt or write port exists.
 * Canonical facts must come from a consistent current database snapshot. They are NOT
 * evidence authenticity, identity proof, reviewer designation or fresh task authority.
 */
export function createFixtureProvenanceEvaluator({authorityKey, sourceKey, reviewerKey, trustedFixtureHeadBytes}) {
  const roots = [authorityKey, sourceKey, reviewerKey].map(value => createPublicKey(value));
  check(roots.every(key => key.asymmetricKeyType === 'ed25519'));
  check(new Set(roots.map(key => key.export({type:'spki',format:'pem'}))).size === 3);
  // Captured from the test custodian separately from the caller's proposed history.
  // Missing/malformed anchoring can never be upgraded by the submitted envelope.
  let anchor;
  try {
    anchor = parse(trustedFixtureHeadBytes);
    keys(anchor, 'case_sha256 policy_sha256 designation_sha256 event_count head_sha256 captured_at current_until');
    check(hash(anchor.case_sha256) && hash(anchor.policy_sha256) && hash(anchor.designation_sha256) && hash(anchor.head_sha256) && revision(anchor.event_count));
    check(instant(anchor.captured_at) < instant(anchor.current_until));
  } catch { anchor = null; }
  return function inspect(input, now) {
    try {
      keys(input, 'caseBytes canonicalBytes policy designation receipts history');
      const {caseBytes, canonicalBytes, policy, designation, receipts, history} = input;
      check(Number.isSafeInteger(now));
      const c = parse(caseBytes), facts = parse(canonicalBytes);
      keys(c, 'mode purpose case_id version organization_id campaign_id registration_id person_id account_id requested_by reviewed_by task_id binding_id source task_revision binding_revision portal_link_id portal_link_revision campaign_registrant_id campaign_registrant_revision followup_revision canonical_sha256 policy_id method');
      check(c.mode === 'fictional-contract-only' && c.method === 'fictional-witness-v1' && c.purpose === 'canonical-outreach-task-association');
      for (const k of ['case_id','organization_id','campaign_id','registration_id','person_id','account_id','requested_by','reviewed_by','task_id','binding_id','portal_link_id','campaign_registrant_id','policy_id']) check(uuid(c[k]));
      for (const k of ['version','task_revision','binding_revision','portal_link_revision','campaign_registrant_revision','followup_revision']) check(revision(c[k]));
      check(typeof c.source === 'string' && /^[a-z0-9_]{1,80}$/.test(c.source));
      check(c.requested_by !== c.reviewed_by && c.account_id !== c.reviewed_by);
      check(hash(c.canonical_sha256) && c.canonical_sha256 === provenanceDigest(canonicalBytes));
      keys(facts, 'campaign source registration person portal_link portal_events registrant followup task binding account reviewer authorizer');
      const one = (rows, predicate) => { check(Array.isArray(rows) && rows.length === 1 && predicate(rows[0])); return rows[0]; };
      one(facts.campaign, r => r.id === c.campaign_id && r.organization_id === c.organization_id);
      one(facts.source, r => r.campaign_id === c.campaign_id && r.source === c.source && r.active === true);
      one(facts.registration, r => r.id === c.registration_id && r.source === c.source && r.user_id === c.account_id && r.consent === true);
      one(facts.person, r => r.id === c.person_id && r.organization_id === c.organization_id);
      one(facts.portal_link, r => r.id === c.portal_link_id && r.organization_id === c.organization_id && r.person_id === c.person_id && r.user_id === c.account_id && r.active === true && r.revision === c.portal_link_revision);
      keys(facts.portal_events, 'original current');
      check(facts.portal_events.original === 1 && facts.portal_events.current === 1);
      one(facts.registrant, r => r.id === c.campaign_registrant_id && r.revision === c.campaign_registrant_revision && r.organization_id === c.organization_id && r.campaign_id === c.campaign_id && r.legacy_registration_id === c.registration_id && r.person_id === c.person_id);
      one(facts.followup, r => r.registration_id === c.registration_id && r.campaign_id === c.campaign_id && r.assigned_user_id === c.requested_by && r.revision === c.followup_revision);
      one(facts.task, r => r.id === c.task_id && r.organization_id === c.organization_id && r.person_id === c.person_id && r.assigned_user_id === c.requested_by && r.revision === c.task_revision && r.title === 'Outreach follow-up' && r.workflow_run_id === null);
      one(facts.binding, r => r.id === c.binding_id && r.task_id === c.task_id && r.organization_id === c.organization_id && r.campaign_id === c.campaign_id && r.registration_id === c.registration_id && r.person_id === c.person_id && r.account_id === c.account_id && r.requested_by === c.requested_by && r.reviewed_by === c.reviewed_by && r.portal_link_id === c.portal_link_id && r.portal_link_revision === c.portal_link_revision && r.campaign_registrant_id === c.campaign_registrant_id && r.campaign_registrant_revision === c.campaign_registrant_revision && r.source === c.source && r.revision === c.binding_revision && r.revoked_at === null && r.eligibility === 'verified_adult' && instant(r.reviewed_at) <= now && now < instant(r.valid_until));
      for (const [name,id] of [['account',c.account_id],['reviewer',c.reviewed_by]]) one(facts[name], r => r.id === id && r.verified === true && r.active === true);

      const p = signed(policy, roots[0]);
      keys(p, 'mode policy_id organization_id campaign_id method accepted_methods valid_from valid_until evidence_retain_until audit_retain_until');
      check(p.mode === c.mode && p.policy_id === c.policy_id && p.organization_id === c.organization_id && p.campaign_id === c.campaign_id && p.method === c.method);
      const start = instant(p.valid_from), end = instant(p.valid_until), retain = instant(p.evidence_retain_until), auditRetain = instant(p.audit_retain_until);
      check(start <= now && now < end && end <= retain && retain <= auditRetain && end <= instant(facts.binding[0].valid_until));
      // Per-claim acceptance is part of the signed policy, never inferred from a
      // generic method name or a source witness's assertion. IDs remain fictional.
      keys(p.accepted_methods, 'source identity adult consent');
      for (const [kind, acceptance] of Object.entries(p.accepted_methods)) {
        keys(acceptance, 'method valid_from valid_until');
        check(acceptance.method === `fictional-${kind}-witness-v1`);
        check(start <= instant(acceptance.valid_from) && instant(acceptance.valid_from) <= now
          && now < instant(acceptance.valid_until) && instant(acceptance.valid_until) <= end);
      }
      const d = signed(designation, roots[0]);
      keys(d, 'mode reviewer_id authorizer_id organization_id campaign_id policy_id valid_from valid_until');
      check(d.mode === c.mode && uuid(d.authorizer_id) && ![c.requested_by,c.reviewed_by,c.account_id].includes(d.authorizer_id));
      check(d.reviewer_id === c.reviewed_by && d.organization_id === c.organization_id && d.campaign_id === c.campaign_id && d.policy_id === c.policy_id);
      check(instant(d.valid_from) <= now && now < instant(d.valid_until) && instant(d.valid_until) <= end);
      // Account status is a necessary current consistency fact, not authority or
      // independent identity proof. Only the fictional authority root designates.
      one(facts.authorizer, r => r.id === d.authorizer_id && r.verified === true && r.active === true);

      // Separate original bytes for each source, identity, adult and consent claim.
      // An unrelated digest, verified:true, role name or matching contact is insufficient.
      check(Array.isArray(receipts) && receipts.length === 4);
      const expected = new Set(['source','identity','adult','consent']);
      const caseHash = provenanceDigest(caseBytes), receiptHashes = []; let lastObservation = start;
      for (const receipt of receipts) {
        keys(receipt, 'original signed');
        const e = signed(receipt.signed, roots[1]);
        keys(e, 'kind method case_sha256 original_sha256 policy_sha256 designation_sha256 observed_at valid_until');
        check(expected.delete(e.kind) && e.case_sha256 === caseHash && e.policy_sha256 === provenanceDigest(policy.bytes) && e.designation_sha256 === provenanceDigest(designation.bytes));
        const acceptance = p.accepted_methods[e.kind];
        check(e.method === acceptance.method && instant(acceptance.valid_from) <= instant(e.observed_at)
          && instant(e.valid_until) <= instant(acceptance.valid_until));
        check(typeof receipt.original === 'string' && provenanceDigest(receipt.original) === e.original_sha256);
        const original = parse(receipt.original);
        keys(original, 'mode kind case_sha256 assertion');
        check(original.mode === c.mode && original.kind === e.kind && original.case_sha256 === caseHash);
        const assertions = {source:'original-record-witnessed', identity:'independent-person-account-witnessed', adult:'adult-independently-witnessed', consent:'exact-purpose-consent-witnessed'};
        check(original.assertion === assertions[e.kind]);
        check(start <= instant(e.observed_at) && instant(e.observed_at) <= now && now < instant(e.valid_until) && instant(e.valid_until) <= end);
        lastObservation = Math.max(lastObservation, instant(e.observed_at));
        receiptHashes.push(provenanceDigest(receipt.signed.bytes));
      }
      // Complete fixture history must be supplied by its independent custodian, not a
      // client-selected suffix. A real append-only store/custodian is still unavailable.
      check(Array.isArray(history) && history.length >= 1 && history.length <= 2);
      let previous = null, withdrawn = false, lastTime = lastObservation;
      for (const [index,event] of history.entries()) {
        const e = signed(event, roots[2]);
        keys(e, 'mode case_id version case_sha256 action sequence previous_sha256 receipt_sha256 actor_id recorded_at valid_until evidence_retain_until audit_retain_until');
        check(e.mode === c.mode && e.case_id === c.case_id && e.version === c.version && e.case_sha256 === caseHash && e.sequence === index + 1 && e.previous_sha256 === previous && e.actor_id === c.reviewed_by);
        check(Array.isArray(e.receipt_sha256) && e.receipt_sha256.length === 4 && e.receipt_sha256.every((value,i) => value === receiptHashes[i]));
        check(e.action === (index === 0 ? 'approved' : 'withdrawn'));
        const at = instant(e.recorded_at);
        check(lastTime <= at && at <= now && instant(d.valid_from) <= at && at < instant(d.valid_until)); lastTime = at;
        check(e.valid_until === p.valid_until && e.evidence_retain_until === p.evidence_retain_until && e.audit_retain_until === p.audit_retain_until);
        previous = provenanceDigest(event.bytes); withdrawn ||= e.action === 'withdrawn';
      }
      check(anchor && anchor.case_sha256 === caseHash && anchor.policy_sha256 === provenanceDigest(policy.bytes)
        && anchor.designation_sha256 === provenanceDigest(designation.bytes) && anchor.event_count === history.length
        && anchor.head_sha256 === previous && lastTime <= instant(anchor.captured_at) && instant(anchor.captured_at) <= now
        && now < instant(anchor.current_until) && instant(anchor.current_until) <= end);
      return output(withdrawn ? 'withdrawn' : 'fixture-contract-pass', 'Real reviewer designation, source verification method and immutable custody remain unapproved.');
    } catch {
      return output('denied', 'Invalid, stale, conflicting or incomplete fixture provenance.');
    }
  };
}
