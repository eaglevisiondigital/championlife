#!/usr/bin/env node
// Local/read-only onboarding contract. Does NOT connect to NMI, Supabase, Netlify or financial accounts.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const REQUIRED_ROUTES = ['Main','Youth','Outreach','Events','Merch'];
const GOOD = 'VERIFIED';
const NONSECRET_STATUSES = ['PENDING','VERIFIED','UNAVAILABLE'];
const ALL_CONTROLS = [
  'provider_sandbox_verified','canonical_ledger_reconciled','tokenized_checkout_verified',
  'webhook_replay_verified','refund_recovery_verified','merchant_authority_verified',
  'givehub_recurring_inventory_reviewed','owner_finance_release'
];
export function evaluate(document) {
  const errors = [], blockers = [];
  const slots=document?.mid_slots, routes=document?.checkout_routes, controls=document?.controls;
  if (document?.schema_version!==1 || document?.expected_mid_count!==4) errors.push('Wrong or missing v1/four-MID contract');
  if (!Array.isArray(slots) || slots.length!==4) errors.push('Exactly four non-secret MID slots required');
  if (!Array.isArray(routes) || routes.length!==5) errors.push('Exactly five conceptual checkout routes required (NOT five merchant IDs)');
  if (typeof controls!=='object' || !controls) errors.push('Missing approval/acceptance controls');
  for (const [i,slot] of (Array.isArray(slots)?slots:[]).entries()) {
    const id='MID-'+String(i+1).padStart(2,'0');
    if (slot.slot!==id) errors.push('Unrecognized/duplicate MID slot: '+String(slot.slot));
    for (const prop of ['legal_recipient_status','processor_status','settlement_owner_status','recurring_vault_status','test_access_status']) {
      if (!NONSECRET_STATUSES.includes(slot[prop])) errors.push(id+' invalid status: '+prop);
      if (slot[prop]!==GOOD) blockers.push(id+' '+prop+' not verified');
    }
    if (!['Champion Life','SowGo'].includes(slot.merchant_organization)) blockers.push(id+' merchant organization unverified');
    if (!slot.gateway_group_alias || slot.gateway_group_alias==='UNVERIFIED') blockers.push(id+' gateway grouping not verified');
    if (slot.verified_at && !slot.verified_by) errors.push(id+' verification timestamp without verifier');
  }
  const seen=new Set();
  for (const route of (Array.isArray(routes)?routes:[])) {
    if (!REQUIRED_ROUTES.includes(route.route)||seen.has(route.route)) errors.push('Invalid/duplicate route: '+String(route.route));
    seen.add(route.route);
    if (typeof route.enabled!=='boolean') errors.push(route.route+' missing enabled flag');
    const slot=slots?.find(s=>s.slot===route.mid_slot);
    if (!route.mid_slot) blockers.push(route.route+' route not mapped');
    if (!route.boarded_purpose_approved) blockers.push(route.route+' purpose not boarded/approved');
    if (route.enabled) {
      if (!slot) errors.push(route.route+' ENABLED without verified MID route');
      if (slot && slot.merchant_organization!==route.organization) errors.push(route.route+' illegal cross-organization merchant assignment');
      if (slot && ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status'].some(p=>slot[p]!==GOOD)) errors.push(route.route+' ENABLED without merchant/settlement evidence');
      if (!route.boarded_purpose_approved) errors.push(route.route+' ENABLED without onboarded transaction purpose');
      if (!ALL_CONTROLS.every(k=>controls?.[k]===true)) errors.push(route.route+' ENABLED without all release controls');
    }
  }
  for(const route of REQUIRED_ROUTES) if(!seen.has(route)) errors.push('Required conceptual route absent: '+route);
  for(const key of ALL_CONTROLS) {
    if(typeof controls?.[key]!=='boolean') errors.push('Invalid control: '+key);
    if(controls?.[key]!==true) blockers.push(key+' not passed');
  }
  return {valid:errors.length===0, ready:errors.length===0 && blockers.length===0, errors, blockers};
}
function selftest() {
  const t=JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json', import.meta.url),'utf8'));
  let tested=0;
  const check=(test,msg)=>{assert.ok(test,msg);tested++};
  const original=evaluate(t);
  check(original.valid,'safe unboarded template is structurally valid');
  check(!original.ready && original.blockers.length>0,'not-ready template fails closed');
  const bad1=structuredClone(t);bad1.checkout_routes[0].enabled=true;
  check(!evaluate(bad1).valid,'enable without MID and approvals rejected');
  const bad2=structuredClone(t);bad2.checkout_routes[2].enabled=true;bad2.checkout_routes[2].mid_slot='MID-01';
  bad2.mid_slots[0].merchant_organization='Champion Life';
  check(evaluate(bad2).errors.some(x=>x.includes('cross-organization')),'outreach cannot use church MID');
  const bad3=structuredClone(t);bad3.mid_slots.pop();
  check(!evaluate(bad3).valid,'missing merchant slot rejected');
  const bad4=structuredClone(t);bad4.checkout_routes.push({...bad4.checkout_routes[0]});
  check(!evaluate(bad4).valid,'duplicate/extra route rejected');
  const bad5=structuredClone(t);bad5.controls.owner_finance_release='yes';
  check(!evaluate(bad5).valid,'approval must be boolean');
  console.log('NMI four-MID nonproduction readiness contract:',tested,'synthetic assertions PASS');
}
if (process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split('/').pop())) {
  if(process.argv.includes('--selftest')) selftest();
  else {
    const filename=process.argv.find((a,i)=>i>1 && !a.startsWith('--')) || new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url);
    const document=JSON.parse(readFileSync(filename,'utf8'));
    const result=evaluate(document);
    console.log(JSON.stringify({status:result.ready?'READY_FOR_REVIEW':result.valid?'HOLD_NOT_BOARDING_VERIFIED':'INVALID',errors:result.errors,blockers:result.blockers},null,2));
    if(!result.valid || (process.argv.includes('--require-ready')&&!result.ready)) process.exitCode=1;
  }
}
