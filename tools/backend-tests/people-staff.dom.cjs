const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'staff-people.html'),'utf8'),{runScripts:'outside-only',url:'https://synthetic.test/staff-people.html'}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
let invalid=false,org='one',authorized=true,denied=false,delay=null,revision=1;const calls=[];
const person={id:'p1',first_name:'Synthetic',last_name:'Person',email:'safe@example.test',phone:'123',updated_at:'2026-09-28T12:00:00Z'};
const response=action=>action==='context'?{grants:[{permission:'people.read'},{permission:'people.update'},{permission:'staff.manage'},{permission:'staff.view'},{permission:'finance.read'}],departments:[{id:'d1',name:'Youth'}],permission_keys:[],templates:[]}:
action==='list'?[{...person,relationships:['member'],departments:['Youth'],portal_active:true,staff_active:true}]:action==='detail'?{person,can_edit:true,can_staff:authorized,can_manage_staff:authorized,relationships:[],departments:[],activity:[],portal_active:true,assignment:{revision,active:true,effective_at:'2026-09-28T00:00:00Z'},grants:[{permission:'people.read',department_ids:['d1']}],audit:[]}:{saved:true};
const auth={getUser:async()=>({id:'actor'}),client:{rpc:async(name,args)=>{calls.push({name,...args});if(delay&&args.p_action==='detail')await new Promise(r=>delay=r);if(denied)return {error:new Error('denied')};if(['grant','assignment'].includes(args.p_action))revision++;return {data:response(args.p_action)};}}};
w.eval(fs.readFileSync(path.join(root,'assets/js/staff-people-v1.js'),'utf8'));
const app=w.ChampionPeopleV1({auth,getContext:()=>({invalid,organizationId:org,user:{id:'actor'}}),onAccountChange:()=>{invalid=true;app.clear();}});
const wait=()=>new Promise(r=>setTimeout(r,0));const textButton=(parent,text)=>[...parent.querySelectorAll('button')].find(b=>b.textContent===text);
const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 await app.load();assert.match(d.getElementById('people-v1').textContent,/Synthetic Person/);
 const filters=d.querySelector('#people-v1 form');filters.elements.search.value='safe@example.test';filters.elements.department_id.value='d1';filters.elements.relationship.value='member';submit(filters);await wait();
 assert.equal(calls.at(-1).p_payload.search,'safe@example.test');assert.equal(calls.at(-1).p_payload.department_id,'d1');assert.equal(calls.at(-1).p_payload.relationship,'member');
 await app.open('p1');const dialog=d.getElementById('people-v1-detail');assert.equal(dialog.open,true);assert.match(dialog.textContent,/safe@example.test/);
 textButton(dialog,'Connections').click();assert.match(dialog.textContent,/Reviewed portal account linked/);
 textButton(dialog,'Discipleship').click();assert.match(dialog.textContent,/explicit discipleship access/);
 textButton(dialog,'Activity').click();assert.match(dialog.textContent,/No activity recorded/);
 textButton(dialog,'Staff Access').click();assert.match(dialog.querySelector('.financial-access').textContent,/separately authorized/);
 const grantForm=[...dialog.querySelectorAll('form')].find(f=>f.querySelector('h3').textContent==='Grant or change capability');
 grantForm.elements.scope.value='departments';grantForm.elements.department_ids.options[0].selected=true;grantForm.elements.permission.value='people.read';submit(grantForm);await wait();await wait();
 const grant=calls.find(c=>c.p_action==='grant');assert.equal(grant.p_payload.permission,'people.read');assert.deepEqual(Array.from(grant.p_payload.department_ids),['d1']);assert.equal(grant.p_payload.revision,1);assert.equal(calls.at(-1).p_action,'detail');
 authorized=false;await app.open('p1','staff');assert.equal(textButton(dialog,'Staff Access'),undefined);assert.equal(dialog.querySelector('.financial-access'),null);
 denied=true;await app.load();assert.equal(d.querySelector('#people-v1 .module-grid').textContent,'');assert.match(d.querySelector('#people-v1 [role=status]').textContent,/unavailable/);denied=false;
 delay=true;const late=app.open('p1');await wait();app.clear();org='two';delay();delay=null;await late;assert.equal(dialog.textContent,'');assert.equal(dialog.open,false);
 await integration();
 console.log('PASS People/Staff DOM: list, search and filters, details, sections, role-based staff visibility, separated finance, grant scope/revision, refresh, revocation clearing and late-response isolation');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});

async function integration(){
 const integrated=new JSDOM(fs.readFileSync(path.join(root,'staff-people.html'),'utf8'),{runScripts:'outside-only',url:'https://synthetic.test/staff-people.html'}),win=integrated.window,doc=win.document;
 win.HTMLDialogElement.prototype.close=function(){this.open=false};win.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 let changed,related=null;
 const grants=['people.read','people.create','people.update','staff.manage'].map(permission=>({organization_id:'one',permission}));
 win.ChampionLifeAuth={getUser:async()=>({id:'actor'}),client:{auth:{onAuthStateChange(fn){changed=fn;}},rpc:async(name,args)=>({data:name==='staff_workspace_context'?{organizations:[{id:'one',name:'Synthetic organization'}],grants}:response(args.p_action)})}};
 win.ChampionPersonDetail=()=>({clear(){},open(p){related=p;}});
 for(const name of ['staff-people-v1.js','staff-people.js'])win.eval(fs.readFileSync(path.join(root,'assets/js',name),'utf8'));
 await wait();doc.querySelector('[data-view=people]').click();await wait();await wait();
 assert.equal(doc.getElementById('view-people').hidden,false);assert.match(doc.getElementById('people-v1').textContent,/Synthetic Person/);
 const add=doc.getElementById('person-add');assert.equal(add.hidden,false);assert.equal(add.closest('#people-legacy'),null);add.click();assert.equal(doc.getElementById('editor').open,true);doc.getElementById('cancel').click();
 textButton(doc.getElementById('people-v1'),'Synthetic Person').click();await wait();textButton(doc.getElementById('people-v1-detail'),'Contact history, households & follow-up').click();assert.equal(related.id,'p1');
 changed('SIGNED_OUT',null);assert.equal(doc.getElementById('workspace').hidden,true);assert.equal(doc.getElementById('people-v1-detail').open,false);assert.equal(doc.querySelector('#people-v1 .module-grid').textContent,'');
 integrated.window.close();console.log('PASS actual workspace integration: navigation, retained Add Person and related tools, account-change clearing');
}
