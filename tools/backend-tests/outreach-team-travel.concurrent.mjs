// Real PostgreSQL independent sessions, disposable Unix socket only. No URL,
// remote credentials, imported records, or production writes are accepted.
import assert from'node:assert/strict';import{fixture}from'./outreach-team-travel.fixture.mjs';
const f=await fixture(true),{db,q,as,call,member,leg,vehicle,qualify,campaign,owner,travel}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
async function client(actor=owner){const c=await db.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await c.query('set role authenticated');return c;}
async function op(c,a,p){return(await c.query('select public.outreach_team_workspace($1,$2,$3) v',[a,campaign,p])).rows[0].v;}
async function race(ops){const clients=await Promise.all(ops.map(()=>client()));try{return await Promise.allSettled(ops.map((fn,i)=>fn(clients[i])))}finally{for(const c of clients)await c.end();}}
try{
 await as(owner);const l=await leg(),v=await vehicle('Synthetic final-seat van',3,2),driver=await member('Synthetic Driver'),first=await member('Synthetic First');await qualify(driver,v);
 await call('assignment_save',{member_id:driver.id,vehicle_id:v,leg_id:l,seat_role:'driver'});await call('assignment_save',{member_id:first.id,vehicle_id:v,leg_id:l,seat_role:'passenger'});
 const applicants=[];for(let i=0;i<8;i++)applicants.push(await member('Synthetic Racer '+i));
 let r=await race(applicants.map(m=>c=>op(c,'assignment_save',{member_id:m.id,vehicle_id:v,leg_id:l,seat_role:'passenger'})));
 ok(r.filter(x=>x.status==='fulfilled').length===1,'eight independent connections allocate the final seat once');
 ok(r.filter(x=>x.status==='rejected').every(x=>x.reason.message==='Vehicle capacity reached'),'seven losers receive capacity denial');
 await db.exec('reset role');ok((await q("select count(*)::int n from outreach_team_vehicle_assignments where vehicle_id=$1 and state<>'cancelled'",[v])).rows[0].n===3,'total occupancy includes driver and remains exactly3');
 await as(owner);const empty=await vehicle('Synthetic reserved-driver van',2,1),l2=await leg('Synthetic reserve leg');
 r=await race(applicants.slice(0,2).map(m=>c=>op(c,'assignment_save',{member_id:m.id,vehicle_id:empty,leg_id:l2,seat_role:'passenger'})));
 ok(r.filter(x=>x.status==='fulfilled').length===1,'driver seat remains reserved when passengers race before driver');
 const va=await vehicle('Synthetic duplicate A',5,4),vb=await vehicle('Synthetic duplicate B',5,4),l3=await leg('Synthetic duplicate leg'),same=applicants[0];
 r=await race([va,vb].map(veh=>c=>op(c,'assignment_save',{member_id:same.id,vehicle_id:veh,leg_id:l3,seat_role:'passenger'})));
 ok(r.filter(x=>x.status==='fulfilled').length===1&&r.filter(x=>x.status==='rejected')[0].reason.code==='23505','same participant cannot win two vehicles on same leg');
 await db.exec('reset role');const current=(await q("select * from outreach_team_vehicle_assignments where member_id=$1 and leg_id=$2 and state<>'cancelled'",[same.id,l3])).rows[0];
 await as(owner);const vc=await vehicle('Synthetic replacement C',5,4),vd=await vehicle('Synthetic replacement D',5,4);
 r=await race([vc,vd].map(veh=>c=>op(c,'assignment_reassign',{assignment_id:current.id,revision:current.revision,vehicle_id:veh,seat_role:'passenger',reason:'Synthetic simultaneous reassignment review'})));
 ok(r.filter(x=>x.status==='fulfilled').length===1&&r.filter(x=>x.status==='rejected')[0].reason.code==='40001','concurrent reassignment yields one replacement and stale loser');
 await db.exec('reset role');ok((await q("select count(*)::int n from outreach_team_vehicle_assignments where member_id=$1 and leg_id=$2 and state<>'cancelled'",[same.id,l3])).rows[0].n===1,'reassignment race preserves one active seat');
 // Hold the shared campaign lock, let a previously permitted RPC wait, then
 // revoke its campaign capability through a separate committed connection.
 const holder=await db.connect();await holder.query('begin');await holder.query('select id from outreach_campaigns where id=$1 for update',[campaign]);
 const waiting=await client(travel),started=op(waiting,'vehicle_save',{label:'Synthetic revoked vehicle',vehicle_type:'Synthetic',total_capacity:2,passenger_capacity:1});
 let caught;const result=started.then(v=>({v}),e=>({e}));
 let blocked=false;for(let i=0;i<100;i++){const s=await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[waiting.processID]);if(s.rows[0]?.blocked){blocked=true;break}await new Promise(r=>setTimeout(r,10));}
 ok(blocked,'revocation test observes the independent RPC blocked on campaign lock');
 await q('update outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[campaign,travel]);
 await holder.query('commit');caught=await result;await holder.end();await waiting.end();
 ok(caught.e?.code==='42501','capability revoked while lock waits is rechecked after lock');
 ok((await q("select count(*)::int n from outreach_team_vehicles where label='Synthetic revoked vehicle'")).rows[0].n===0,'revoked waiting request creates no vehicle');
 console.log(n+' native Team/travel race and revocation checks passed; synthetic fixtures only');
}finally{await db.close()}
