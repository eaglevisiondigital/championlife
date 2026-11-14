import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html=readFileSync(new URL('../../king-kind-signup.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../../assets/js/general-king-kind-signup.js',import.meta.url),'utf8');
let passed=0;
const ok=(value,label)=>{assert.ok(value,label);passed++;};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));

async function setup({user={id:'person-A',email:'person-a@example.test'},rpc,verify,profile,enrollment}={}){
 const dom=new JSDOM(html,{url:'https://example.test/king-kind-signup.html',runScripts:'outside-only'});
 const {window}=dom;
 let account=user,changed,requests=[],profileCalls=0,enrollmentCalls=0;
 const api={
  client:{
   auth:{
    getUser:async()=>verify ? verify(account) : {data:{user:account},error:null},
    onAuthStateChange(callback){changed=callback;return{data:{subscription:{unsubscribe(){}}}}},
    signOut:async()=>{account=null;changed?.('SIGNED_OUT',null);return{error:null}}
   },
   rpc:async(name,payload)=>{
     requests.push({name,payload});
     return rpc ? rpc(name,payload) : {data:{registered:true},error:null};
   }
  },
  ensureProfile:async()=>{profileCalls++;return profile?.()??null},
  ensureEnrollment:async()=>{enrollmentCalls++;return enrollment?.()??null}
 };
 window.ChampionLifeAuth=api;
 window.eval(js);
 await tick();
 return{
  dom,window,document:window.document,
  requests, setAccount(next){account=next;changed?.('SIGNED_IN',next?{user:next}:null);},
  get counters(){return{profileCalls,enrollmentCalls}},
  async submit(first='First',last='Example'){
   window.document.getElementById('first').value=first;
   window.document.getElementById('last').value=last;
   window.document.getElementById('register').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
   await tick();
  },
  close(){window.close()}
 };
}
async function scenario(name,fn){
 const s=await setup(name);try{await fn(s)}finally{s.close()}
}

await scenario({user:null},async s=>{
 ok(!s.document.getElementById('signin').hidden,'signed-out users see existing OTP path');
 ok(s.document.getElementById('register').hidden,'signed-out users cannot access registration form');
 ok(s.requests.length===0,'signed-out page makes no registration RPC');
});

await scenario({},async s=>{
 ok(!s.document.getElementById('register').hidden,'verified user sees name registration');
 ok(s.document.getElementById('account-email').textContent==='person-a@example.test','account email shown');
 await s.submit();
 ok(s.requests.length===1,'one validated registration RPC');
 ok(s.requests[0].name==='register_general_king_kind_resource','RPC is resource-only');
 ok(s.requests[0].payload.p_first_name==='First','first name submitted');
 ok(s.requests[0].payload.p_last_name==='Example','last name submitted');
 ok(s.counters.profileCalls===0&&s.counters.enrollmentCalls===0,'no cross-account client writes; enrollment is atomic in RPC');
 ok(!s.document.getElementById('success').hidden,'successful verified account shows resources');
});

await scenario({rpc:async()=>({data:null,error:{message:'private provider secret'}})},async s=>{
 await s.submit();
 ok(s.document.getElementById('success').hidden,'failed RPC never claims successful registration');
 ok(!s.document.getElementById('result').textContent.includes('private provider secret'),'provider failure text not leaked');
});

let checksOfUser=0;
await scenario({user:{id:'person-A',email:'person-a@example.test'},
verify:async()=>({data:{user:++checksOfUser===1?{id:'person-A',email:'person-a@example.test'}:{id:'person-B',email:'person-b@example.test'}},error:null})},async s=>{
 await s.submit();
 ok(s.requests.length===0,'account mismatch prevents registration RPC');
 ok(s.document.getElementById('success').hidden,'account mismatch never claims success');
});

let resolvePending;
await scenario({rpc:()=>new Promise(resolve=>{resolvePending=resolve})},async s=>{
 s.document.getElementById('first').value='Old';
 s.document.getElementById('last').value='Person';
 s.document.getElementById('register').dispatchEvent(new s.window.Event('submit',{bubbles:true,cancelable:true}));
 await tick();
 ok(s.requests.length===1,'pending request exists before account switch');
 s.setAccount(null);
 ok(s.document.getElementById('register').hidden,'sign-out hides the form');
 ok(s.document.getElementById('success').hidden,'sign-out hides resources');
 resolvePending({data:{registered:true},error:null});
 await tick();
 ok(s.document.getElementById('success').hidden,'late response cannot restore another account resources');
 ok(s.counters.profileCalls===0,'late response cannot create stale profile');
});

console.log('General King Kind browser DOM security:',passed,'checks passed');
