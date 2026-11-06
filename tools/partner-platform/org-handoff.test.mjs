// Existing financial intake UI and existing RPC contract; isolated synthetic identities only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../backend-tests/node_modules/jsdom/lib/api.js';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',C='10000000-0000-4000-8000-000000000003';
const runtime=readFileSync(process.env.PARTNER_SOURCE||new URL('../../assets/js/staff-outreach-partners.js',import.meta.url),'utf8');
const common=readFileSync(new URL('../../assets/js/outreach-staff-common.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
async function fixture(query='',permissions={A:['outreach.view','finance.read','outreach.manage'],B:['outreach.view','finance.read','outreach.manage']}){
 const dom=new JSDOM('<main class="partner-workspace"><div id="outreach-intakes"></div></main>',{url:'https://fixture.invalid/staff-outreach-partners.html'+query,runScripts:'outside-only'}),w=dom.window,calls=[],listeners=[];
 let current={id:'fictional-a'},hold=null;
 const context=()=>({organizations:[{id:A,name:'Organization A'},{id:B,name:'Organization B'}],grants:Object.entries(permissions).flatMap(([key,values])=>values.map(permission=>({organization_id:key==='A'?A:B,permission,department_ids:null})))});
 w.ChampionLifeAuth={getUser:async()=>current,getSession:async()=>current?{user:current}:null,client:{auth:{onAuthStateChange:f=>listeners.push(f)},rpc:async(name,p)=>{
  calls.push({name,...p});if(name==='staff_workspace_context')return{data:context()};
  if(hold)return hold(name,p);
  const label=p.p_org===A?'A':'B';return{data:p.p_action==='list'?[{id:label,first_name:'Fictional '+label,last_name:'Intake',email:label+'@example.test',phone:'5555550100',source_site:'sowgo',submitted_at:'2026-01-01',status:'new',commitment_amount:1,commitment_frequency:'Monthly'}]:{id:label,status:'new',revision:1,raw_submission:{'first-name':'Fictional '+label},history:[]}};
 }}};
 w.eval(common);w.eval(runtime);await tick();
 return{w,calls,permissions,hold:f=>hold=f,switch:async id=>{current=id?{id}:null;listeners.forEach(f=>f(id?'SIGNED_IN':'SIGNED_OUT',current?{user:current}:null));await tick()},close:()=>dom.window.close()};
}
const intakeCalls=f=>f.calls.filter(c=>c.name==='outreach_partner_workspace');
const click=async(f,label)=>{const b=[...f.w.document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);b.click();await tick();return b};
if(process.env.EXPECT_ORIGINAL_FAILURE==='1'){
 test('original authorized B handoff reads and reviews first organization A instead',async()=>{const f=await fixture('?org='+B);try{assert.equal(intakeCalls(f)[0].p_org,A);assert.match(f.w.document.body.textContent,/Fictional A Intake/);await click(f,'Review intake');await click(f,'Mark reviewed');assert.equal(intakeCalls(f).find(c=>c.p_action==='review').p_org,A)}finally{f.close()}});
}else{
 test('authorized second organization handoff binds list detail and review to B',async()=>{const f=await fixture('?org='+B);try{assert.equal(f.w.document.querySelector('select').value,B);assert.equal(intakeCalls(f)[0].p_org,B);assert.match(f.w.document.body.textContent,/Fictional B Intake/);assert.doesNotMatch(f.w.document.body.textContent,/Fictional A/);await click(f,'Review intake');await click(f,'Mark reviewed');assert.ok(intakeCalls(f).every(c=>c.p_org===B));assert.equal(intakeCalls(f).find(c=>c.p_action==='review').p_data.id,'B')}finally{f.close()}});
 for(const query of['?org='+C,'?org=','?org=not-a-uuid','?org=%3Cscript%3E','?org='+A+'&org='+B,'?org='+B+'&org='+B])test('explicit unsupported or ambiguous scope fails closed '+query,async()=>{const f=await fixture(query);try{assert.equal(intakeCalls(f).length,0);assert.match(f.w.document.body.textContent,/Access Removed/);assert.equal(f.w.document.querySelectorAll('select,button,article').length,0);assert.doesNotMatch(f.w.document.body.textContent,/<script>|not-a-uuid/)}finally{f.close()}});
 for(const permissions of[{A:['outreach.view','finance.read'],B:['outreach.view']},{A:['outreach.view','finance.read'],B:['finance.read']},{A:['outreach.view','finance.read'],B:[]}])test('query cannot replace either financial or outreach authority '+JSON.stringify(permissions.B),async()=>{const f=await fixture('?org='+B,permissions);try{assert.equal(intakeCalls(f).length,0);assert.match(f.w.document.body.textContent,/Access Removed/)}finally{f.close()}});
 test('missing hint preserves first authorized choice and manual selection survives reload',async()=>{const f=await fixture();try{assert.equal(intakeCalls(f)[0].p_org,A);const select=f.w.document.querySelector('select');select.value=B;select.dispatchEvent(new f.w.Event('change'));await tick();assert.equal(intakeCalls(f).at(-1).p_org,B);assert.equal(new URL(f.w.location.href).searchParams.get('org'),B)}finally{f.close()}});
 test('programmatic unknown selector cannot send arbitrary organization',async()=>{const f=await fixture('?org='+B);try{const before=intakeCalls(f).length,s=f.w.document.querySelector('select');s.value=C;s.dispatchEvent(new f.w.Event('change'));await tick();assert.equal(intakeCalls(f).length,before);assert.match(f.w.document.body.textContent,/Access Removed/)}finally{f.close()}});
 test('account change revalidates hinted scope without falling back to another authorized org',async()=>{const f=await fixture('?org='+B);try{const old=[...f.w.document.querySelectorAll('button')].find(b=>b.textContent==='Review intake');f.permissions.B=[];const before=intakeCalls(f).length;await f.switch('fictional-b');assert.equal(intakeCalls(f).length,before);old.click();await tick();assert.equal(intakeCalls(f).length,before);assert.match(f.w.document.body.textContent,/Access Removed/)}finally{f.close()}});
 test('late B list cannot replace newly selected A scope',async()=>{const f=await fixture('?org='+B);try{let release;f.hold((_n,p)=>p.p_org===B?new Promise(r=>release=r):Promise.resolve({data:[]}));await click(f,'Next');const s=f.w.document.querySelector('select');s.value=A;s.dispatchEvent(new f.w.Event('change'));await tick();release({data:[{first_name:'OLD PRIVATE B'}]});await tick();assert.doesNotMatch(f.w.document.body.textContent,/OLD PRIVATE/);assert.equal(s.value,A);assert.equal(new URL(f.w.location.href).searchParams.get('org'),A)}finally{f.close()}});
 test('backend revocation still removes scope and retained mutation controls',async()=>{const f=await fixture('?org='+B);try{await click(f,'Review intake');const old=[...f.w.document.querySelectorAll('button')].find(b=>b.textContent==='Mark reviewed');f.hold(()=>Promise.resolve({status:403,error:{code:'42501',message:'PRIVATE'}}));await click(f,'Back to intakes');const before=intakeCalls(f).length;old.click();await tick();assert.equal(intakeCalls(f).length,before);assert.match(f.w.document.body.textContent,/Access Removed/);assert.doesNotMatch(f.w.document.body.textContent,/PRIVATE|Fictional B/)}finally{f.close()}});
 for(const reason of ['account','denial','client','detached'])test('retained organization control cannot change scope after '+reason,async()=>{const f=await fixture('?org='+B);try{const old=f.w.document.querySelector('select');
  if(reason==='account'){f.w.history.replaceState(null,'','?org='+A);f.permissions.B=[];await f.switch('fictional-b')}
  if(reason==='denial'){f.hold(()=>Promise.resolve({status:403,error:{code:'42501'}}));await click(f,'Next')}
  if(reason==='client')f.w.ChampionLifeAuth.client={...f.w.ChampionLifeAuth.client};
  if(reason==='detached')old.remove();
  const before=intakeCalls(f).length,url=f.w.location.href;old.value=A;old.dispatchEvent(new f.w.Event('change'));await tick();assert.equal(intakeCalls(f).length,before);assert.equal(f.w.location.href,url);
 }finally{f.close()}});

}
