import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{JSDOM}from'jsdom';import{uiFixture}from'./fixtures/outreach-team-travel-ui.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),source=read('assets/js/outreach-team-travel.js');let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},tick=()=>new Promise(r=>setTimeout(r,10));
async function harness(){const fixture=uiFixture(),dom=new JSDOM(read('staff-outreach-team-travel.html'),{url:'https://staff.local.test/staff-outreach-team-travel.html',runScripts:'outside-only'}),w=dom.window,d=w.document;let user={id:'synthetic-owner',email:'synthetic-owner@example.test'},callback;w.ChampionLifeAuth={getUser:async()=>user,client:{rpc:fixture.rpc,auth:{onAuthStateChange:fn=>callback=fn}}};w.URL.createObjectURL=()=> 'blob:synthetic';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.print=()=>{};w.eval(source);await tick();const click=async text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'button '+text);b.click();await tick();};const form=title=>[...d.querySelectorAll('form')].find(f=>[...f.querySelectorAll('button')].some(b=>b.textContent===title));const submit=async title=>{form(title).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();};return{fixture,dom,w,d,click,form,submit,signout:()=>{user=null;callback('SIGNED_OUT',null)}};}
const h=await harness(),{fixture,w,d,click,form,submit}=h;
try{
 ok(d.body.textContent.includes('Team decisions'),'owner sees Team workspace');
 ok(!fixture.calls.some(x=>x.p.p_action==='enroll'),'matching public email never links automatically');
 await click('Review and link');ok(d.body.textContent.includes('<img src=x onerror=alert(1)> Alex, Sam')&&!d.querySelector('[onerror]'),'unverified passenger names render as text, never HTML');
 ok(d.body.textContent.includes('Not answered'),'unknown public answers remain unknown');
 let f=form('Search People');f.querySelector('[name=search]').value='Synthetic';await submit('Search People');
 ok(!fixture.calls.some(x=>x.p.p_action==='enroll'),'search results are hints, not identity proof');
 await click('=Synthetic Applicant · synthetic@example.test');f=form('Link verified Person');f.querySelector('[name=reason]').value='Synthetic independent identity verification';await submit('Link verified Person');
 ok(!fixture.calls.some(x=>x.p.p_action==='enroll'),'identity checkbox is required');
 f.querySelector('[name=verified]').checked=true;await submit('Link verified Person');const linked=fixture.calls.find(x=>x.p.p_action==='enroll');ok(linked.p.p_payload.application_id===fixture.ids.application&&linked.p.p_payload.person_id===fixture.ids.person,'explicit reviewed adapter uses exact application and chosen Person');
 await click('Review =Synthetic Applicant');ok(form('Save verified age').querySelector('[name=age]').value==='','age input is blank, never defaults to18');ok(form('Save availability review').querySelector('[name=availability]').value==='','availability requires an explicit decision');
 f=form('Save individual decision');f.querySelector('[name=status]').value='approved';f.querySelector('[name=reason]').value='Synthetic individual approval review';await submit('Save individual decision');
 ok(!fixture.calls.some(x=>x.p.p_action==='assignment_save'),'individual approval does not assign a vehicle');
 await click('Review =Synthetic Applicant');f=form('Save verified age');f.querySelector('[name=age]').value='34';f.querySelector('[name=reason]').value='Synthetic verified age for travel';await submit('Save verified age');
 await click('Review =Synthetic Applicant');f=form('Save availability review');f.querySelector('[name=availability]').value='true';f.querySelector('[name=reason]').value='Synthetic availability independently confirmed';await submit('Save availability review');
 await click('Vehicles & travel');ok(d.body.textContent.includes('Available passenger seats')&&d.body.textContent.includes('Total seats'),'capacity screen distinguishes total and passenger seats');
 ok(!fixture.calls.some(x=>x.p.p_action==='driver_review'),'RV self-report never creates a qualification review');
 f=form('Reserve seat');ok(f.querySelector('[name=member]').value===''&&f.querySelector('[name=role]').value==='','participant and seat role require explicit choices');
 for(const[k,v]of Object.entries({member:fixture.ids.member,leg:fixture.ids.leg,vehicle:fixture.ids.vehicle,role:'passenger'}))f.querySelector('[name='+k+']').value=v;await submit('Reserve seat');
 ok(fixture.members[0].status==='approved'&&d.body.textContent.includes('passenger · assigned'),'reservation is shown separately from approval');
 ok(!fixture.calls.some(x=>x.p.p_action==='assignment_confirm'),'reserving a seat never confirms itinerary');
 await click('Reassign / cancel');f=form('Save assignment change');ok(f.querySelector('[name=action]').value==='','cancellation/reassignment requires explicit action');
 await click('Manifests');await click('Download scoped CSV');ok(!fixture.calls.some(x=>x.p.p_action==='csv'),'manifest export requires explicit travel leg');
 f=form('View manifest');f.querySelector('[name=leg]').value=fixture.ids.leg;await submit('View manifest');ok(d.body.textContent.includes('Times unconfirmed'),'unknown itinerary remains unconfirmed in manifest');
 await click('Print scoped manifest');ok(fixture.calls.some(x=>x.p.p_action==='csv'&&x.p.p_payload.leg_id===fixture.ids.leg),'printing requires scoped audited export authorization');
 ok(d.querySelector('[data-print-manifest]')?.textContent.includes('Unconfirmed / review required'),'printed manifest keeps uncertainty explicit');
 fixture.deny();w.dispatchEvent(new w.Event('focus'));await tick();ok(d.body.textContent.includes('Outreach access unavailable')&&!d.body.textContent.includes('=Synthetic Applicant'),'current permission denial clears protected records');
}finally{h.dom.window.close()}
const late=await harness();try{await late.click('Manifests');const f=late.form('View manifest');f.querySelector('[name=leg]').value=late.fixture.ids.leg;const held=late.fixture.holdManifest();f.dispatchEvent(new late.w.Event('submit',{bubbles:true,cancelable:true}));await tick();late.signout();await tick();held.resolve();await tick();ok(late.d.body.textContent.includes('Outreach access unavailable')&&!late.d.querySelector('.team-table'),'late manifest response cannot restore signed-out workspace');}finally{late.dom.window.close()}
ok(!source.includes('innerHTML')&&!source.includes('service_role'),'no HTML interpolation or service-role client path');
console.log(n+' Team/travel DOM/security checks passed (controlled synthetic RPC responses)');
