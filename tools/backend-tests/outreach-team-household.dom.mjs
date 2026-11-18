// Synthetic canonical Household/UI fixtures only. No provider/database/account action.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {uiFixture} from './fixtures/outreach-team-travel-ui.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),source=read('assets/js/outreach-team-travel.js');
const hh='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',adultPerson='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',adultMember='cccccccc-cccc-4ccc-8ccc-cccccccccccc';let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},tick=()=>new Promise(r=>setTimeout(r,12));
async function harness({permissions=['people.read','households.read','households.manage'],department=null,otherOrg=false,households=[],memberships=[],errorTable=null,errorCode='P0001',readErrorTable=null,networkTable=null,malformedTable=null,contextError=false,fullSearch=false}={}){
 const fixture=uiFixture(),org=fixture.ids.org,minor={id:fixture.ids.member,person_id:fixture.ids.person,application_id:fixture.ids.application,first_name:'Reviewed',last_name:'Minor',age:12,status:'approved',source_application_status:'pending',revision:1},adult={id:adultMember,person_id:adultPerson,application_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',first_name:'Reviewed',last_name:'Adult',age:40,status:'approved',source_application_status:'pending',revision:1};fixture.members.push(minor,adult);
 const dom=new JSDOM(read('staff-outreach-team-travel.html'),{url:'https://staff.local.test/staff-outreach-team-travel.html?campaign='+fixture.ids.campaign,runScripts:'outside-only'}),w=dom.window,d=w.document,calls={queries:[],writes:[],contexts:0};
 let user={id:'synthetic-owner',email:'owner@example.test'},callback,keys=permissions,houses=structuredClone(households),links=structuredClone(memberships),hold=null,finish,memberCount=1;
 const people=[{id:minor.person_id,organization_id:org,first_name:minor.first_name,last_name:minor.last_name},{id:adultPerson,organization_id:org,first_name:adult.first_name,last_name:adult.last_name}];
 const house=()=>({id:hh,organization_id:org,name:'Reviewed synthetic household',status:'active',revision:1});
 const scope=()=>({organizations:[{id:org}],grants:keys.map(permission=>({organization_id:otherOrg?'other-org':org,permission,department_ids:department}))});
 function builder(table){
  const q={table,mode:'read',filters:[],projection:null,limit:null,single:false,payload:null};let promise;
  const execute=async()=>{
   calls.queries.push(structuredClone(q));if(q.mode==='insert')calls.writes.push(structuredClone(q));
   const run=()=>{
    if(networkTable===table&&q.mode==='insert')throw Error('PRIVATE NETWORK SECRET');
    if(errorTable===table&&q.mode==='insert')return{error:{code:errorCode,message:'PRIVATE PROVIDER SECRET'}};
    if(readErrorTable===table&&q.mode==='read')return{error:{code:'42501',message:'PRIVATE RLS SECRET'}};
    if(malformedTable===table&&q.mode==='read')return{data:[{organization_id:'wrong-org',id:hh,name:'PRIVATE MALFORMED',status:'active',revision:1}]};
    if(q.mode==='insert'){
     if(table==='households'){const row={...house(),...q.payload};houses.push(row);return{data:structuredClone(row)}}
     assert.equal(table,'household_members');const row={id:'eeeeeeee-eeee-4eee-8eee-'+String(memberCount++).padStart(12,'0'),active:true,revision:1,...q.payload};links.push(row);return{data:structuredClone(row)};
    }
    let rows=structuredClone(table==='households'?houses:table==='household_members'?links:people);
    if(fullSearch&&table==='households'&&!q.single)rows=Array.from({length:26},(_,i)=>({...house(),name:'Reviewed household '+i}));
    for(const[k,v,op]of q.filters){if(op==='in')rows=rows.filter(r=>v.includes(r[k]));else if(op==='like')rows=rows.filter(r=>String(r[k]).toLowerCase().includes(v.replaceAll('%','').toLowerCase()));else rows=rows.filter(r=>r[k]===v)}
    if(q.limit)rows=rows.slice(0,q.limit);return{data:q.single?(rows[0]||null):rows};
   };
   if(hold&&hold.table===table&&hold.mode===q.mode){hold=null;return new Promise((resolve,reject)=>finish=()=>{try{resolve(run())}catch(e){reject(e)}})}return run();
  };
  const b={select:v=>{q.projection=v;return b},eq:(k,v)=>{q.filters.push([k,v,'eq']);return b},in:(k,v)=>{q.filters.push([k,v,'in']);return b},ilike:(k,v)=>{q.filters.push([k,v,'like']);return b},order:()=>b,limit:v=>{q.limit=v;return b},insert:payload=>{q.mode='insert';q.payload=structuredClone(payload);return b},single:()=>{q.single=true;return b},maybeSingle:()=>{q.single=true;return b},then:(resolve,reject)=>{promise??=execute();return promise.then(resolve,reject)}};return b;
 }
 w.ChampionLifeAuth={getUser:async()=>user,client:{from:builder,auth:{onAuthStateChange:fn=>callback=fn},rpc:async(name,p)=>{
  if(name==='staff_workspace_context'){calls.contexts++;return contextError?{error:{code:'P0001',message:'PRIVATE CONTEXT SECRET'}}:{data:scope()}}
  if(name==='outreach_team_workspace'&&p.p_action==='guardian_options'){
   fixture.calls.push({name,p:structuredClone(p)});return{data:houses.filter(h=>h.status==='active'&&[minor.person_id,adultPerson].every(id=>links.some(r=>r.household_id===h.id&&r.person_id===id&&r.active))).map(h=>({guardian_member_id:adultMember,household_id:h.id,household_name:h.name,first_name:adult.first_name,last_name:adult.last_name}))};
  }
  return fixture.rpc(name,p);
 }}};
 w.eval(source);await tick();
 const button=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text),form=title=>[...d.querySelectorAll('form')].find(f=>[...f.querySelectorAll('button')].some(b=>b.textContent===title));
 const click=async text=>{const b=button(text);assert.ok(b,'button '+text);b.click();await tick()},submit=async title=>{const f=form(title);assert.ok(f,'form '+title);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick()};
 await click('Review Reviewed Minor');
 const open=()=>click('Review Canonical Household Setup'),setSearch=value=>{const i=form('Search Canonical Households').querySelector('[name=household_search]');i.value=value;i.dispatchEvent(new w.Event('input',{bubbles:true}))},search=async(value='Reviewed')=>{setSearch(value);await submit('Search Canonical Households')};
 const choose=async()=>{await search();const b=[...d.querySelectorAll('button')].find(b=>b.textContent.startsWith('Review Household: '));assert.ok(b);b.click();await tick()};
 const fillMembership=(person=minor.person_id,relationship='child',checked=true)=>{const f=form('Add Reviewed Household Membership');f.querySelector('[name=household_person]').value=person;f.querySelector('[name=household_relationship]').value=relationship;f.querySelector('[name=membership_reviewed]').checked=checked;return f};
 return{fixture,org,minor,adult,dom,w,d,calls,house,open,search,setSearch,choose,button,form,click,submit,fillMembership,setPermissions:v=>keys=v,get houses(){return houses},get links(){return links},hold:(table,mode='read')=>hold={table,mode},finish:async()=>{finish();await tick();await tick()},signout:async()=>{user=null;callback('SIGNED_OUT',null);await tick()},switchAccount:async()=>{user={id:'other-synthetic',email:'other@example.test'};callback('SIGNED_IN',{user});await tick()},expire:()=>user=null,close:()=>w.close()};
}
{
 const h=await harness();try{
  ok(Boolean(h.button('Review Canonical Household Setup')),'current exact global People/Household scopes expose minor setup');await h.open();
  ok(!h.button('Create a Separate Household After Match Review'),'no Household creation before explicit search');
  await h.search();await h.click('Create a Separate Household After Match Review');let f=h.form('Create Reviewed Household');
  ok(f.querySelector('[name=household_name]').value===''&&f.querySelector('[name=household_name]').maxLength===150,'new Household name is blank and bounded, never inferred from minor/application');
  ok([...f.querySelectorAll('input')].every(i=>h.d.querySelector('label[for="'+i.id+'"]')),'Household creation fields have explicit labels');
  f.querySelector('[name=household_name]').value='Reviewed synthetic household';await h.submit('Create Reviewed Household');ok(h.calls.writes.length===0,'Household possible-match review checkbox required');
  f.querySelector('[name=household_matches_reviewed]').checked=true;const hidden=h.d.createElement('input');hidden.type='hidden';hidden.name='status';hidden.value='archived';f.append(hidden);await h.submit('Create Reviewed Household');
  assert.deepEqual(Object.keys(h.calls.writes[0].payload).sort(),['name','organization_id']);ok(true,'Household insert has only approved organization/name columns');
  ok(h.links.length===0&&h.d.body.textContent.includes('No memberships or guardian authority were added.'),'Household creation adds no implicit members or guardian authority');
  await h.click('Review Created Household');f=h.form('Add Reviewed Household Membership');
  ok(f.querySelector('[name=household_person]').value===''&&f.querySelector('[name=household_relationship]').value==='','membership requires explicit Person and factual-label selections');
  h.fillMembership(undefined,undefined,false);await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===1,'membership review checkbox required before protected insert');
  h.fillMembership();await h.submit('Add Reviewed Household Membership');
  assert.deepEqual(Object.keys(h.calls.writes[1].payload).sort(),['household_id','organization_id','person_id','relationship']);ok(true,'membership insert has only the four protected columns, no active/archive/identity override');
  ok(h.links.length===1&&h.links[0].person_id===h.minor.person_id&&h.links[0].relationship==='child','one explicit submit creates only selected minor membership');
  h.fillMembership(adultPerson,'adult');await h.submit('Add Reviewed Household Membership');
  ok(h.links.length===2&&!h.fixture.calls.some(x=>x.p.p_action==='guardian_review'),'shared memberships never infer legal guardian authority');
  ok(!h.calls.writes.some(q=>q.table==='organization_people')&&!h.calls.queries.some(q=>q.mode==='update'||q.mode==='upsert'),'setup never creates/merges People or updates prior records');
  await h.click('Return to Guardian Authority Review');f=h.form('Save Verified Guardian Authority');ok(Boolean(f),'return refreshes existing separate guardian authority form');
  ok(!h.fixture.calls.some(x=>x.p.p_action==='guardian_review'),'returning/selecting facts still does not submit guardian review');
  f.querySelector('[name=guardian]').value='0';f.querySelector('[name=reason]').value='Synthetic explicit legal guardian authority review';await h.submit('Save Verified Guardian Authority');
  const legal=h.fixture.calls.find(x=>x.p.p_action==='guardian_review');ok(legal?.p.p_payload.guardian_member_id===adultMember&&legal.p.p_payload.household_id===hh&&legal.p.p_payload.reason.includes('explicit legal'),'only separate explicit reason command records guardian authority');
  ok(h.calls.queries.every(q=>q.mode==='insert'||q.filters.some(([k,v])=>k==='organization_id'&&v===h.org)),'every canonical table read is bound to exact current organization');
 }finally{h.close()}
}
for(const options of[{permissions:['people.read','households.read']},{permissions:['households.read','households.manage']},{permissions:['people.read','households.manage']},{department:[]},{department:['some-department']},{otherOrg:true},{contextError:true}]){
 const h=await harness(options);try{ok(!h.button('Review Canonical Household Setup')&&h.calls.queries.length===0,'partial/scoped/other-org/error context cannot expose Household setup');ok(!/PRIVATE|SECRET/.test(h.d.body.textContent),'context failures do not reveal provider details')}finally{h.close()}
}
{
 const h=await harness();try{await h.open();await h.search();h.setPermissions(['people.read','households.read']);await h.click('Create a Separate Household After Match Review');ok(!h.form('Create Reviewed Household')&&h.calls.writes.length===0&&h.d.body.textContent.includes('Outreach Access Unavailable'),'permission revoked before form denies and clears setup')}finally{h.close()}
}
{
 const h=await harness();try{await h.open();h.expire();await h.search();ok(h.calls.queries.length===0&&h.d.body.textContent.includes('Outreach Access Unavailable'),'expired current session denies Household reads despite earlier context')}finally{h.close()}
}
for(const table of['households','household_members','organization_people']){
 const h=await harness({households:[{id:hh,organization_id:'22222222-2222-4222-8222-222222222222',name:'Reviewed household',status:'active',revision:1}],memberships:table==='organization_people'?[{id:hh,organization_id:'22222222-2222-4222-8222-222222222222',household_id:hh,person_id:adultPerson,relationship:'adult',active:true,revision:1}]:[],malformedTable:table});
 try{await h.open();if(table==='households')await h.search();else await h.choose();ok(!h.form('Add Reviewed Household Membership')&&h.calls.writes.length===0,'malformed/cross-org '+table+' response cannot enable writes');ok(!h.d.querySelector('[onerror]'),'malformed source never creates executable markup')}finally{h.close()}
}
{
 const h=await harness({households:[{id:hh,organization_id:'22222222-2222-4222-8222-222222222222',name:'Reviewed archived',status:'archived',revision:1}]});try{await h.open();await h.choose();ok(!h.form('Add Reviewed Household Membership')&&h.houses[0].status==='archived'&&h.calls.writes.length===0,'archived Household remains unchanged with no membership mutation controls')}finally{h.close()}
}
{
 const h=await harness({households:[{id:hh,organization_id:'22222222-2222-4222-8222-222222222222',name:'Reviewed existing',status:'active',revision:1}],memberships:[{id:hh,organization_id:'22222222-2222-4222-8222-222222222222',household_id:hh,person_id:'44444444-4444-4444-8444-444444444444',relationship:'other',active:false,revision:4}]});try{await h.open();await h.choose();const options=[...h.form('Add Reviewed Household Membership').querySelector('[name=household_person]').options];ok(!options.some(o=>o.value===h.minor.person_id)&&h.links[0].relationship==='other'&&!h.links[0].active&&h.links[0].revision===4,'existing inactive membership is retained and excluded from duplicate/relabel/reactivation');ok(h.d.body.textContent.includes('Inactive — Retained Unchanged'),'existing inactive state is explicit to reviewer')}finally{h.close()}
}
for(const change of['search','signout','switchAccount','navigate']){
 const h=await harness();try{await h.open();h.hold('households');await h.search();if(change==='search')h.setSearch('Different Household');else if(change==='navigate')await h.click('Vehicles & Travel');else await h[change]();await h.finish();ok(!h.button('Create a Separate Household After Match Review')&&h.calls.writes.length===0,'late search response cannot revive stale Household scope: '+change)}finally{h.close()}
}
for(const options of[{errorTable:'households'},{networkTable:'households'}]){
 const h=await harness(options);try{await h.open();await h.search();await h.click('Create a Separate Household After Match Review');const f=h.form('Create Reviewed Household');f.querySelector('[name=household_name]').value='Reviewed uncertain';f.querySelector('[name=household_matches_reviewed]').checked=true;await h.submit('Create Reviewed Household');f.dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await tick();ok(h.calls.writes.length===1&&!h.form('Create Reviewed Household')&&!h.button('Review Created Household'),'ambiguous Household write consumes review and never automatically retries');ok(!/PRIVATE|SECRET/.test(h.d.body.textContent)&&h.d.body.textContent.includes('Search and review again'),'Household write failure is redacted and requires fresh review')}finally{h.close()}
}
{
 const h=await harness({fullSearch:true});try{await h.open();await h.search();ok(!h.button('Create a Separate Household After Match Review'),'full26-match Household search requires refinement before new record')}finally{h.close()}
}
for(const label of['','x'.repeat(151),'Bad\u0000name']){
 const h=await harness();try{await h.open();await h.search();await h.click('Create a Separate Household After Match Review');const f=h.form('Create Reviewed Household');f.querySelector('[name=household_name]').value=label;f.querySelector('[name=household_matches_reviewed]').checked=true;await h.submit('Create Reviewed Household');ok(h.calls.writes.length===0,'empty/oversized/control Household name cannot be inserted')}finally{h.close()}
}
const existingHouse={id:hh,organization_id:'22222222-2222-4222-8222-222222222222',name:'Reviewed existing',status:'active',revision:1};
for(const drift of['archived','revision']){
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();h.fillMembership();if(drift==='archived')h.houses[0].status='archived';h.houses[0].revision++;await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===0&&h.d.body.textContent.includes('Household changed'),'current Household '+drift+' drift refuses membership rather than changing existing state')}finally{h.close()}
}
{
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();h.fillMembership();h.links.push({id:hh,organization_id:h.org,household_id:hh,person_id:h.minor.person_id,relationship:'other',active:false,revision:7});await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===0&&h.links[0].relationship==='other'&&!h.links[0].active&&h.links[0].revision===7,'membership created by another reviewer is retained without upsert/relabel/reactivation')}finally{h.close()}
}
{
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();h.fillMembership();h.links.push({organization_id:h.org,household_id:hh,person_id:h.minor.person_id,relationship:'legal_guardian',active:true});await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===0&&h.d.body.textContent.includes('Existing membership could not be confirmed'),'malformed preflight membership does not become a factual or legal success claim')}finally{h.close()}
}
{
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();h.fillMembership();h.setPermissions(['people.read','households.read']);await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===0&&h.d.body.textContent.includes('Outreach Access Unavailable'),'current manage revocation blocks membership before the protected write')}finally{h.close()}
}
for(const change of['search','signout','switchAccount','navigate','permission']){
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();h.fillMembership();h.hold('household_members','insert');const f=h.form('Add Reviewed Household Membership');await h.submit('Add Reviewed Household Membership');f.dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await tick();if(change==='search')h.setSearch('Different selection');else if(change==='navigate')await h.click('Vehicles & Travel');else if(change==='permission')h.setPermissions(['people.read','households.read']);else await h[change]();await h.finish();ok(h.calls.writes.length===1,'pending membership cannot be duplicated by double submission: '+change);ok(!h.d.body.textContent.includes('One membership saved.')&&!h.fixture.calls.some(x=>x.p.p_action==='guardian_review'),'late membership result cannot claim success or legal authority after '+change)}finally{h.close()}
}
for(const options of[{errorTable:'household_members'},{networkTable:'household_members'},{errorTable:'household_members',errorCode:'23514'},{errorTable:'household_members',errorCode:'42501'}]){
 const h=await harness({households:[existingHouse],...options});try{await h.open();await h.choose();h.fillMembership();await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===1&&!h.form('Add Reviewed Household Membership'),'failed/ambiguous membership request consumes review with no blind retry');ok(!/PRIVATE|SECRET/.test(h.d.body.textContent)&&!h.fixture.calls.some(x=>x.p.p_action==='guardian_review'),'membership failure is redacted and never grants legal authority');ok(h.houses[0].status==='active'&&h.houses[0].revision===1,'membership failure does not archive/restore/rename the existing Household')}finally{h.close()}
}
{
 const h=await harness({readErrorTable:'households'});try{await h.open();await h.search();ok(h.d.body.textContent.includes('Outreach Access Unavailable')&&!/PRIVATE|SECRET/.test(h.d.body.textContent)&&h.calls.writes.length===0,'authoritative table RLS denial clears scope despite an earlier allowed context')}finally{h.close()}
}
for(const inject of['person','relationship']){
 const h=await harness({households:[existingHouse]});try{await h.open();await h.choose();const f=h.fillMembership(),select=f.querySelector(inject==='person'?'[name=household_person]':'[name=household_relationship]'),o=h.d.createElement('option');o.value=inject==='person'?'ffffffff-ffff-4fff-8fff-ffffffffffff':'legal_guardian';o.textContent='Injected unreviewed value';select.append(o);select.value=o.value;await h.submit('Add Reviewed Household Membership');ok(h.calls.writes.length===0,'injected unreviewed '+inject+' is never accepted as factual membership or authority')}finally{h.close()}
}
console.log(n+' canonical Household setup DOM/security checks passed (synthetic protected API responses only)');
