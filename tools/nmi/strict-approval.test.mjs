import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate, evaluatePilot} from './mid-readiness.mjs';
import {prepareDisabledRoute} from './disabled-routing.mjs';

const NOW = '2026-11-02T15:00:00Z';
const invalid = [undefined, null, '', 'false', 'true', 'yes', 0, 1, -1, [], {}, [true]];
const labels = ['missing', 'null', 'empty string', 'string false', 'string true', 'string yes', 'zero', 'one', 'negative', 'array', 'object', 'array true'];
const routes = ['Main', 'Youth', 'Outreach', 'Events', 'Merch'];
const controls = ['provider_sandbox_verified','canonical_ledger_reconciled','tokenized_checkout_verified','webhook_replay_verified','refund_recovery_verified','merchant_authority_verified','givehub_recurring_inventory_reviewed','owner_finance_release'];
const confirmations = ['legalMerchantConfirmed','settlementOwnershipConfirmed','receiptOwnershipConfirmed','providerPurposeConfirmed'];
function fixture(name = 'Main') {
 const d = JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json', import.meta.url)));
 for (const [i, slot] of d.mid_slots.entries()) {
  slot.merchant_organization = i === 1 ? 'SowGo' : 'Champion Life';
  slot.gateway_group_alias = 'FictionalGateway' + i;
  for (const key of ['legal_recipient_status','processor_status','settlement_owner_status','recurring_vault_status','test_access_status']) slot[key] = 'VERIFIED';
 }
 for (const r of d.checkout_routes) {
  r.organization = r.route === 'Outreach' ? 'SowGo' : 'Champion Life';
  r.purpose = r.route === 'Merch' ? 'purchase' : r.route === 'Events' ? 'event_fee' : 'contribution';
  r.mid_slot = r.route === 'Outreach' ? 'MID-02' : 'MID-01';
  r.boarded_purpose_approved = true;
 }
 for (const key of controls) d.controls[key] = true;
 const r = d.checkout_routes.find(x => x.route === name), s = d.mid_slots.find(x => x.slot === r.mid_slot);
 const receipt = {route:name,midSlot:s.slot,organization:r.organization,purpose:r.purpose,gatewayGroupAlias:s.gateway_group_alias,evidenceRef:'FictionalEvidence',legalMerchantAlias:'FictionalMerchant',settlementOwnerAlias:'FictionalSettlement',receiptOwnerAlias:'FictionalReceipt',verifiedBy:'ReviewerA',independentReviewer:'ReviewerB',verifiedAt:'2026-11-02T14:00:00Z',expiresAt:'2026-11-03T14:00:00Z'};
 for (const key of confirmations) receipt[key] = true;
 return {d,r,receipt};
}
function set(object,key,value) { if (value === undefined) delete object[key]; else object[key] = value; }
function disabled(result) { assert.equal(result.canSubmit,false); assert.equal(result.mode,'disabled'); }
for (const name of routes) {
 for (const [i,value] of invalid.entries()) test(name+' rejects purpose '+labels[i], () => {
  const {d,r,receipt} = fixture(name); set(r,'boarded_purpose_approved',value);
  const global = evaluate(d); assert.equal(global.valid,false); assert.equal(global.ready,false);
  for (const other of routes) { const pilot=evaluatePilot(d,other); assert.equal(pilot.valid,false); assert.equal(pilot.ready,false); }
  const plan=prepareDisabledRoute(d,name,receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,false);
 });
 for (const value of [false,true]) test(name+' literal purpose '+value, () => {
  const {d,r,receipt}=fixture(name); r.boarded_purpose_approved=value;
  assert.equal(evaluate(d).valid,true); assert.equal(evaluate(d).ready,value);
  assert.equal(evaluatePilot(d,name).valid,true); assert.equal(evaluatePilot(d,name).ready,value);
  const plan=prepareDisabledRoute(d,name,receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,value);
 });
}
for (const key of controls) {
 for (const [i,value] of invalid.entries()) test(key+' rejects '+labels[i], () => {
  const {d,receipt}=fixture(); set(d.controls,key,value);
  assert.equal(evaluate(d).valid,false); assert.equal(evaluate(d).ready,false);
  for (const name of routes) { assert.equal(evaluatePilot(d,name).valid,false); assert.equal(evaluatePilot(d,name).ready,false); }
  const plan=prepareDisabledRoute(d,'Main',receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,false);
 });
 for (const value of [false,true]) test(key+' literal '+value, () => {
  const {d,receipt}=fixture(); d.controls[key]=value;
  assert.equal(evaluate(d).valid,true); assert.equal(evaluate(d).ready,value);
  // Preserve the reviewed one-time-pilot exemption; false is never a recurring approval.
  const pilotReady = value || key === 'givehub_recurring_inventory_reviewed';
  assert.equal(evaluatePilot(d,'Main').valid,true); assert.equal(evaluatePilot(d,'Main').ready,pilotReady);
  const plan=prepareDisabledRoute(d,'Main',receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,pilotReady);
 });
}
for (const key of confirmations) {
 for (const [i,value] of invalid.entries()) test(key+' invalid receipt '+labels[i], () => {
  const {d,receipt}=fixture(); set(receipt,key,value);
  const plan=prepareDisabledRoute(d,'Main',receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,false); assert.equal(plan.reason,'INVALID_EVIDENCE_APPROVAL');
 });
 for (const value of [false,true]) test(key+' literal receipt '+value, () => {
  const {d,receipt}=fixture(); receipt[key]=value;
  const plan=prepareDisabledRoute(d,'Main',receipt,NOW); disabled(plan); assert.equal(plan.readyForReview,value);
  if (!value) assert.equal(plan.reason,'EVIDENCE_NOT_CONFIRMED');
 });
}
