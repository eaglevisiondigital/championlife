import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const en=read('minden/index.html'),es=read('minden/es/index.html');
const prereg=read('minden/register/index.html'),pub=read('assets/js/outreach-registration-public.js');
const form=read('assets/js/outreach-registration-form.js');
const migration=read('supabase/migrations/20261112120000_minden_family_fun_day_draft.sql');
const decisions=read('supabase/migrations/20261113120000_minden_decision_authority_correction.sql');
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
 assert.equal(config.campaign.event_start,'2026-12-19T12:00:00-06:00');
 assert.equal(config.campaign.event_end,'2026-12-19T14:00:00-06:00');
 assert.equal(config.campaign.registration_start,'2026-12-19T11:00:00-06:00');
 assert.equal(config.campaign.venue.name,'Victory Park');
 assert.match(config.campaign.venue.address,/Park Highway, Minden, LA 71055/);
 assert.equal(config.registration.event_profile.on_site_registration_at,'2026-12-19T11:00:00-06:00');
 assert.match(config.registration.event_profile.highlights,/100 Bicycles/);
 assert.equal(config.waiver.status,'PENDING_APPROVED_LOUISIANA_TEXT');
 assert.match(migration,/'minden-family-fun-day'/);
 assert.match(migration,/2026-12-19T12:00:00-06:00/);
 assert.match(migration,/2026-12-19T14:00:00-06:00/);
 assert.match(migration,/2026-12-19T11:00:00-06:00/);
 assert.match(migration,/Victory Park/);
 assert.match(migration,/100 bicycles/);
 assert.match(prereg,/December 19, 2026/);
 assert.match(prereg,/100 bicycles/);
 assert.match(en,/December 19, 2026/);
 assert.match(es,/19 de diciembre de 2026/);
 assert.match(migration,/'draft'/);
 assert.match(migration,/false, null, null/);
 assert.match(migration,/'minden_la_outreach'/);
 assert.doesNotMatch(migration,/insert\s+into\s+public\.outreach_campaign_assignments/i);
});
test('Minden decision desk is source and assignment scoped',()=>{
 assert.match(decisions,/public\.campaign_decision_foundation/);
 assert.doesNotMatch(decisions,/private\.outreach_registration_can\(/);
 assert.match(decisions,/source.source='minden_la_outreach'/);
 assert.match(decisions,/revoke all on function public\.outreach_minden_decisions/);
 assert.match(decisions,/to authenticated;/);
 const staff=read('assets/js/minden-decision-staff.js');
 assert.doesNotMatch(staff,/outreach_registration_workspace/);
 assert.match(staff,/outreach_minden_decisions/);
 assert.doesNotMatch(staff,/localStorage|sessionStorage|innerHTML/);
});
test('all public Minden routes are mapped',()=>{
 for(const route of ['/minden ','/minden/ ','/minden/es ','/minden/es/ ','/minden/register ','/minden/register/ '])assert.ok(routes.includes(route),route);
});

test('registration authority does not advertise decision follow-up access',()=>{
 const staff=read('assets/js/outreach-registration-staff.js');
 assert.doesNotMatch(staff,/href:'staff-minden-decisions.html'/);
 assert.doesNotMatch(staff,/window\.location\.replace\([^)]*minden/);
});

test('Minden event is listed exactly once and no unconfirmed giveaways appear',()=>{
 const outreach=read('outreach.html');
 assert.equal((outreach.match(/<h3>Minden, Louisiana<\/h3>/g)||[]).length,1);
 assert.match(outreach,/SATURDAY · DEC 19, 2026/);
 assert.match(outreach,/100 bicycles/);
 assert.match(outreach,/Victory Park/);
 assert.doesNotMatch(prereg,/free tablets|inflatables|prize guaranteed/i);
 assert.equal(config.registration.prize_choices.length,0);
 assert.equal(config.registration.enabled,false);
 assert.equal(config.waiver.status,'PENDING_APPROVED_LOUISIANA_TEXT');
});

test('public build includes the actual Minden visitor and assigned staff entry points only',()=>{
 const files=JSON.parse(read('tools/site-build/public-files.json'));
 for(const file of ['minden/index.html','minden/es/index.html','minden/register/index.html','staff-minden-decisions.html','assets/js/minden-decision-staff.js'])assert.ok(files.includes(file),file);
 assert.equal(files.filter(x=>/^(?:config|supabase|audit|tools)\//.test(x)).length,0);
 assert.match(pub,/'Venue: '/);
 assert.match(form,/Bicycle eligibility and giveaway procedures must be confirmed by the event team/);
});

test('new Minden pages reuse the accepted exact SDK/SRI dependency',()=>{for(const page of [en,es,prereg,read('staff-minden-decisions.html')]){assert.match(page,/@supabase\/supabase-js@2\.118\.0/);assert.ok(page.includes('integrity="sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp" crossorigin="anonymous"'));assert.doesNotMatch(page,/@supabase\/supabase-js@2"/);}});
