// Test-only fictional HTTP; actual selected HTML, shared Auth/SDK/session and modules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSelected,hash,sdkSHA,sdkURL} from './source.mjs';
export const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',O='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',Q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',P='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
export const origin='https://partner-staff.invalid',backend='https://fictional-partner.supabase.co',key='sb-fictional-partner-auth-token';
export const session=id=>{const exp=Math.floor(Date.now()/1000)+3600,user={id,email:'fictional@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01'};return{access_token:[{alg:'HS256',typ:'JWT'},{sub:id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'fictional',token_type:'bearer',expires_at:exp,expires_in:3600,user}};
export async function createHarness(browser,width){
 const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(hash(sdk),sdkSHA);
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.setDefaultTimeout(10000);
 const state={actor:A,person:P,caps:['people.read','followup.read','outreach.view','finance.read','outreach.manage'],orgs:[O,Q],calls:[],writes:[],errors:[],unexpected:[],served:{},pending:[],hold:null,deny:false};
 page.on('pageerror',e=>state.errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
  if(req.url()===sdkURL)return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
  if(u.origin===backend){
   let actor;try{actor=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
   if(u.pathname==='/auth/v1/user')return actor===state.actor?send(session(actor).user):send({message:'Fictional expired'},401);
   if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
   const p=req.method()==='POST'?req.postDataJSON():null,name=u.pathname.split('/').at(-1),call={name,p,actor,method:req.method(),filters:Object.fromEntries(u.searchParams)};state.calls.push(call);
   const result=()=>{
    if(name==='staff_workspace_context')return {organizations:state.orgs.map(id=>({id,name:id===O?'Church A':'Church B'})),grants:state.orgs.flatMap(organization_id=>state.caps.map(permission=>({organization_id,permission,department_ids:null})))};
    if(name==='outreach_partner_workspace'){
     if(!state.orgs.includes(p.p_org)||!['outreach.view','finance.read'].every(x=>state.caps.includes(x)))return {denied:true};
     if(p.p_action==='list')return [{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',first_name:'Fictional',last_name:p.p_org===O?'Intake A':'Intake B',email:'private@example.test',phone:'fictional',source_site:'approved-source',submitted_at:'2026-11-01',commitment_amount:1,status:'new'}];
     if(p.p_action==='detail')return {id:p.p_data.id,person_id:state.person,status:'new',revision:3,source_site:'approved-source',source_path:'/fictional',raw_submission:{email:'restricted@example.test'},history:[]};
     state.writes.push(call);return {id:p.p_data.id,revision:4};
    }
    if(name==='people_workspace')return p.p_action==='list'?[{id:P,first_name:'Fictional',last_name:p.p_org===O?'Person A':'Person B'}]:{person:{id:P,first_name:'Fictional',last_name:'Person'},relationships:[]};
    if(name==='followup_tasks')return[];
    if(name==='forms_workspace')return{capabilities:{profile:'private_draft_v1'},organizations:[]};
    if(name==='communications_workspace')return{organizations:[],campaigns:[],external_delivery_enabled:false};
    return[];
   };
   const captured=result(),denied=state.deny||actor!==state.actor||captured?.denied;
   if(state.hold?.(call)){state.hold=null;await new Promise(resolve=>state.pending.push(resolve))}
   return denied?send({code:'42501',message:'Fictional denied'},403):send(captured);
  }
  if(u.origin!==origin){state.unexpected.push(req.url());return route.abort()}
  const path=u.pathname.slice(1);
  if(path==='seed'||path==='discipleship-login.html')return route.fulfill({body:'<!doctype html><title>Fictional login</title><main>Fictional authentication boundary</main>',contentType:'text/html'});
  if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
  const body=readSelected(path),digest=hash(body);if(state.served[path])assert.equal(state.served[path],digest);state.served[path]=digest;
  return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
 });
 async function seed(id=A){state.actor=id;await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(id)})}
 async function open(path='staff-outreach-partners.html?org='+O){await seed();await page.goto(origin+'/'+path)}
 async function held(){for(let i=0;i<500&&!state.pending.length;i++)await page.waitForTimeout(10);assert(state.pending.length,'Fictional held request reached')}
 async function release(){state.pending.splice(0).forEach(fn=>fn());await page.waitForLoadState('networkidle')}
 return {context,page,state,seed,open,held,release,close:()=>context.close()};
}
