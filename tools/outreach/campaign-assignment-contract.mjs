// Review-document validation only. This module has no database, issuer or authority adapter.
import { createHash } from 'node:crypto';
export const FOUNDATION = Object.freeze({
  commit: '5a675eff43a37f3fba2425b834b084b22bb1e281',
  migration: 'supabase/migrations/20261103035250_campaign_assigned_decision_foundation.sql',
  sha256: 'c042c3fd96463c095b69d44bb390b40ea92172db841636c73e8f28833c357854'
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = /^[0-9a-f]{64}$/;
const required = ['version','request_id','foundation_sha256','organization_id','campaign_id','registration_id','source','worker_user_id','requester_user_id','reviewer_user_id','effective_at','expires_at','capabilities','expected_campaign_assignment_revision','expected_record_revision','source_mapping_snapshot_sha256','record_binding_snapshot_sha256','worker_identity_evidence_sha256','administrator_authority_evidence_sha256','audit_policy_sha256','reason'];
const fail = field => { throw new TypeError('Invalid assignment review field: '+field); };
function canonical(value) {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function timestamp(value,key) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(key);
  const n=Date.parse(value);
  if(!Number.isFinite(n)||new Date(n).toISOString()!==value) fail(key);
  return n;
}
export function prepareAssignmentReview(input) {
  if(!input||Object.getPrototypeOf(input)!==Object.prototype) fail('request');
  // Reject accessor/prototype trickery as well as unknown JSON fields.
  if(Reflect.ownKeys(input).length!==required.length || required.some(k=>!Object.hasOwn(input,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),'value'))) fail('shape');
  const p=structuredClone(input);
  if(p.version!=='campaign-assignment-review.v1') fail('version');
  if(p.foundation_sha256!==FOUNDATION.sha256) fail('foundation_sha256');
  for(const key of ['request_id','organization_id','campaign_id','registration_id','worker_user_id','requester_user_id','reviewer_user_id']) if(typeof p[key]!=='string'||!uuid.test(p[key])) fail(key);
  if(new Set([p.worker_user_id,p.requester_user_id,p.reviewer_user_id]).size!==3) fail('independent_proposed_roles');
  if(typeof p.source!=='string'||!/^[a-z0-9_]{3,80}$/.test(p.source)) fail('source');
  if(timestamp(p.expires_at,'expires_at')<=timestamp(p.effective_at,'effective_at')) fail('expiry_order');
  // These are observed revisions, not permission to create missing rows.
  for(const key of ['expected_campaign_assignment_revision','expected_record_revision']) if(!Number.isSafeInteger(p[key])||p[key]<0||p[key]>2147483647) fail(key);
  if(!Array.isArray(p.capabilities)||p.capabilities.length<2||p.capabilities.length>3||new Set(p.capabilities).size!==p.capabilities.length||!p.capabilities.includes('view')||!p.capabilities.includes('decisions.read')||p.capabilities.some(v=>!['view','decisions.read','followup.manage'].includes(v))) fail('capabilities');
  for(const key of ['source_mapping_snapshot_sha256','record_binding_snapshot_sha256','worker_identity_evidence_sha256','administrator_authority_evidence_sha256','audit_policy_sha256']) if(typeof p[key]!=='string'||!hash.test(p[key])) fail(key);
  if(!['initial_assigned_care','reassignment','scope_reduction','expiry_change','revoke'].includes(p.reason)) fail('reason');
  p.capabilities.sort();
  const canonicalRequest=canonical(p), requestSha256=createHash('sha256').update(canonicalRequest).digest('hex');
  return Object.freeze({kind:'unverified-assignment-review-request',executable:false,authority:'unverified',requestSha256,canonicalRequest,
    sourceTable:'public.outreach_registrations',careScope:'assigned',contactAllowed:false,exportAllowed:false,messagingAllowed:false,
    requiredGates:Object.freeze(['independent_current_issuer_authority','verified_worker_and_session','current_source_and_record_mapping','serialized_revision_and_revocation_checks','preserve_existing_nondecision_permissions','immutable_atomic_issuance_audit','separately_authorized_issuer_implementation'])});
}
