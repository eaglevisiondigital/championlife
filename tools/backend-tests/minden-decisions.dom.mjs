import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../../assets/js/minden-decision-staff.js',import.meta.url),'utf8');
const uuid='11111111-1111-4111-8111-111111111111';
const sleep=()=>new Promise(resolve=>setTimeout(resolve,60));
const result={
 campaign:'minden-family-fun-day',total:1,shown:1,
 decisions:[{
  id:'22222222-2222-4222-8222-222222222222',
  first_name:'Synthetic',last_name:'Minden',email:'synthetic@example.test',
  phone:'5550101',decision:'salvation',prayer_request:'Fictional prayer request',
  created_at:'2026-11-12T18:00:00Z'
 }]
};
function scenario(options={}){
 const dom=new JSDOM('<div id="minden-decisions-app"></div>',{
  url:'https://preview.example.test/staff-minden-decisions.html',
  runScripts:'outside-only'
 });
 const {window:w}=dom, calls=[];
 let listener,identity=options.initialUser??'user-a';
 let resolveDecision;
 const pending=options.pending===true?new Promise(resolve=>resolveDecision=resolve):null;
 const auth={
  getUser:async()=>options.switchedOnRecheck&&calls.some(x=>x.name==='outreach_minden_decisions')?{id:'user-b'}:identity?{id:identity}:null,
  client:{
   auth:{onAuthStateChange:fn=>{listener=fn;}},
   rpc:async(name,p)=>{
    calls.push({name,p});
    if(name==='outreach_registration_workspace')
     return{data:options.noCampaign?[]:[{id:uuid,name:'Minden Family Fun Day Outreach'}]};
    if(name==='outreach_minden_decisions')
     return pending??(options.denied?{error:{code:'42501'}}:{data:result});
    throw Error('Unexpected RPC request');
   }
  }
 };
 w.ChampionLifeAuth=auth;
 w.eval(source);
 return {dom,w,root:w.document.getElementById('minden-decisions-app'),calls,
  logout:()=>{identity=null;listener?.('SIGNED_OUT',null);},
  resolveDecision:v=>resolveDecision?.(v??{data:result})};
}

{const t=scenario();await sleep();
 const text=t.root.textContent;
 assert.match(text,/Minden Decisions & Free Book Follow-up/);
 assert.match(text,/Synthetic Minden/);
 assert.match(text,/Fictional prayer request/);
 assert.doesNotMatch(text,/Huntsville|Bessemer/);
 assert.equal(t.calls.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(t.calls[0])),{name:'outreach_registration_workspace',
  p:{p_action:'campaigns',p_campaign:null,p_payload:{}}});
 assert.deepEqual(JSON.parse(JSON.stringify(t.calls[1])),{name:'outreach_minden_decisions',p:{p_campaign:uuid}});
 t.dom.window.close();
}
{const t=scenario({noCampaign:true});await sleep();
 assert.match(t.root.textContent,/do not have Minden registration access/);
 assert.equal(t.calls.filter(x=>x.name==='outreach_minden_decisions').length,0);
 assert.doesNotMatch(t.root.textContent,/synthetic@example\.test/);
 t.dom.window.close();
}
{const t=scenario({denied:true});await sleep();
 assert.match(t.root.textContent,/Minden decision reporting is unavailable/);
 assert.doesNotMatch(t.root.textContent,/synthetic@example\.test/);
 t.dom.window.close();
}
{const t=scenario({switchedOnRecheck:true});await sleep();
 assert.match(t.root.textContent,/Session changed/);
 assert.doesNotMatch(t.root.textContent,/Synthetic Minden|synthetic@example\.test/);
 t.dom.window.close();
}
{const t=scenario({pending:true});await sleep();
 assert.equal(t.calls.filter(x=>x.name==='outreach_minden_decisions').length,1);
 t.logout();await sleep();t.resolveDecision();await sleep();
 assert.match(t.root.textContent,/Sign in with your approved Champion Life staff account/);
 assert.doesNotMatch(t.root.textContent,/Synthetic Minden|synthetic@example\.test/);
 t.dom.window.close();
}
console.log('PASS — 5 Minden decision staff scenarios: authorized, no assignment, denied RPC, account switch, delayed logout');
