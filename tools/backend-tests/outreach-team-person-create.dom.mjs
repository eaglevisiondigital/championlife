// Controlled canonical-Person creation UI only; no provider/account/database write.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {uiFixture} from './fixtures/outreach-team-travel-ui.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),source=read('assets/js/outreach-team-travel.js'),created='99999999-9999-4999-8999-999999999999';let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},tick=()=>new Promise(r=>setTimeout(r,10));
async function harness({permissions=['people.read','people.create'],rows=[],department=null,otherOrg=false,grantOtherOrg=false,error=null,networkError=false,malformed=false,linked=false,contextError=null,searchError=null}={}){
 const fixture=uiFixture(),dom=new JSDOM(read('staff-outreach-team-travel.html'),{url:'https://staff.local.test/staff-outreach-team-travel.html?campaign='+fixture.ids.campaign,runScripts:'outside-only'}),w=dom.window,d=w.document,calls={inserts:[],selects:[],contexts:0,searches:[]};
 let user={id:'synthetic-owner',email:'owner@example.test'},callback,keys=permissions,people=rows,holdInsert=false,finishInsert,holdContext=false,finishContext,currentError=error;
 if(linked)fixture.members.push({id:fixture.ids.member,application_id:fixture.ids.application,person_id:fixture.ids.person,first_name:'Already',last_name:'Reviewed',status:'applied',source_application_status:'pending'});
 const staff=()=>({organizations:[{id:otherOrg?'other-org':fixture.ids.org}],grants:keys.map(permission=>({organization_id:otherOrg||grantOtherOrg?'other-org':fixture.ids.org,permission,department_ids:department}))});
 w.ChampionLifeAuth={getUser:async()=>user,client:{auth:{onAuthStateChange:fn=>callback=fn},rpc:async(name,p)=>{
  if(name==='staff_workspace_context'){calls.contexts++;if(contextError)return{error:contextError};if(holdContext){holdContext=false;return new Promise(r=>finishContext=()=>r({data:staff()}))}return{data:staff()}}
  if(name==='people_workspace'){calls.searches.push(p);return searchError?{error:searchError}:{data:JSON.parse(JSON.stringify(people))}}
  return fixture.rpc(name,p);
 },from:table=>{assert.equal(table,'organization_people');return{insert:payload=>{calls.inserts.push(JSON.parse(JSON.stringify(payload)));return{select:projection=>{calls.selects.push(projection);return{single:async()=>{
  if(networkError)throw Error('PRIVATE NETWORK SECRET');
  const result=()=>currentError?{error:currentError,status:currentError.status}:{data:{...payload,id:created,organization_id:malformed?'other-org':payload.organization_id}};
  if(holdInsert){holdInsert=false;return new Promise(r=>finishInsert=()=>r(result()))}return result();
 }}}}}}}}};
 w.eval(source);await tick();
 const button=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text),form=title=>[...d.querySelectorAll('form')].find(f=>[...f.querySelectorAll('button')].some(b=>b.textContent===title));
 const click=async text=>{const b=button(text);assert.ok(b,'button '+text);b.click();await tick()},submit=async title=>{const f=form(title);assert.ok(f,'form '+title);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick()};
 const searchValue=value=>{const i=form('Search People').querySelector('[name=search]');i.value=value;i.dispatchEvent(new w.Event('input',{bubbles:true}))};
 const search=async(value='Synthetic applicant')=>{searchValue(value);await submit('Search People')};
 const prepare=async()=>{await search();await click('Create a new Person after match review')};
 const fill=({first_name='Reviewed',last_name='Synthetic',email='reviewed@example.test',phone='+1 555 0100',checked=true}={})=>{const f=form('Create canonical Person');for(const[k,v]of Object.entries({first_name,last_name,email,phone}))f.querySelector('[name='+k+']').value=v;f.querySelector('[name=matches_reviewed]').checked=checked;return f};
 await click(linked?'View application':'Review and link');
 return{fixture,dom,w,d,calls,button,form,click,submit,search,searchValue,prepare,fill,setPermissions:v=>keys=v,setRows:v=>people=v,holdInsert:()=>holdInsert=true,finishInsert:async()=>{finishInsert();await tick();await tick()},holdContext:()=>holdContext=true,finishContext:async()=>{finishContext();await tick()},signout:async()=>{user=null;callback('SIGNED_OUT',null);await tick()},switchAccount:async()=>{user={id:'other-synthetic',email:'other@example.test'};callback('SIGNED_IN',{user});await tick()},expireSession:()=>user=null,close:()=>w.close()};
}
{
 const h=await harness();try{
  ok(!h.button('Create a new Person after match review')&&!h.form('Create canonical Person'),'creation is unavailable until explicit successful match search');
  await h.prepare();let f=h.form('Create canonical Person');
  ok([...f.querySelectorAll('input:not([type=checkbox])')].every(i=>i.value===''),'public application answers never prefill canonical Person fields');
  ok([...f.querySelectorAll('input')].every(i=>h.d.querySelector('label[for="'+i.id+'"]')),'every creation control has an explicit label');
  ok(f.querySelector('[name=first_name]').maxLength===100&&f.querySelector('[name=last_name]').maxLength===100&&f.querySelector('[name=email]').maxLength===320&&f.querySelector('[name=phone]').maxLength===40,'creation fields use existing canonical bounds');
  h.fill({checked:false});await h.submit('Create canonical Person');ok(h.calls.inserts.length===0,'possible-match review checkbox is required before insert');
  f=h.fill();for(const key of['user_id','human_id','id','grants','auth_role']){const i=h.d.createElement('input');i.type='hidden';i.name=key;i.value='injected';f.append(i)}
  await h.submit('Create canonical Person');
  ok(h.calls.inserts.length===1,'explicit reviewed submit makes one protected Person insert');
  assert.deepEqual(Object.keys(h.calls.inserts[0]).sort(),['email','first_name','last_name','organization_id','phone']);ok(true,'insert sends only the five approved contact columns, ignoring injected identity/authority fields');
  ok(h.calls.inserts[0].organization_id===h.fixture.ids.org&&h.calls.inserts[0].email==='reviewed@example.test','insert uses exact campaign organization and reviewed contact values');
  ok(h.calls.selects[0]==='id,organization_id,first_name,last_name,email,phone','return projection excludes Auth/human/permission fields');
  ok(h.d.body.textContent.includes('Person saved. This application is still unlinked.')&&!h.fixture.calls.some(x=>x.p.p_action==='enroll'),'creation does not automatically link or approve the application');
  ok(!h.form('Link verified Person'),'creation does not silently open or accept verified linking');
  await h.click('Review created Person for linking');ok(Boolean(h.form('Link verified Person'))&&!h.fixture.calls.some(x=>x.p.p_action==='enroll'),'separate review opens existing identity confirmation without linking');
  f=h.form('Link verified Person');f.querySelector('[name=reason]').value='Synthetic independent identity review';await h.submit('Link verified Person');ok(!h.fixture.calls.some(x=>x.p.p_action==='enroll'),'existing independent identity checkbox remains required');
  f.querySelector('[name=verified]').checked=true;await h.submit('Link verified Person');const linked=h.fixture.calls.find(x=>x.p.p_action==='enroll');ok(linked?.p.p_payload.person_id===created&&linked.p.p_payload.application_id===h.fixture.ids.application,'separate explicit linking uses returned canonical Person and exact application');
 }finally{h.close()}
}
for(const options of[{permissions:['people.read']},{permissions:['people.create']},{permissions:[]},{department:['synthetic-dept']},{department:[]},{otherOrg:true},{grantOtherOrg:true}]){
 const h=await harness(options);try{await h.search();ok(!h.button('Create a new Person after match review')&&!h.form('Create canonical Person'),'missing/scoped/cross-organization grants never expose creation');ok(h.calls.inserts.length===0,'denied presentation cannot issue an insert')}finally{h.close()}
}
{
 const h=await harness({linked:true});try{ok(!h.form('Search People')&&!h.form('Create canonical Person')&&h.calls.contexts===0,'already-linked application does not expose another Person creation path')}finally{h.close()}
}
{
 const h=await harness();try{await h.prepare();h.fill();h.setPermissions(['people.read']);await h.submit('Create canonical Person');ok(h.calls.inserts.length===0&&h.d.body.textContent.includes('Outreach access unavailable'),'revoked create permission rechecked immediately before insert');ok(!h.d.body.textContent.includes('Fictional fixture only'),'revocation clears protected application content')}finally{h.close()}
}
{
 const h=await harness();try{await h.prepare();h.fill();h.expireSession();await h.submit('Create canonical Person');ok(h.calls.inserts.length===0&&h.d.body.textContent.includes('Outreach access unavailable'),'expired current session denies creation despite earlier context')}finally{h.close()}
}
for(const change of['signout','switchAccount','search','navigate']){
 const h=await harness();try{await h.prepare();h.fill();h.holdInsert();await h.submit('Create canonical Person');if(change==='search')h.searchValue('Different query');else if(change==='navigate')await h.click('Vehicles & travel');else await h[change]();await h.finishInsert();ok(!h.button('Review created Person for linking')&&!h.d.body.textContent.includes('Person saved.'),'late insert response cannot restore stale identity review: '+change);ok(!h.fixture.calls.some(x=>x.p.p_action==='enroll'),'late insert never links an application: '+change)}finally{h.close()}
}
{
 const h=await harness();try{h.holdContext();await h.search();h.searchValue('New search while permission check waits');await h.finishContext();ok(!h.button('Create a new Person after match review'),'late permission response cannot expose creation for a changed search')}finally{h.close()}
}
{
 const h=await harness();try{await h.search();h.holdContext();await h.click('Create a new Person after match review');h.searchValue('Changed while opening form');await h.finishContext();ok(!h.form('Create canonical Person'),'late prepare-form permission response cannot revive stale match review')}finally{h.close()}
}
{
 const h=await harness();try{await h.prepare();h.fill();h.holdContext();await h.submit('Create canonical Person');h.searchValue('Changed while checking write permission');await h.finishContext();ok(h.calls.inserts.length===0,'changed match search during final permission check causes no insert')}finally{h.close()}
}
for(const options of[{contextError:{code:'P0001',message:'PRIVATE CONTEXT SECRET'}},{searchError:{code:'P0001',message:'PRIVATE SEARCH SECRET'}},{rows:null}]){
 const h=await harness(options);try{await h.search();ok(!h.button('Create a new Person after match review')&&h.calls.inserts.length===0,'failed/malformed match or permission check exposes no create path');ok(!/PRIVATE|SECRET|TypeError/.test(h.d.body.textContent),'match/context failures do not disclose raw provider details')}finally{h.close()}
}
{
 const h=await harness();try{await h.prepare();h.fill();h.holdInsert();await h.submit('Create canonical Person');h.setPermissions(['people.read']);await h.finishInsert();ok(h.d.body.textContent.includes('Outreach access unavailable')&&!h.button('Review created Person for linking'),'post-insert permission recheck withholds success/linking after revocation')}finally{h.close()}
}
for(const options of[{error:{code:'42501',message:'PRIVATE DENIAL'}},{error:{code:'P0001',message:'PRIVATE PROVIDER SECRET'}},{error:{code:'23505',message:'PRIVATE DUPLICATE SECRET'}},{networkError:true},{malformed:true}]){
 const h=await harness(options);try{await h.prepare();h.fill();const f=h.form('Create canonical Person');h.holdInsert();await h.submit('Create canonical Person');f.dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await tick();if(!options.networkError)await h.finishInsert();
  ok(h.calls.inserts.length===1,'double-submit/failure cannot issue an automatic duplicate insert');ok(!/PRIVATE|SECRET/.test(h.d.body.textContent),'insert/provider failures never disclose raw details');ok(!h.button('Review created Person for linking')&&!h.form('Create canonical Person'),'failed/ambiguous result offers no linking or blind retry');ok(!h.d.body.textContent.includes('Saving the reviewed Person'),'failed request does not leave a false pending/success claim');
 }finally{h.close()}
}
for(const values of[{first_name:'x'.repeat(101)},{last_name:'x'.repeat(101)},{email:'x'.repeat(310)+'@example.test'},{phone:'x'.repeat(41)},{first_name:'   '},{email:'not-an-email'},{phone:'123\u0000secret'}]){
 const h=await harness();try{await h.prepare();h.fill(values);await h.submit('Create canonical Person');ok(h.calls.inserts.length===0,'invalid/oversized reviewed fields cause no insert')}finally{h.close()}
}
{
 const h=await harness({rows:Array.from({length:26},(_,i)=>({id:'synthetic-'+i,first_name:'Possible',last_name:'Match',email:null}))});try{await h.search();ok(!h.button('Create a new Person after match review')&&h.d.body.textContent.includes('Refine the search'),'full possible-match page requires narrower search before creation')}finally{h.close()}
}
{
 const h=await harness();try{await h.prepare();h.fill({first_name:'<img src=x onerror=alert(1)>',email:'',phone:''});await h.submit('Create canonical Person');ok(!h.d.querySelector('[onerror]')&&h.d.body.textContent.includes('<img src=x onerror=alert(1)>'),'created contact names remain text rather than HTML');ok(h.calls.inserts[0].email===null&&h.calls.inserts[0].phone===null,'blank optional contacts stay null, never guessed from application')}finally{h.close()}
}
ok(!source.includes('innerHTML')&&!source.includes('service_role'),'new path retains text rendering and has no service authority');
console.log(n+' canonical Person creation DOM/security checks passed (synthetic context/insert responses only)');
