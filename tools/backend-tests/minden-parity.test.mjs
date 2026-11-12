import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const en=read('minden/index.html'),es=read('minden/es/index.html');
const prereg=read('minden/register/index.html'),pub=read('assets/js/outreach-registration-public.js');
const form=read('assets/js/outreach-registration-form.js');
const migration=read('supabase/migrations/20261112120000_minden_family_fun_day_draft.sql');
const decisions=read('supabase/migrations/20261112120001_minden_decision_followup_view.sql');
const config=JSON.parse(read('config/outreach/minden-family-fun-day.json'));
const routes=read('_redirects');
test('decision pages preserve Minden-only intake and free book',()=>{
 for(const page of [en,es]){
  assert.match(page,/source:'minden_la_outreach'/);
  assert.match(page,/king-kind-reader.html\?source=minden/);
  assert.match(page,/\/minden\/register\//);
  assert.doesNotMatch(page,/Huntsville|huntsville|Cornerstone|Madison|October 24, 2026|24 de octubre de 2026/);
 }
});
test('household page uses exact campaign, no variable user slug',()=>{
 assert.match(prereg,/data-campaign="minden-family-fun-day"/);
 assert.match(pub,/document.body.dataset.campaign/);
 assert.match(pub,/slug==='minden-family-fun-day'/);
 assert.match(form,/config.slug==='minden-family-fun-day'/);
 assert.match(pub,/outreach-registration-submit/);
 assert.match(prereg,/turnstile/);
});
test('draft campaign cannot unintentionally take household registrations',()=>{
 assert.equal(config.registration.enabled,false);
 assert.equal(config.campaign.event_start,null);
 assert.equal(config.campaign.venue.name,null);
 assert.equal(config.waiver.status,'PENDING_APPROVED_LOUISIANA_TEXT');
 assert.match(migration,/'minden-family-fun-day'/);
 assert.match(migration,/'draft'/);
 assert.match(migration,/false, null, null/);
 assert.match(migration,/'minden_la_outreach'/);
 assert.doesNotMatch(migration,/insert\s+into\s+public\.outreach_campaign_assignments/i);
});
test('Minden decision desk is source and assignment scoped',()=>{
 assert.match(decisions,/private\.outreach_registration_can\(p_campaign, 'registration.view'\)/);
 assert.match(decisions,/where source='minden_la_outreach'/);
 assert.match(decisions,/revoke all on function public\.outreach_minden_decisions/);
 assert.match(decisions,/to authenticated;/);
 const staff=read('assets/js/minden-decision-staff.js');
 assert.match(staff,/outreach_registration_workspace/);
 assert.match(staff,/outreach_minden_decisions/);
 assert.doesNotMatch(staff,/localStorage|sessionStorage|innerHTML/);
});
test('all public Minden routes are mapped',()=>{
 for(const route of ['/minden ','/minden/ ','/minden/es ','/minden/es/ ','/minden/register ','/minden/register/ '])assert.ok(routes.includes(route),route);
});

test('staff campaign link is Minden-only and requires registration view',()=>{
 const staff=read('assets/js/outreach-registration-staff.js');
 assert.match(staff,/context\.config\?\.slug==='minden-family-fun-day'&&can\('registration.view'\)/);
 assert.match(staff,/href:'staff-minden-decisions.html'/);
 assert.doesNotMatch(staff,/window\.location\.replace\([^)]*minden/);
});
