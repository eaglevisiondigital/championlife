// FICTIONAL local fixtures. Never use these signing keys, assertions or trust roots
// for real evidence. No file/network persistence and no real reviewer designation.
import {generateKeyPairSync, sign, randomUUID} from 'node:crypto';
import {provenanceDigest, createFixtureProvenanceEvaluator} from './campaign-provenance-contract.mjs';

/** Only exercised with createCampaignTaskFixture's disposable Unix-socket DB.
 * Read one consistent snapshot; omit names, emails, phones, notes, prayer/answers.
 * The existing portal history is compared server-side, never copied to the report.
 */
export async function readFixtureCanonicalFacts(f) {
  const c = await f.db.connect();
  try {
    await c.query('begin isolation level repeatable read read only');
    const rows = async(sql, args) => (await c.query(sql,args)).rows;
    const facts = {};
    facts.campaign = await rows('select id,organization_id from outreach_campaigns where id=$1',[f.campaignId]);
    facts.source = await rows('select campaign_id,source,active from outreach_decision_campaign_sources where campaign_id=$1',[f.campaignId]);
    facts.registration = await rows('select id,source,user_id,consent from outreach_registrations where id=$1',[f.registrationId]);
    facts.person = await rows('select id,organization_id from organization_people where organization_id=$1 and id=$2',[f.orgId,f.personId]);
    facts.portal_link = await rows('select id,organization_id,person_id,user_id,active,revision from portal_account_links where id=$1',[f.link.id]);
    facts.portal_events = (await rows(`select
      (select count(*)::int from portal_admin_events e join portal_account_links l on l.id=e.subject_id
       where l.id=$1 and e.organization_id=l.organization_id and e.kind='account_link' and e.before_state is null
       and e.after_state->>'user_id'=l.user_id::text and e.after_state->>'person_id'=l.person_id::text and e.after_state->>'organization_id'=l.organization_id::text) original,
      (select count(*)::int from portal_admin_events e join portal_account_links l on l.id=e.subject_id
       where l.id=$1 and e.organization_id=l.organization_id and e.kind='account_link' and e.after_state=to_jsonb(l)) current`,[f.link.id]))[0];
    facts.registrant = await rows('select id,organization_id,campaign_id,legacy_registration_id,person_id,revision from outreach_campaign_registrants where id=$1',[f.registrantId]);
    facts.followup = await rows('select registration_id,campaign_id,assigned_user_id,revision from outreach_decision_followup where registration_id=$1',[f.registrationId]);
    facts.task = await rows('select id,organization_id,person_id,title,assigned_user_id,workflow_run_id,revision from followup_tasks where id=$1',[f.taskId]);
    facts.binding = await rows(`select id,task_id,organization_id,campaign_id,registration_id,person_id,account_id,
      requested_by,reviewed_by,portal_link_id,portal_link_revision,campaign_registrant_id,campaign_registrant_revision,
      source,revision,revoked_at,eligibility,reviewed_at,valid_until from private.campaign_person_task_bindings where id=$1`,[f.bindingId]);
    for (const [name,id] of [['account',f.users.learner.id],['reviewer',f.users.reviewer.id],['authorizer',f.users.other.id]]) facts[name] = await rows(`select id,
      (email_confirmed_at is not null and not coalesce(is_anonymous,false)) verified,
      (deleted_at is null and (banned_until is null or banned_until<=clock_timestamp())) active from auth.users where id=$1`,[id]);
    await c.query('commit'); return JSON.stringify(facts);
  } catch(e) { await c.query('rollback'); throw e; }
  finally { await c.end(); }
}

export function makeProvenanceFixture(f, canonicalBytes, now = Date.now()) {
  const pair = () => generateKeyPairSync('ed25519');
  const authority = pair(), source = pair(), reviewer = pair();
  const pem = key => key.export({type:'spki',format:'pem'});
  const seal = (value, key) => { const bytes = JSON.stringify(value); return {bytes,signature:sign(null,Buffer.from(bytes),key).toString('base64')}; };
  const iso = offset => new Date(now+offset).toISOString();
  const facts = JSON.parse(canonicalBytes), policyId = randomUUID();
  const c = {mode:'fictional-contract-only',purpose:'canonical-outreach-task-association',case_id:randomUUID(),version:1,organization_id:f.orgId,campaign_id:f.campaignId,
    registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,requested_by:f.users.worker.id,
    reviewed_by:f.users.reviewer.id,task_id:f.taskId,binding_id:f.bindingId,source:'fictional_task_source',
    task_revision:facts.task[0].revision,binding_revision:facts.binding[0].revision,portal_link_id:f.link.id,
    portal_link_revision:facts.portal_link[0].revision,campaign_registrant_id:f.registrantId,
    campaign_registrant_revision:facts.registrant[0].revision,followup_revision:facts.followup[0].revision,
    canonical_sha256:provenanceDigest(canonicalBytes),policy_id:policyId,method:'fictional-witness-v1'};
  const caseBytes = JSON.stringify(c), caseHash = provenanceDigest(caseBytes);
  // Numbers below are arbitrary synthetic test windows, not approved retention policy.
  const p = {mode:c.mode,policy_id:policyId,organization_id:f.orgId,campaign_id:f.campaignId,method:c.method,
    accepted_methods:Object.fromEntries(['source','identity','adult','consent'].map(kind=>[kind,
      {method:`fictional-${kind}-witness-v1`,valid_from:iso(-30000),valid_until:iso(300000)}])),
    valid_from:iso(-30000),valid_until:iso(300000),evidence_retain_until:iso(600000),audit_retain_until:iso(900000)};
  const policy = seal(p,authority.privateKey);
  const designation = seal({mode:c.mode,reviewer_id:c.reviewed_by,authorizer_id:f.users.other.id,organization_id:f.orgId,
    campaign_id:f.campaignId,policy_id:policyId,valid_from:iso(-30000),valid_until:p.valid_until},authority.privateKey);
  const assertions = {source:'original-record-witnessed',identity:'independent-person-account-witnessed',adult:'adult-independently-witnessed',consent:'exact-purpose-consent-witnessed'};
  const receipts = Object.entries(assertions).map(([kind,assertion]) => {
    const original = JSON.stringify({mode:c.mode,kind,case_sha256:caseHash,assertion});
    return {original,signed:seal({kind,method:p.accepted_methods[kind].method,case_sha256:caseHash,original_sha256:provenanceDigest(original),
      policy_sha256:provenanceDigest(policy.bytes),designation_sha256:provenanceDigest(designation.bytes),observed_at:iso(-20000),valid_until:p.valid_until},source.privateKey)};
  });
  const approval = {mode:c.mode,case_id:c.case_id,version:c.version,case_sha256:caseHash,action:'approved',sequence:1,
    previous_sha256:null,receipt_sha256:receipts.map(r=>provenanceDigest(r.signed.bytes)),actor_id:c.reviewed_by,
    recorded_at:iso(-10000),valid_until:p.valid_until,evidence_retain_until:p.evidence_retain_until,audit_retain_until:p.audit_retain_until};
  const history = [seal(approval,reviewer.privateKey)];
  const input = {caseBytes,canonicalBytes,policy,designation,receipts,history};
  const trust = {authorityKey:pem(authority.publicKey),sourceKey:pem(source.publicKey),reviewerKey:pem(reviewer.publicKey)};
  const anchor = input => JSON.stringify({case_sha256:provenanceDigest(input.caseBytes),policy_sha256:provenanceDigest(input.policy.bytes),
    designation_sha256:provenanceDigest(input.designation.bytes),event_count:input.history.length,
    head_sha256:provenanceDigest(input.history.at(-1).bytes),captured_at:iso(0),current_until:p.valid_until});
  return {input,now,trust,anchor,evaluator:()=>createFixtureProvenanceEvaluator({...trust,trustedFixtureHeadBytes:anchor(input)}),
    signAuthority:value=>seal(value,authority.privateKey),signSource:value=>seal(value,source.privateKey),signReviewer:value=>seal(value,reviewer.privateKey),
    withdrawal:()=>seal({...approval,action:'withdrawn',sequence:2,previous_sha256:provenanceDigest(history[0].bytes),recorded_at:iso(-5000)},reviewer.privateKey)};
}
