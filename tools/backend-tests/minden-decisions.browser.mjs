// Independently authored security cases promoted from the preserved November 13 review.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
const source=readFileSync(new URL('../../assets/js/minden-decision-staff.js',import.meta.url),'utf8');
const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const width of [390,1280]){
  async function scenario(opts,run){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.setContent('<main><div id="minden-decisions-app"></div></main>');
    await page.evaluate(options=>{
     const h=window.h={user:'actor-a',calls:[],listeners:[],options,pending:null};
     h.data={kind:'minden-assigned-decisions',organization_id:'org-minden',campaign_id:'campaign-minden',registrations:[{name:'Fictional Assigned Visitor',decision:'salvation',status:'new',registered_at:'2026-11-12T18:00:00Z',email:'PROHIBITED_EMAIL',prayer_request:'PROHIBITED_PRAYER'}]};
     h.release=()=>{h.pending?.({data:h.data});h.pending=null};
     h.signal=()=>h.listeners.forEach(fn=>fn('SIGNED_OUT',null));
     window.ChampionLifeAuth={getUser:async()=>h.user?{id:h.user}:null,client:{auth:{onAuthStateChange:fn=>h.listeners.push(fn)},rpc:async(name,args)=>{
      h.calls.push({name,args});
      if(name!=='outreach_minden_decisions')throw Error('Unexpected RPC');
      if(args.p_campaign===null)return h.options.deny?{error:{code:'42501'}}:{data:{kind:'minden-decision-context',scope:'assigned',organization_id:'org-minden',campaign_id:'campaign-minden'}};
      if(h.options.pending)return new Promise(resolve=>h.pending=resolve);
      if(h.options.wrongScope)return{data:{...h.data,organization_id:'other-org'}};
      return{data:h.data};
     }}};
    },opts);
    await page.addScriptTag({content:source});await run(page);assert.deepEqual(errors,[]);results.push({browser:name,width,case:opts.case,result:'PASS'});
   }finally{await page.close()}
  }
  const text=async p=>p.locator('#minden-decisions-app').innerText();
  const visible=async p=>p.waitForFunction(()=>document.querySelector('#minden-decisions-app').textContent.includes('Fictional Assigned Visitor'));
  const pending=async p=>p.waitForFunction(()=>Boolean(window.h.pending));
  await scenario({case:'authorized-no-private-projection'},async p=>{await visible(p);assert.doesNotMatch(await text(p),/PROHIBITED_/);assert.equal(await p.evaluate(()=>h.calls.length),2)});
  await scenario({case:'registration-only-denied',deny:true},async p=>{await p.waitForFunction(()=>document.body.textContent.includes('Registration access does not grant decision access'));assert.equal(await p.evaluate(()=>h.calls.length),1);assert.doesNotMatch(await text(p),/Fictional Assigned/)});
  await scenario({case:'wrong-organization-response',wrongScope:true},async p=>{await p.waitForFunction(()=>document.body.textContent.includes('reporting is unavailable'));assert.doesNotMatch(await text(p),/Fictional Assigned/)});
  await scenario({case:'silent-account-change-pending',pending:true},async p=>{await pending(p);await p.evaluate(()=>{h.user='actor-b';h.release()});await p.waitForFunction(()=>document.body.textContent.includes('Session changed'));assert.doesNotMatch(await text(p),/Fictional Assigned/)});
  await scenario({case:'logout-pending',pending:true},async p=>{await pending(p);await p.evaluate(()=>{h.user=null;h.signal();h.release()});await p.waitForFunction(()=>document.body.textContent.includes('Sign in with'));assert.doesNotMatch(await text(p),/Fictional Assigned/)});
  await scenario({case:'removed-reinserted-root-permanently-retired',pending:true},async p=>{await pending(p);await p.evaluate(()=>{const n=document.querySelector('#minden-decisions-app');n.remove();document.body.append(n);h.release();window.dispatchEvent(new Event('focus'))});await p.waitForFunction(()=>document.body.textContent.includes('This view has closed'));assert.doesNotMatch(await text(p),/Fictional Assigned/);assert.equal(await p.evaluate(()=>h.calls.length),2)});
  await scenario({case:'fresh-refresh-and-revocation'},async p=>{await visible(p);await p.evaluate(()=>{h.data.registrations[0].status='connected'});await p.getByRole('button',{name:'Refresh assigned records'}).click();await p.waitForFunction(()=>document.body.textContent.includes('Follow-up status: connected'));assert.equal(await p.evaluate(()=>h.calls.length),4);await p.evaluate(()=>{h.options.deny=true});await p.getByRole('button',{name:'Refresh assigned records'}).click();await p.waitForFunction(()=>document.body.textContent.includes('Registration access does not grant decision access'));assert.doesNotMatch(await text(p),/Fictional Assigned/)});
  await scenario({case:'pagehide-clears-private-view'},async p=>{await visible(p);await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.doesNotMatch(await text(p),/Fictional Assigned/);assert.match(await text(p),/Private view cleared/)});
 }}finally{await browser.close()}
}
const report={source_sha256:createHash('sha256').update(source).digest('hex'),synthetic_auth:true,hosted:false,checks:results.length,results};
console.log(JSON.stringify(report));
