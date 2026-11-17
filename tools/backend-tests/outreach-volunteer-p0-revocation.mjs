// Independent P0 review against its ACTUAL migration, using three native local
// PostgreSQL sessions. No real account, provider call or hosted resource.
import assert from'node:assert/strict';import{fixture}from'./outreach-team-travel.fixture.mjs';
if(!process.env.MINDEN_P0_MIGRATION)throw Error('Set MINDEN_P0_MIGRATION to the actual P0 migration');
const f=await fixture(true),{db,q,owner}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
try{
 const row=(await q("select s.* from outreach_volunteer_settings s join outreach_campaigns c on c.id=s.campaign_id where c.code='minden_la_2026'")).rows[0];
 ok(row.enabled===false,'actual P0 candidate begins with intake disabled');
 const holder=await db.connect(),waiter=await db.connect();await holder.query('begin');await holder.query('select campaign_id from outreach_volunteer_settings where campaign_id=$1 for update',[row.campaign_id]);
 await waiter.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await waiter.query('set role authenticated');
 const attempt=waiter.query("select public.outreach_volunteer_workspace('settings',$1) v",[{revision:row.revision,enabled:true}]).then(v=>({v}),e=>({e}));
 let blocked=false;for(let i=0;i<100;i++){const s=await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[waiter.processID]);if(s.rows[0]?.blocked){blocked=true;break}await new Promise(r=>setTimeout(r,10));}
 ok(blocked,'independent settings request is observed waiting on the settings row lock');
 await q("update organization_staff_permissions set revoked_at=clock_timestamp() where user_id=$1 and permission='staff.manage'",[owner]);
 await holder.query('commit');const result=await attempt;await holder.end();await waiter.end();
 ok(result.e?.code==='42501','current owner permission revocation denies settings request after lock');
 const after=(await q('select * from outreach_volunteer_settings where campaign_id=$1',[row.campaign_id])).rows[0];
 ok(after.enabled===false&&after.revision===row.revision,'revoked request cannot enable intake or advance revision');
 ok((await q("select count(*)::int n from outreach_campaign_audit where campaign_id=$1 and kind='volunteer.intake.settings'",[row.campaign_id])).rows[0].n===0,'denied settings request records no successful configuration change');
 console.log(n+' independent native P0 blocked-settings/revocation checks passed');
}finally{await db.close()}
