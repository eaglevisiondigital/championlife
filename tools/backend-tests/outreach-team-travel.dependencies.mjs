// Native local dependency-expiry regression. Scoped team.manage remains current
// while a separate People/Household permission or Person affiliation expires.
import assert from'node:assert/strict';import{randomUUID as uuid}from'node:crypto';import{fixture}from'./outreach-team-travel.fixture.mjs';
const f=await fixture(true),{db,q,as,call,member,campaign,org,owner,viewer}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const clientOp=(c,a,p={})=>c.query('select public.outreach_team_workspace($1,$2,$3) v',[a,campaign,p]);
async function staff(){const c=await db.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);await c.query('set role authenticated');return c;}
try{
 const target=await member('Synthetic scoped adult',30),outside=await member('Synthetic outside department',31),minor=await member('Synthetic scoped minor',12),guardian=await member('Synthetic scoped guardian',40),household=uuid(),department=uuid();
 await db.exec('reset role');await q("update outreach_campaign_assignments set capabilities=array['view','team.view','team.manage'] where campaign_id=$1 and user_id=$2",[campaign,viewer]);
 for(const k of['people.read','people.update','households.read'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,viewer,k]);
 // Synthetic configuration prerequisite only; no production trigger is changed.
 await db.exec('alter table organization_departments disable trigger user;alter table person_department_affiliations disable trigger user');
 await q("insert into organization_departments(id,organization_id,name)values($1,$2,'Synthetic scoped department')",[department,org]);await q('insert into person_department_affiliations(organization_id,person_id,department_id)values($1,$2,$3)',[org,target.person,department]);
 await db.exec('alter table organization_departments enable trigger user;alter table person_department_affiliations enable trigger user');
 await q("insert into households(id,organization_id,name)values($1,$2,'Synthetic shared guardian household')",[household,org]);for(const[p,r]of[[minor.person,'child'],[guardian.person,'adult']])await q('insert into household_members(organization_id,household_id,person_id,relationship)values($1,$2,$3,$4)',[org,household,p,r]);
 async function run(kind,permission,scoped=false){
  await db.exec('reset role');await q('update organization_staff_permissions set expires_at=null,department_ids=null where organization_id=$1 and user_id=$2',[org,viewer]);await q('update person_department_affiliations set expires_at=null where organization_id=$1 and person_id=$2 and department_id=$3',[org,target.person,department]);
  if(scoped)await q("update organization_staff_permissions set department_ids=array[$3::uuid] where organization_id=$1 and user_id=$2 and permission in('people.read','people.update')",[org,viewer,department]);
  const person=kind==='household_grant'?minor:target,action=kind==='household_grant'?'guardian_review':'review_age';
  async function payload(){const m=(await q('select age,revision from outreach_team_members where id=$1',[person.id])).rows[0];return action==='review_age'?{member_id:person.id,revision:m.revision,age:m.age+1,reason:'Synthetic scoped age review'}:{member_id:person.id,revision:m.revision,guardian_member_id:guardian.id,household_id:household,reason:'Synthetic scoped guardian review'};}
  const positive=await staff();await clientOp(positive,action,await payload());await positive.end();ok(true,kind+': current scoped actor can perform authorized positive operation');
  if(scoped){const c=await staff();const m=(await q('select revision from outreach_team_members where id=$1',[outside.id])).rows[0];await assert.rejects(()=>clientOp(c,'review_age',{member_id:outside.id,revision:m.revision,age:32,reason:'Synthetic outside-scope denial'}),e=>e.code==='42501');await c.end();ok(true,kind+': department grant does not become organization-wide');}
  const before=(await q('select age,guardian_member_id,revision,updated_at from outreach_team_members where id=$1',[person.id])).rows[0],audit=(await q('select count(*)::int n from outreach_team_history')).rows[0].n;
  const holder=await db.connect(),waiting=await staff();let released=false;
  try{
   await holder.query('begin');await holder.query('select id from outreach_campaigns where id=$1 for update',[campaign]);
   const params=kind==='person_affiliation'?[org,target.person,department]:[org,viewer,permission];
   const update=kind==='person_affiliation'?'update person_department_affiliations set expires_at=clock_timestamp()+interval \'1500 milliseconds\' where organization_id=$1 and person_id=$2 and department_id=$3':'update organization_staff_permissions set expires_at=clock_timestamp()+interval \'1500 milliseconds\' where organization_id=$1 and user_id=$2 and permission=$3';
   const expired=kind==='person_affiliation'?'select clock_timestamp()>expires_at expired from person_department_affiliations where organization_id=$1 and person_id=$2 and department_id=$3':'select clock_timestamp()>expires_at expired from organization_staff_permissions where organization_id=$1 and user_id=$2 and permission=$3';
   await q(update,params);const pending=clientOp(waiting,action,await payload()).then(v=>({v}),e=>({e}));
   let blocked=false;for(let i=0;i<100;i++){if((await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[waiting.processID])).rows[0]?.blocked){blocked=true;break}await new Promise(r=>setTimeout(r,10))}ok(blocked,kind+': authorized RPC observed waiting on campaign lock');
   let passed=false;for(let i=0;i<120;i++){if((await q(expired,params)).rows[0].expired){passed=true;break}await new Promise(r=>setTimeout(r,20))}ok(passed,kind+': database clock passed dependency expiry while lock stayed held');
   await holder.query('commit');released=true;const result=await pending;ok(result.e?.code==='42501',kind+': dependency expiry denies original waiting request');
   const context=(await clientOp(waiting,'context')).rows[0].v;ok(context.capabilities.includes('team.manage'),kind+': independent event team.manage remains current');
   const after=(await q('select age,guardian_member_id,revision,updated_at from outreach_team_members where id=$1',[person.id])).rows[0];assert.deepEqual(after,before);ok(true,kind+': denied review changes no member value/revision/timestamp');
   ok((await q('select count(*)::int n from outreach_team_history')).rows[0].n===audit,kind+': denied review creates no successful P1 audit');
  }finally{if(!released)await holder.query('rollback').catch(()=>{});await waiting.end();await holder.end()}
 }
 await run('people_read_grant','people.read');await run('people_update_grant','people.update');await run('household_grant','households.read');await run('department_update_grant','people.update',true);await run('person_affiliation',null,true);
 await as(viewer);for(const sql of["select private.outreach_team_permission_now($1,'people.read')","select private.outreach_team_person_permission_now($1,$2,'people.read')"]){await assert.rejects(()=>q(sql,sql.includes('$2')?[org,target.person]:[org]),e=>e.code==='42501');ok(true,'new live permission helper has no client execute grant');}
 console.log(n+' native scoped dependency expiry/permission checks passed');
}finally{await db.close()}
