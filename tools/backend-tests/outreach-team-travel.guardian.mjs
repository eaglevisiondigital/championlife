// Synthetic local regression for guardian correction and complete confirmation.
import assert from'node:assert/strict';import{randomUUID as uuid}from'node:crypto';import{fixture}from'./outreach-team-travel.fixture.mjs';
const f=await fixture(process.env.TEST_NATIVE_PG==='1'),{db,q,as,call,member,leg,vehicle,qualify,campaign,org,owner}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},reject=async(fn,p,m)=>{await assert.rejects(fn,p);ok(true,m)};
const admin=async(s,p=[])=>{await db.exec('reset role');try{return await q(s,p)}finally{await db.exec('set role authenticated')}};
const historyCount=async()=>(await admin('select count(*)::int n from outreach_team_history')).rows[0].n;
const seatRow=async id=>(await admin('select state,revision,confirmed_at,confirmed_by from outreach_team_vehicle_assignments where id=$1',[id])).rows[0];
try{
 const a=await member('Synthetic Guardian A',35),b=await member('Synthetic Guardian B',37),driver=await member('Synthetic Driver',40),minor=await member('Synthetic Minor',12),hh=uuid();
 await admin("insert into households(id,organization_id,name)values($1,$2,'Synthetic shared guardian household')",[hh,org]);
 for(const[p,r]of[[a.person,'adult'],[b.person,'adult'],[minor.person,'child']])await admin('insert into household_members(organization_id,household_id,person_id,relationship)values($1,$2,$3,$4)',[org,hh,p,r]);
 await as(owner);const review=guardian=>call('guardian_review',{member_id:minor.id,revision:minor.revision,guardian_member_id:guardian.id,household_id:hh,reason:'Synthetic explicit legal guardian review'});
 await review(a);minor.revision++;const l=await leg('Synthetic confirmed leg',true),v=await vehicle('Synthetic guardian van',5,4);await qualify(driver,v);
 const assign=m=>call('assignment_save',{member_id:m.id,leg_id:l,vehicle_id:v,seat_role:'passenger'});
 await call('assignment_save',{member_id:driver.id,leg_id:l,vehicle_id:v,seat_role:'driver'});await assign(a);let seat=(await assign(minor)).id;
 let count=await historyCount();await reject(()=>review(b),/Release travel assignments before guardian correction/,'guardian correction refused while minor has assigned travel');
 ok((await admin('select guardian_member_id,revision from outreach_team_members where id=$1',[minor.id])).rows[0].guardian_member_id===a.id,'rejected correction preserves original guardian');
 ok(await historyCount()===count,'rejected correction creates no review audit');
 // Recreate only in the synthetic fixture the legacy state the old RPC allowed:
 // guardian B is reviewed, but has no seat in this vehicle. Do not weaken the RPC.
 await admin('update outreach_team_members set guardian_member_id=$1,revision=revision+1 where id=$2',[b.id,minor.id]);minor.revision++;
 count=await historyCount();await reject(()=>call('assignment_confirm',{assignment_id:seat,revision:1}),/Current travel arrangement requires review/,'complete confirmation gate rejects missing current guardian in same vehicle/leg');
 const failed=await seatRow(seat);ok(failed.state==='assigned'&&failed.revision===1&&failed.confirmed_at===null&&failed.confirmed_by===null,'failed tentative confirmation rolls back state/revision/timestamps');
 ok(await historyCount()===count,'failed confirmation records no successful operation audit');
 await call('assignment_cancel',{assignment_id:seat,revision:1,reason:'Synthetic explicit dependent seat release'});await review(a);minor.revision++;
 ok((await admin('select guardian_member_id from outreach_team_members where id=$1',[minor.id])).rows[0].guardian_member_id===a.id,'guardian review remains available after explicit seat release');
 seat=(await assign(minor)).id;await call('assignment_confirm',{assignment_id:seat,revision:1});
 ok((await call('manifest',{leg_id:l})).find(x=>x.assignment_id===seat).confirmation_valid===true,'legitimate current guardian arrangement still confirms');
 const before=(await admin('select guardian_member_id,revision from outreach_team_members where id=$1',[minor.id])).rows[0];count=await historyCount();
 await reject(()=>review(b),/Release travel assignments before guardian correction/,'guardian correction refused while minor has confirmed travel');
 await reject(()=>review(a),/Release travel assignments before guardian correction/,'even same-guardian correction requires releasing active travel');
 const unchanged=(await admin('select guardian_member_id,revision from outreach_team_members where id=$1',[minor.id])).rows[0];assert.deepEqual(unchanged,before);ok(await historyCount()===count,'rejected confirmed-travel corrections preserve guardian/revision/audit');
 ok((await call('manifest',{leg_id:l})).find(x=>x.assignment_id===seat).confirmation_valid===true,'blocked correction preserves valid existing itinerary');
 await call('assignment_cancel',{assignment_id:seat,revision:2,reason:'Synthetic explicit dependent seat release'});await review(b);minor.revision++;
 await reject(()=>assign(minor),/same vehicle\/leg/,'new guardian must occupy same vehicle before new seat reservation');
 await assign(b);seat=(await assign(minor)).id;await call('assignment_confirm',{assignment_id:seat,revision:1});
 ok((await call('manifest',{leg_id:l})).find(x=>x.assignment_id===seat).confirmation_valid===true,'explicit release/review/reassignment under new guardian succeeds');
 console.log(n+' guardian correction/complete-confirmation checks passed ('+(process.env.TEST_NATIVE_PG==='1'?'native PostgreSQL':'PGlite')+')');
}finally{await db.close()}
