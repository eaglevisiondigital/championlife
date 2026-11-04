import {JSDOM} from 'jsdom';import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label)},A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',P='20000000-0000-4000-8000-000000000001';
async function run(query,allowed=[A,B]){
 const dom=new JSDOM(read('staff-people.html'),{runScripts:'outside-only',url:'https://fixture.test/staff-people.html'+query}),w=dom.window,d=w.document;let changed;const opened=[];
 w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 const grants=allowed.map(organization_id=>({organization_id,permission:'people.read'}));
 const q={select(){return q},eq(){return q},order(){return q},limit(){return q},range(){return q},is(){return q},then(resolve){resolve({data:[],count:0})}};
 w.ChampionLifeAuth={getUser:async()=>({id:'staff'}),client:{from:()=>q,rpc:async()=>({data:{organizations:allowed.map(id=>({id,name:id===A?'Synthetic Church':'Synthetic Other'})),grants}}),auth:{onAuthStateChange(fn){changed=fn}}}};
 w.ChampionPeopleV1=()=>({load:async()=>{},clear(){}});
 w.ChampionPersonDetail=()=>({clear(){},open(person){opened.push({person:person.id,org:d.getElementById('organization').value})}});
 w.eval(read('assets/js/staff-people.js'));await new Promise(r=>setTimeout(r,20));return{dom,w,d,opened,changed};
}
for(const query of ['?org='+B+'&person='+P,'?org='+A+'&person='+P,'']){const x=await run(query);ok(!x.d.getElementById('workspace').hidden,'authorized/no-hint workspace');ok(x.d.getElementById('organization').value===(query.includes(B)?B:A),'exact requested organization/no-hint default');if(query)ok(x.opened.length===1&&x.opened[0].org===(query.includes(B)?B:A)&&x.opened[0].person===P,'Person handoff stays exact organization');x.changed('SIGNED_OUT',null);ok(x.d.getElementById('workspace').hidden,'account logout retires handoff');x.dom.window.close()}
for(const query of ['?org='+A+'&org='+B+'&person='+P,'?org=malformed&person='+P,'?org=&person='+P,'?org=10000000-0000-4000-8000-999999999999&person='+P]){const x=await run(query);ok(x.d.getElementById('workspace').hidden,'invalid/unavailable org fails closed');ok(x.opened.length===0,'invalid org opens no Person');x.dom.window.close()}
const denied=await run('?org='+B+'&person='+P,[A]);ok(denied.d.getElementById('workspace').hidden&&denied.opened.length===0,'new account cannot inherit prior organization handoff');denied.dom.window.close();
console.log(`PASS ${checks} Dream Team People handoff checks`);
