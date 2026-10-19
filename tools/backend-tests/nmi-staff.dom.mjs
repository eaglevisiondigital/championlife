import assert from 'node:assert/strict';import{JSDOM}from'jsdom';import{readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const dom=new JSDOM(read('staff-nmi-execution.html'),{url:'https://synthetic.example.test/staff-nmi-execution.html',runScripts:'outside-only'}),w=dom.window;let permitted=true,finish;
w.setInterval=()=>0;w.confirm=()=>true;
w.ChampionLifeAuth={getUser:async()=>({id:'synthetic-user'}),client:{auth:{onAuthStateChange(){}},rpc:async()=>({data:{organizations:[{id:'synthetic-org',name:'Synthetic'}]}})}};
w.StaffWorkspace={denied:(root,message)=>root.replaceChildren(w.document.createTextNode(message))};w.GivingUtils={money:x=>x};
w.eval(read('assets/js/nmi-giving-client.js'));const E=w.NmiGivingClient.element;
const operations={enabled:true,attempts:[{id:'attempt',session_id:'session',leg_id:'leg',operation:'refund',state:'review',amount_minor:'500',currency:'USD',route_label:'Synthetic'}],recurring:[],held_receipts:1,jobs:[{id:'job',kind:'lookup',state:'held'}]};
w.NmiGivingClient={element:E,call:async()=>{if(!permitted)throw Error('Current finance access denied');return operations}};
w.eval(read('assets/js/nmi-staff-execution.js'));await new Promise(r=>setTimeout(r,15));const root=w.document.getElementById('nmi-staff-app');
assert(root.textContent.includes('Run authoritative lookup'));assert(root.textContent.includes('Reconcile statement evidence'));assert(root.textContent.includes('Look up original result'));
w.NmiGivingClient.call=()=>new Promise(r=>{finish=r});w.dispatchEvent(new w.Event('focus'));await new Promise(r=>setTimeout(r,1));
permitted=false;w.NmiGivingClient.call=async()=>{throw Error('Current finance access denied')};w.dispatchEvent(new w.Event('focus'));await new Promise(r=>setTimeout(r,5));finish(operations);await new Promise(r=>setTimeout(r,5));
assert(!root.textContent.includes('Synthetic'));assert(!root.querySelector('form'));assert(root.textContent.includes('denied'));w.close();
console.log('PASS sandbox staff controls: Operations job/adjustment lookup/statement reconciliation and same-session revocation clears protected content; stale responses cannot restore it');
// Actual adopted shell + current execution leaf, including explicit recovery navigation.
const {sharedShellFixture,hasSharedRecovery}=await import('./nmi-shared-shell-fixture.mjs');
async function adoptedPage(initialIdentity){
 const dom=new JSDOM(read('staff-nmi-execution.html'),{url:'https://synthetic.example.test/staff-nmi-execution.html',runScripts:'outside-only'}),a=dom.window;
 let identity=initialIdentity,access=true;const callbacks=[];a.setInterval=()=>0;a.matchMedia=()=>({matches:false});
 const scope=()=>({id:'synthetic-org',name:'Synthetic',permissions:['payments.view','payments.manage','payments.configure','payments.recurring.manage','payments.reconcile']});
 a.ChampionLifeAuth={enabled:true,getUser:async()=>({id:identity,email:identity+'@example.test'}),client:{auth:{onAuthStateChange:fn=>callbacks.push(fn)},rpc:async name=>{
  if(name==='shared_platform_context')return{data:{staff:{organizations:[],grants:[]},payments:{organizations:access?[scope()]:[]},giving:{organizations:[]},forms:{organizations:[]},outreach:{campaigns:[],contexts:access?['champion']:[],role_label:'Synthetic finance'},decisions:[],partners:[]}};
  assert.equal(name,'payments_workspace');return{data:{organizations:access?[scope()]:[]}};
 }}};
 a.eval(read('assets/js/outreach-staff-common.js'));a.eval(read('assets/js/giving-utils.js'));a.eval(sharedShellFixture());a.eval(read('assets/js/nmi-giving-client.js'));
 const element=a.NmiGivingClient.element;a.NmiGivingClient={element,call:async()=>{if(!access)throw Error('Finance access denied');return {...operations,attempts:operations.attempts.map(x=>({...x,route_label:identity}))}}};
 a.eval(read('assets/js/nmi-staff-execution.js'));await new Promise(r=>setTimeout(r,25));
 return{dom,w:a,changeIdentity(value){identity=value;callbacks.forEach(fn=>fn('SIGNED_IN',{user:{id:identity}}))},revoke(){access=false;a.dispatchEvent(new a.Event('focus'))}};
}
const prior=await adoptedPage('first-synthetic-user');
try{
 assert(prior.w.document.body.textContent.includes('first-synthetic-user'));
 prior.changeIdentity('second-synthetic-user');await new Promise(r=>setTimeout(r,35));
 assert(hasSharedRecovery(prior.w.document),'identity change exposes visible recovery with an installed staff destination');assert(!prior.w.document.querySelector('#staff-main').textContent.includes('first-synthetic-user'));
}finally{prior.dom.window.close();}
const fresh=await adoptedPage('second-synthetic-user');
try{
 assert(fresh.w.document.querySelector('#nmi-staff-app h1'),'fresh navigation restores the new authorized execution leaf');assert(fresh.w.document.querySelector('#nmi-staff-app').textContent.includes('second-synthetic-user'));
 fresh.revoke();await new Promise(r=>setTimeout(r,35));
 assert(hasSharedRecovery(fresh.w.document),'revoked execution leaf keeps visible accessible shared recovery');assert(!fresh.w.document.querySelector('#staff-main form'));assert(!fresh.w.document.querySelector('#staff-main').textContent.includes('second-synthetic-user'));
 console.log('PASS adopted execution leaf: identity recovery/navigation, installed recovery route and visible revocation without protected controls/data');
}finally{fresh.dom.window.close();}
