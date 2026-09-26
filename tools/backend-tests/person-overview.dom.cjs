const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'staff-people.html'),'utf8'),{runScripts:'outside-only',url:'https://workspace.test/staff-people.html'}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
let invalid=false,organizationId='church',allowTasks=true,deferHistory=false,releaseHistory;const calls=[];
const person={id:'person',organization_id:'church',first_name:'Jane',last_name:'Example',email:'jane@example.test',phone:null,updated_at:'2026-09-26T00:00:00Z'};
const task={id:'task',organization_id:'church',person_id:'person',title:'Welcome call',status:'open',revision:1,assigned_user_id:'staff',due_on:'2026-09-25',person};
const auth={client:{from(table){let fields,options,single=false;const filters={},q={select(f,o){fields=f;options=o;return q},eq(k,v){filters[k]=v;return q},in(k,v){filters[k]=v;return q},lt(k,v){filters['lt:'+k]=v;return q},order(){return q},range(){return q},limit(){return q},maybeSingle(){single=true;return q},then(resolve){calls.push({table,filters:{...filters},options,fields});let result;
if(options?.head)result={count:table==='organization_people'?7:filters['lt:due_on']?2:4,error:null};
else if(table==='organization_people')result={data:single?person:[person],error:null};
else if(table==='followup_tasks')result={data:[task],error:null};
else result={data:[{id:'event',kind:'person_updated',actor_user_id:'staff',created_at:'2026-09-26T00:00:00Z',before_state:{email:'old@example.test'},after_state:{email:'<img src=x onerror=alert(1)>'}}],error:null};
if(table==='organization_admin_events'&&deferHistory)return new Promise(r=>{releaseHistory=()=>r(result)}).then(resolve);
return Promise.resolve(result).then(resolve);}};return q;}}};
const context=()=>({user:{id:'staff'},organizationId,invalid,can:p=>p.startsWith('followup.')?allowTasks:true});let edits=0,newTasks=0,updated=0;
w.eval(fs.readFileSync(path.join(root,'assets/js/staff-person-detail.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'assets/js/staff-overview.js'),'utf8'));
const detail=w.ChampionPersonDetail({auth,getContext:context,onEdit:()=>edits++,onFollowup:()=>newTasks++,onUpdateTask:()=>updated++});const overview=w.ChampionStaffOverview({auth,getContext:context,onTask:()=>updated++});
const wait=()=>new Promise(r=>setTimeout(r,0)),click=s=>d.querySelector(s).click();
(async()=>{
 detail.open(person);await wait();assert.match(d.getElementById('detail-contact').textContent,/jane@example.test/);click('#detail-edit');click('#detail-followup');assert.equal(edits,1);assert.equal(newTasks,1);
 click('[data-person-tab="history"]');await wait();assert.match(d.getElementById('detail-history').textContent,/old@example.test/);assert.equal(d.querySelector('#detail-history img'),null);const historyCall=calls.find(c=>c.table==='organization_admin_events');assert.equal(historyCall.filters.organization_id,'church');assert.equal(historyCall.filters.subject_id,'person');assert.deepEqual(Array.from(historyCall.filters.kind),['person_created','person_updated']);
 click('[data-person-tab="tasks"]');await wait();assert.match(d.getElementById('detail-tasks').textContent,/Welcome call/);click('#detail-tasks button');assert.equal(updated,1);assert.equal(calls.find(c=>c.table==='followup_tasks').filters.person_id,'person');
 allowTasks=false;click('[data-person-tab="tasks"]');await wait();assert.match(d.getElementById('detail-status').textContent,/not been assigned/);allowTasks=true;
 deferHistory=true;click('[data-person-tab="history"]');await wait();detail.clear();organizationId='outreach';releaseHistory();await wait();assert.equal(d.getElementById('detail-history').textContent,'');assert.equal(d.getElementById('person-detail').open,false);
 organizationId='church';await overview.load();assert.equal(d.getElementById('overview-people').textContent,'7');assert.equal(d.getElementById('overview-open').textContent,'4');assert.equal(d.getElementById('overview-overdue').textContent,'2');assert.match(d.getElementById('overview-tasks').textContent,/Welcome call/);click('#overview-tasks button');assert.equal(updated,2);
 for(const call of calls.filter(c=>c.options?.head&&c.table==='followup_tasks')){assert.equal(call.filters.organization_id,'church');assert.equal(call.filters.assigned_user_id,'staff');assert.equal(call.filters.status,'open');}
 invalid=true;overview.clear();detail.clear();assert.equal(d.getElementById('overview-tasks').textContent,'');assert.equal(d.getElementById('overview-people').textContent,'');
 console.log('PASS person/overview: scoped details/history/tasks, escaped content, edit actions, denied task access, late response isolation, live counts, assigned-task filters and clearing');dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()});
