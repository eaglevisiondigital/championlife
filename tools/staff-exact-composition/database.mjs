// Browser fixture only: exact approved SQL, fictional Auth and explicitly separate permissions.
import {PGlite} from '../backend-tests/node_modules/@electric-sql/pglite/dist/index.js';
import {baseline,seed,as,call,create,id} from '../forms-core/fixture.mjs';
import {source,original} from './source.mjs';
export async function database(){
 const db=new PGlite();await baseline(db);await db.exec(original('forms','supabase/migrations/20261104042117_forms_private_draft_core.sql').toString());await db.exec(original('events','tools/church-events/fixtures/20260928183137_events_calendar_v1.sql').toString());await db.exec(source('dream','supabase/migrations/20261104042141_dream_team_manual_followup.sql').toString());
 const{org,other}=await seed(db);await db.exec('reset role');await db.query('delete from organization_staff_permissions where user_id=$1',[id(2)]);
 for(const n of[2,3]){await db.query("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional composition')",[other,id(n)]);await db.query("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'events.manage')",[other,id(n)])}
 for(const p of['forms.read','forms.edit','people.read','followup.read','followup.manage','dream_team.application.read','dream_team.application.restricted'])await db.query('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,id(3),p]);
 await as(db,1);const form=(await call(db,org,'create',{...create('six-head-private'),name:'Exact Forms private'})).form.id;
 await as(db,2);const event=(await db.query('select public.events_workspace($1,$2,$3) v',[other,'save',JSON.stringify({title:'Exact Events private',local_start:'2026-12-01T10:00',local_end:'2026-12-01T11:00',visibility:'staff',status:'draft'})])).rows[0].v.id;
 await db.exec('reset role');await db.exec('alter table organization_people disable trigger user');await db.query('insert into private.people(id)values($1)',[id(102)]);await db.query("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'Exact Dream','Fictional')",[id(102),org]);await db.exec('alter table organization_people enable trigger user');await db.query("insert into portal_account_links(organization_id,person_id,user_id,verification_note)values($1,$2,$3,'Fictional verified fixture only')",[org,id(102),id(2)]);await db.query("insert into private.dream_team_applications(id,organization_id,user_id,person_id,form_version,status,answers,available_reason)values($1,$2,$3,$4,'dream-team-v1-20261002','submitted',$5,'manual_fixture')",[id(202),org,id(2),id(102),JSON.stringify({id_11:{first_11:'RESTRICTED FICTIONAL ANSWER'}})]);
 let queue=Promise.resolve();const serial=fn=>{const n=queue.then(fn,fn);queue=n.catch(()=>{});return n};const calls=[];
 const restore=async()=>serial(async()=>{await db.exec('reset role');await db.query('update organization_staff_permissions set revoked_at=null where user_id=$1',[id(3)])});
 return{org,other,form,event,calls,users:[1,2,3].map(n=>({id:id(n),email:`six-head-${n}@example.test`,email_confirmed_at:'2026-11-01T00:00:00Z',is_anonymous:false})),
 rpc:({name,args={},user})=>serial(async()=>{const n=[1,2,3].find(n=>id(n)===user);await as(db,n||0,n?'authenticated':'anon');calls.push({name,args,user});try{let q;
 if(name==='forms_workspace')q=await db.query('select public.forms_workspace($1,$2,$3)v',[args.p_action,args.p_org,JSON.stringify(args.p_payload||{})]);
 else if(name==='events_workspace')q=await db.query('select public.events_workspace($1,$2,$3)v',[args.p_org,args.p_action,JSON.stringify(args.p_data||{})]);
 else if(name==='dream_team_manual_followup')q=await db.query('select public.dream_team_manual_followup($1,$2,$3)v',[args.p_org,args.p_action,JSON.stringify(args.p_data||{})]);
 else if(name==='staff_workspace_context')q=await db.query('select public.staff_workspace_context()v');
 else if(name==='outreach_registration_workspace')q=await db.query('select public.outreach_registration_workspace($1,$2,$3)v',[args.p_action,args.p_campaign,JSON.stringify(args.p_payload||{})]);
 else return{error:{code:'42501',message:'Unavailable fixture RPC'},status:403};return{data:q.rows[0].v,error:null};
 }catch(e){return{error:{code:e.code,message:e.message},status:e.code==='42501'?403:400}}}),
 restore,revokeDream:()=>serial(async()=>{await db.exec('reset role');await db.query("update organization_staff_permissions set revoked_at=clock_timestamp()where user_id=$1 and permission='dream_team.application.restricted'",[id(3)])}),
 async close(){await queue;await db.close()}};
}
