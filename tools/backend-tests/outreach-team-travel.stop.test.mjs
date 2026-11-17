// Synthetic local recovery only: no hosted URL, credential, provider or data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './outreach-team-travel.fixture.mjs';
const f=await fixture(),{db,q,as,call,owner}=f;
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label)};
const stop=readFileSync(new URL('../../supabase/release/outreach-team-travel-v1-stop.sql',import.meta.url),'utf8');
const snapshot=async()=>{
 await db.exec('reset role');
 return (await q("select jsonb_build_object('vehicles',(select jsonb_agg(to_jsonb(t) order by id) from outreach_team_vehicles t),'history',(select jsonb_agg(to_jsonb(t) order by id) from outreach_team_history t),'grants',(select jsonb_agg(to_jsonb(t) order by organization_id,user_id,permission) from organization_staff_permissions t),'p0',(select jsonb_agg(to_jsonb(t) order by campaign_id) from outreach_volunteer_settings t)) v")).rows[0].v;
};
try{
 await as(owner);await call('vehicle_save',{label:'Synthetic recovery van',vehicle_type:'Van',total_capacity:3,passenger_capacity:2});
 ok((await call('context')).capabilities.includes('travel.manage'),'verified synthetic owner accesses P1 before recovery stop');
 const before=await snapshot();
 await db.exec(stop);
 await as(owner);
 await assert.rejects(()=>call('context'),e=>e.code==='42501');ok(true,'unchanged authenticated owner subject loses P1 workspace immediately');
 await assert.rejects(()=>q('select public.outreach_team_own()'),e=>e.code==='42501');ok(true,'own portal RPC is stopped with workspace');
 await assert.rejects(()=>q("select private.outreach_team_workspace('context',$1,'{}')",[f.campaign]),e=>e.code==='42501');ok(true,'private entry execution cannot bypass the stopped public wrapper');
 const p0=(await q("select public.outreach_volunteer_workspace('list','{}') v")).rows[0].v;
 ok(p0.settings.enabled===false&&p0.received===0,'P0 owner review and intake configuration remain available and unchanged');
 ok(JSON.stringify(await snapshot())===JSON.stringify(before),'P1 records/audit, staff grants and P0 settings survive access stop byte-for-byte');
 await db.exec(stop);ok(true,'repeated access stop is safe without dropping data or replaying migrations');
 console.log(checks+' Team/travel access-stop recovery checks passed; synthetic local fixtures only');
}finally{await db.close()}
