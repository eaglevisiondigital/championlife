import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../../assets/js/minden-decision-staff.js',import.meta.url),'utf8');
const campaign='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
const context={kind:'minden-decision-context',campaign_id:campaign,organization_id:org,scope:'assigned'};
const result={kind:'minden-assigned-decisions',campaign_id:campaign,organization_id:org,registrations:[{registration_id:'33333333-3333-4333-8333-333333333333',name:'Synthetic Minden',decision:'salvation',status:'new',next_contact_on:'2026-12-20',email:'NEVER-RENDER',phone:'NEVER-RENDER',prayer_request:'NEVER-RENDER'}]};
const wait=()=>new Promise(r=>setTimeout(r,40));
function scenario(options={}){
 const dom=new JSDOM('<main><div id="minden-decisions-app"></div></main>',{url:'https://example.invalid/staff-minden-decisions.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 let identity='user-a',listener,resolve;
 const pending=new Promise(r=>resolve=r);
 const auth={getUser:async()=>options.switchRecheck&&calls.length?{id:'user-b'}:identity?{id:identity}:null,client:{auth:{onAuthStateChange:fn=>listener=fn},rpc:async(name,p)=>{calls.push({name,p});assert.equal(name,'outreach_minden_decisions');if(!p.p_campaign)return options.denied?{error:{code:'42501'}}:{data:context};return options.pending?pending:{data:options.wrongOrg?{...result,organization_id:'wrong'}:result};}}};
 w.ChampionLifeAuth=auth;w.eval(source);
 return{dom,w,calls,root:w.document.getElementById('minden-decisions-app'),logout:()=>{identity=null;listener('SIGNED_OUT',null)},resolve:()=>resolve({data:result})};
}
let cases=0;
for(const options of[{}, {denied:true},{switchRecheck:true},{wrongOrg:true},{pending:true}]){
 const t=scenario(options);await wait();
 if(options.pending){t.logout();await wait();t.resolve();await wait();}
 if(!Object.keys(options).length){assert.match(t.root.textContent,/Synthetic Minden/);assert.match(t.root.textContent,/2026-12-20/);assert.deepEqual(JSON.parse(JSON.stringify(t.calls[0])),{name:'outreach_minden_decisions',p:{p_campaign:null}});assert.equal(t.calls.length,2)}
 else{assert.doesNotMatch(t.root.textContent,/Synthetic Minden/);assert.ok(/unavailable|Session changed|Sign in/.test(t.root.textContent));}
 assert.doesNotMatch(t.root.textContent,/NEVER-RENDER/);t.root.remove();await wait();t.dom.window.close();cases++;
}
{const t=scenario();await wait();const button=t.root.querySelector('button'),parent=t.root.parentNode;t.root.remove();parent.append(t.root);button.click();await wait();assert.equal(t.calls.length,2);assert.doesNotMatch(t.root.textContent,/Synthetic Minden/);t.root.remove();await wait();t.dom.window.close();cases++;}
console.log(`PASS — ${cases} Minden assigned-decision DOM scenarios; no registration substitution or private projection`);
