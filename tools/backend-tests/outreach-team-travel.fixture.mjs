// Entirely synthetic local database. No network URL or production credentials.
import{readFileSync}from'node:fs';import{randomUUID as uuid}from'node:crypto';
import{PGlite}from'@electric-sql/pglite';import{localPostgres}from'./local-postgres.mjs';import{migrationOrder}from'./migration-order.mjs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
export const candidate=read('supabase/release/outreach-team-travel-v1-forward-candidate.sql');
export async function fixture(native=false){
 const db=native?await localPostgres():new PGlite(),q=(s,p=[])=>db.query(s,p);
 try{
  await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
  for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));
  await db.exec(read('supabase/release/dream-track-v1-forward-candidate.sql'));
  await db.exec(process.env.MINDEN_P0_MIGRATION?readFileSync(new URL(process.env.MINDEN_P0_MIGRATION,root),'utf8'):read('tools/backend-tests/fixtures/outreach-volunteer-p0-contract.sql'));
  await db.exec(candidate);
  const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,campaign=uuid(),otherCampaign=uuid(),owner=uuid(),viewer=uuid(),travel=uuid(),outsider=uuid(),unverified=uuid(),learner=uuid();
  const as=async(u,role='authenticated',client=db)=>{await client.exec('reset role');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[u||'']);await client.exec('set role '+role)};
  const call=async(a,p={},c=campaign,client=db)=>(await client.query('select public.outreach_team_workspace($1,$2,$3) v',[a,c,p])).rows[0].v;
  for(const u of[owner,viewer,travel,outsider,unverified,learner])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[u,u+'@example.test',u===unverified?null:new Date()]);
  for(const u of[owner,viewer,travel,unverified])await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic operator')",[org,u]);
  for(const key of['staff.manage','people.read','people.update','households.read','households.manage'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,owner,key]);
  for(const[c,code]of[[campaign,'synthetic_team_travel'],[otherCampaign,'synthetic_other_team']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Synthetic','US','America/Chicago','approved')",[c,org,code]);
  for(const[u,caps]of[[viewer,['view','team.view']],[travel,['view','travel.view','travel.manage','travel.export']],[unverified,['view','team.view','team.manage']]])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'internal_team',$3,'Synthetic scope fixture only')",[campaign,u,caps]);
  const members=[];
  async function member(name='Synthetic',age=30,c=campaign){
   await as(owner);const person=uuid(),application=uuid();
   await db.exec('reset role;alter table public.organization_people disable trigger user');
   await q('insert into private.people(id)values($1)',[person]);await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,$3,'Volunteer')",[person,org,name]);
   await db.exec('alter table public.organization_people enable trigger user');
   await q("insert into outreach_volunteer_applications(id,campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,rv_experience,passenger_names)values($1,$2,$3,$1,'{}',$4,'Volunteer',$5,'Yes','Unverified Alex, Sam')",[application,c,org,name,application+'@example.test']);
   await as(owner);const id=(await call('enroll',{application_id:application,person_id:person,reason:'Synthetic explicit identity verification'},c)).id;
   let revision=1;await call('availability_review',{member_id:id,revision,confirmed:true,reason:'Synthetic availability explicitly reconfirmed'},c);revision++;if(age!==null){await call('review_age',{member_id:id,revision,age,reason:'Synthetic age verified for travel date'},c);revision++;}
   await call('status',{member_id:id,revision,status:'approved',reason:'Synthetic individual approval decision'},c);revision++;
   const value={id,person,application,revision};members.push(value);return value;
  }
  async function leg(label='Outbound',confirmed=false){return(await call('leg_save',{label,itinerary_confirmed:confirmed,...(confirmed?{departure_at:'2026-12-19T08:00:00-06:00',departure_location:'Synthetic departure',destination:'Synthetic destination'}:{})})).id;}
  async function vehicle(label='Synthetic van',total=3,passengers=2){return(await call('vehicle_save',{label,vehicle_type:'Synthetic van',total_capacity:total,passenger_capacity:passengers})).id;}
  async function qualify(m,v,qualified=true,revision=0){return call('driver_review',{member_id:m.id,vehicle_id:v,qualified,revision,reason:'Synthetic qualification independently reviewed'});}
  return{db,q,as,call,member,leg,vehicle,qualify,org,campaign,otherCampaign,owner,viewer,travel,outsider,unverified,learner,members};
 }catch(e){await db.close();throw Object.assign(new Error(e.message),{code:e.code,detail:e.detail,position:e.position,where:e.where});}
}
