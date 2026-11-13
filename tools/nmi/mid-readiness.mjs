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
// The first one-time checkout pilot does not require GiveHub recurring-token migration.
// Recurring enablement remains separately gated by that inventory and vault proof.
const PILOT_CONTROLS = ALL_CONTROLS.filter(k=>k!=='givehub_recurring_inventory_reviewed');
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
    if (typeof route.boarded_purpose_approved!=='boolean') errors.push(route.route+' invalid purpose approval');
    if (route.boarded_purpose_approved!==true) blockers.push(route.route+' purpose not boarded/approved');
    if (route.enabled) {
      if (!slot) errors.push(route.route+' ENABLED without verified MID route');
      if (slot && slot.merchant_organization!==route.organization) errors.push(route.route+' illegal cross-organization merchant assignment');
      if (slot && ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status'].some(p=>slot[p]!==GOOD)) errors.push(route.route+' ENABLED without merchant/settlement evidence');
      if (route.boarded_purpose_approved!==true) errors.push(route.route+' ENABLED without onboarded transaction purpose');
      if (!PILOT_CONTROLS.every(k=>controls?.[k]===true)) errors.push(route.route+' ENABLED without one-time checkout controls');
    }
  }
  for(const route of REQUIRED_ROUTES) if(!seen.has(route)) errors.push('Required conceptual route absent: '+route);
  for(const key of ALL_CONTROLS) {
    if(typeof controls?.[key]!=='boolean') errors.push('Invalid control: '+key);
    if(controls?.[key]!==true) blockers.push(key+' not passed');
  }
  return {valid:errors.length===0, ready:errors.length===0 && blockers.length===0, errors, blockers};
}
export function evaluatePilot(document, routeName) {
  const all=evaluate(document), blockers=[];
  if(!REQUIRED_ROUTES.includes(routeName)) return {valid:false,ready:false,errors:[...all.errors,'Unknown pilot route'],blockers};
  const route=document?.checkout_routes?.find(r=>r.route===routeName);
  const slot=document?.mid_slots?.find(s=>s.slot===route?.mid_slot);
  if(!route || !slot) blockers.push('Pilot checkout route has no mapped MID');
  else {
    if(slot.merchant_organization!==route.organization) blockers.push('Pilot merchant organization does not own route');
    for(const key of ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status']) {
      if(slot[key]!==GOOD)blockers.push('Pilot '+key+' not verified');
    }
    if(!slot.gateway_group_alias || slot.gateway_group_alias==='UNVERIFIED')blockers.push('Pilot gateway grouping unverified');
  }
  if(route?.boarded_purpose_approved!==true)blockers.push('Pilot purpose not approved by boarded merchant');
  for(const key of PILOT_CONTROLS)if(document?.controls?.[key]!==true)blockers.push('Pilot '+key+' not accepted');
  return {valid:all.valid,ready:all.valid && blockers.length===0,errors:all.errors,blockers};
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
  const pilot=structuredClone(t), s=pilot.mid_slots[0];
  s.merchant_organization='Champion Life';s.gateway_group_alias='GATEWAY-A';
  for(const k of ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status'])s[k]=GOOD;
  s.verified_by='synthetic-reviewer';s.verified_at='2026-11-02T12:00:00Z';
  pilot.checkout_routes[0].mid_slot='MID-01';pilot.checkout_routes[0].boarded_purpose_approved=true;
  for(const k of PILOT_CONTROLS)pilot.controls[k]=true;
  check(evaluatePilot(pilot,'Main').ready,'one verified one-time MID route can pilot while other routes remain held');
  check(!evaluate(pilot).ready,'unboarded other routes cannot be described as globally ready');
  pilot.checkout_routes[0].enabled=true;
  check(evaluate(pilot).valid,'one-time pilot does not require unrelated GiveHub recurring token migration');
  const wrong=structuredClone(pilot);wrong.mid_slots[0].merchant_organization='SowGo';
  check(!evaluatePilot(wrong,'Main').ready,'cross-organization pilot MID denied');
  console.log('NMI four-MID nonproduction readiness contract:',tested,'synthetic assertions PASS');
}
if (process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split('/').pop())) {
  if(process.argv.includes('--selftest')) selftest();
  else {
    const filename=process.argv.find((a,i)=>i>1 && !a.startsWith('--')) || new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url);
    const document=JSON.parse(readFileSync(filename,'utf8'));
    const pilotName=process.argv.find(a=>a.startsWith('--pilot-route='))?.split('=')[1];
    const requirePilotName=process.argv.find(a=>a.startsWith('--require-pilot-route='))?.split('=')[1];
    const selected=pilotName||requirePilotName;
    const result=selected?evaluatePilot(document,selected):evaluate(document);
    console.log(JSON.stringify({scope:selected?'PILOT_'+selected:'ALL_ROUTES',status:result.ready?'READY_FOR_REVIEW':result.valid?'HOLD_NOT_BOARDING_VERIFIED':'INVALID',errors:result.errors,blockers:result.blockers},null,2));
    if(!result.valid || (process.argv.includes('--require-ready')&&!result.ready) || (requirePilotName&&!result.ready)) process.exitCode=1;
  }
}
