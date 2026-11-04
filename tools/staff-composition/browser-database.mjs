import {PGlite} from '../backend-tests/node_modules/@electric-sql/pglite/dist/index.js';
import {baseline,seed,as,call,create,id} from '../forms-core/fixture.mjs';
import {source} from './source.mjs';
export async function browserDatabase(){
 const db=new PGlite();await baseline(db);
 await db.exec(source('forms','supabase/migrations/20261104042117_forms_private_draft_core.sql').toString());
 await db.exec(source('events','tools/church-events/fixtures/20260928183137_events_calendar_v1.sql').toString());
 const{org,other}=await seed(db);
 await db.exec('reset role');await db.query('delete from organization_staff_permissions where user_id=$1',[id(2)]);
 for(const n of[2,3]){await db.query("insert into organization_staff_directory(organization_id,user_id,display_name) values($1,$2,'Fictional integration')",[other,id(n)]);await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,'events.manage')",[other,id(n)])}
 for(const permission of['forms.read','forms.edit'])await db.query('insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,$3)',[org,id(3),permission]);
 await as(db,1);const form=(await call(db,org,'create',{...create('integration-private'),name:'Integration private form'})).form.id;
 await as(db,2);const event=(await db.query('select public.events_workspace($1,$2,$3) v',[other,'save',JSON.stringify({title:'Integration private event',local_start:'2026-12-01T10:00',local_end:'2026-12-01T11:00',visibility:'staff',status:'draft'})])).rows[0].v.id;
 let queue=Promise.resolve();const serialize=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next};const calls=[];
 return {org,other,form,event,users:[1,2,3].map(n=>({id:id(n),email:`composition-${n}@example.test`})),calls,
 async rpc({name,args={},user}){return serialize(async()=>{
 const n=[1,2,3].find(n=>id(n)===user);await as(db,n||0,n?'authenticated':'anon');calls.push({name,args,user});
 try{let result;
 if(name==='forms_workspace')result=await db.query('select public.forms_workspace($1,$2,$3) v',[args.p_action,args.p_org,JSON.stringify(args.p_payload||{})]);
 else if(name==='events_workspace')result=await db.query('select public.events_workspace($1,$2,$3) v',[args.p_org,args.p_action,JSON.stringify(args.p_data||{})]);
 else if(name==='staff_workspace_context')result=await db.query('select public.staff_workspace_context() v');
 else return {error:{code:'42501',message:'Fixture RPC unavailable'},status:403};
 return {data:result.rows[0].v,error:null};
 }catch(e){return {error:{code:e.code,message:e.message},status:e.code==='42501'?403:400}}
 })},
 async revoke(){return serialize(async()=>{await db.exec('reset role');await db.query("update organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=$1 and user_id=$2 and permission='events.manage'",[other,id(3)])})},
 async restore(){return serialize(async()=>{await db.exec('reset role');await db.query("update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission='events.manage'",[other,id(3)])})},
 async addSecondForms(){return serialize(async()=>{
 await db.exec('reset role');await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,'forms.create')",[other,id(2)]);
 await as(db,2);const second=(await call(db,other,'create',{...create('integration-other-private'),name:'Integration alternate form'})).form.id;
 await db.exec('reset role');await db.query("delete from organization_staff_permissions where organization_id=$1 and user_id=$2 and permission='forms.create'",[other,id(2)]);
 await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,'forms.read')",[other,id(3)]);return second;
 })},
 async close(){await queue;await db.close()}
 };
}
