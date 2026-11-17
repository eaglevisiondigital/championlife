// Three native local PostgreSQL sessions; observe the RPC waiting across expiry.
// Synthetic staff only. No production URL, account, grant or hosted operation.
import assert from'node:assert/strict';import{fixture}from'./outreach-team-travel.fixture.mjs';
const f=await fixture(true),{db,q,campaign,owner,travel}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
async function expiry(kind,actor){
 await db.exec('reset role');await q('update organization_staff_directory set expires_at=null where user_id=any($1::uuid[])',[[owner,travel]]);await q("update organization_staff_permissions set expires_at=null where user_id=$1 and permission='staff.manage'",[owner]);
 const holder=await db.connect(),waiter=await db.connect();let released=false;
 try{
  await holder.query('begin');await holder.query('select id from outreach_campaigns where id=$1 for update',[campaign]);
  await q(kind==='grant'?"update organization_staff_permissions set expires_at=clock_timestamp()+interval '1500 milliseconds' where user_id=$1 and permission='staff.manage'":"update organization_staff_directory set expires_at=clock_timestamp()+interval '1500 milliseconds' where user_id=$1",[actor]);
  await waiter.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await waiter.query('set role authenticated');
  const before=(await q('select count(*)::int n from outreach_team_history')).rows[0].n,label='Synthetic expired '+kind;
  const attempt=waiter.query("select public.outreach_team_workspace('vehicle_save',$1,$2) v",[campaign,{label,vehicle_type:'Synthetic',total_capacity:2,passenger_capacity:1}]).then(v=>({v}),e=>({e}));
  let blocked=false;for(let i=0;i<100;i++){const state=await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[waiter.processID]);if(state.rows[0]?.blocked){blocked=true;break}await new Promise(r=>setTimeout(r,10));}
  ok(blocked,kind+' expiry: independent authorized RPC observed waiting on campaign lock');
  let expired=false;for(let i=0;i<150;i++){if((await q(kind==='grant'?"select clock_timestamp()>expires_at expired from organization_staff_permissions where user_id=$1 and permission='staff.manage'":"select clock_timestamp()>expires_at expired from organization_staff_directory where user_id=$1",[actor])).rows[0].expired){expired=true;break}await new Promise(r=>setTimeout(r,20));}
  ok(expired,kind+' expiry: database wall clock passed expiry while lock remained held');
  await holder.query('commit');released=true;const result=await attempt;
  ok(result.e?.code==='42501',kind+' expiry: post-lock gate denies42501 within the original request');
  ok((await q('select count(*)::int n from outreach_team_vehicles where label=$1',[label])).rows[0].n===0,kind+' expiry: denied request creates no vehicle');
  ok((await q('select count(*)::int n from outreach_team_history')).rows[0].n===before,kind+' expiry: denied request creates no successful audit');
 }finally{if(!released)await holder.query('rollback').catch(()=>{});await waiter.end();await holder.end()}
}
try{await expiry('grant',owner);await expiry('directory',travel);console.log(n+' native current-clock staff expiry checks passed');}finally{await db.close()}
