// Independent actual-page DOM exercise. Fictional sessions, no provider/network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from '../backend-tests/node_modules/jsdom/lib/api.js';

const source=readFileSync(new URL('../../assets/js/nmi-public-giving.js',import.meta.url),'utf8');
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function until(predicate){for(let i=0;i<100&&!predicate();i++)await tick();assert(predicate(),'fictional state reached');}
async function fixture({enabled=true}={}){
 const dom=new JSDOM('<main id="nmi-giving-app"></main>',{url:'https://giving-fictional.invalid/?organization=org-a&form=form-a',runScripts:'outside-only'});
 const w=dom.window,calls=[];let release,fields,authEvent;
 w.GivingUtils={amountToMinor:value=>Math.round(Number(value)*100),money:(n,c)=>`${n} ${c}`};
 w.ChampionLifeAuth={client:{auth:{onAuthStateChange:callback=>{authEvent=callback;}}}};
 w.NmiGivingClient={configuration:()=>({enabled,siteKey:'fictional'}),element:(tag,text,attrs={})=>{const e=w.document.createElement(tag);if(text!=null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;},call:async payload=>{
  calls.push(JSON.parse(JSON.stringify(payload)));
  if(payload.action==='form')return {available:true,label:'Fictional giving',funds:[{id:'fund-a',name:'Fictional fund'}],recurring_allowed:true};
  if(payload.action==='create')return new Promise(resolve=>{release=()=>resolve({session_id:'fictional-session',currency:'USD',legs:[{id:'leg-a',amount_minor:1000,component_key:'fictional-key',merchant_reference:'fictional-mid'}]});});
  if(payload.action==='execute')throw Error('Uncertain fictional operation; do not retry');
  throw Error('Unexpected action');
 }};
 w.turnstile={render:(_root,options)=>{options.callback('fictional-challenge');return 1;},remove(){},reset(){}};
 w.NmiSandboxComponent={createNmiToken:async()=>({testMode:true,merchantId:'fictional-mid',currencies:['USD']}),mountNmiPayments:(_root,options)=>{fields=options;return {destroy(){},resetFields(){}};}};
 const append=w.document.head.append.bind(w.document.head);
 w.document.head.append=(element)=>{append(element);if(element.tagName==='SCRIPT')queueMicrotask(()=>element.onload?.());};
 w.eval(source);
 if(enabled)await until(()=>w.document.querySelector('form')&&w.document.querySelector('form').onsubmit);
 else await tick();
 return {dom,w,calls,get release(){return release;},get fields(){return fields;},authEvent:(...args)=>authEvent(...args)};
}

for(const [submitted,changed] of [['once','monthly'],['monthly','once'],['weekly','biweekly'],['biweekly','weekly']]){
 const f=await fixture();try{
  const d=f.w.document,select=d.querySelector('#donor-frequency');select.value=submitted;
  d.querySelector('[name=amount]').value='10';d.querySelector('[name=email]').value='fictional@example.test';d.querySelector('[name=name]').value='Fictional';d.querySelector('[name=starts]').value='2030-01-01';
  const form=d.querySelector('form');form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>f.release);
  select.value=changed;d.querySelector('[name=starts]').value='2031-02-02';
  form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));
  const creation=f.calls.find(c=>c.action==='create');check(creation.frequency,submitted,'creation retains submitted frequency');check(f.calls.filter(c=>c.action==='create').length,1,'duplicate pending submit denied');
  check(creation.starts_on,submitted==='once'?undefined:'2030-01-01','original schedule is immutable');
  f.release();await until(()=>f.fields);await tick();f.fields.onChange({complete:true,token:'fictional_token_123'});
  const button=[...d.querySelectorAll('button')].find(b=>/Give in sandbox|Start sandbox recurring/.test(b.textContent));assert(button);
  check(button.textContent,submitted==='once'?'Give in sandbox':'Start sandbox recurring schedule','rendered operation binds original intent');
  const save=d.querySelector('#nmi-save');check(button.disabled,submitted!=='once','only original recurring intent requires consent');
  save.checked=true;save.dispatchEvent(new f.w.Event('change'));button.click();await until(()=>f.calls.some(c=>c.action==='execute'));
  const execute=f.calls.find(c=>c.action==='execute');check(execute.operation,submitted==='once'?'sale':'recurring_create','operation cannot be altered by detached frequency');check(execute.session_id,'fictional-session','exact created session');check(execute.leg_id,'leg-a','exact created leg');check(execute.capability,creation.capability,'exact creation capability');
  button.click();await tick();check(f.calls.filter(c=>c.action==='execute').length,1,'uncertain response and retained button cannot duplicate');
  check(d.querySelector('h1').textContent,'Payment confirmation pending','uncertain outcome remains explicit');
 }finally{f.dom.window.close();}
}
{
 const f=await fixture({enabled:false});check(f.calls.length,0,'default disabled path has zero API calls');check(f.w.document.querySelector('a').getAttribute('href'),'/give.html','existing giving preserved');f.dom.window.close();
}
console.log(JSON.stringify({status:'PASS',checks,sourceSha256:createHash('sha256').update(source).digest('hex'),providerCalls:0,realPayments:0,syntheticOnly:true}));
