// Private loopback operator package. NEVER publish. Fictional Auth; actual disposable PostgreSQL RPCs.
import {createServer} from 'node:http';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {fixture,source} from './church-fixture.mjs';
const {baseline,seed,id}=await fixture();

import {session} from '../partner-staff-cycle16/browser-fixture.mjs';
export async function start(){
 const root=new URL('../../',import.meta.url),db=await localPostgres();let server;
 try{
 await baseline(db);await db.exec(source('forms','supabase/migrations/20261104042117_forms_private_draft_core.sql').toString());await db.exec(source('events','tools/church-events/fixtures/20260928183137_events_calendar_v1.sql').toString());
 const {org,other}=await seed(db);await db.query('delete from organization_staff_permissions where user_id=$1',[id(2)]);
 for(const [who,o,permissions]of [[id(2),org,['events.view','events.manage']],[id(3),org,['forms.read','forms.create','forms.edit','events.view','events.manage']],[id(3),other,['forms.read','forms.create','forms.edit','events.view','events.manage']]]){
 if(o===other)await db.query("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional Church operator')",[o,who]);
 for(const permission of permissions)await db.query('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[o,who,permission]);
 }
 const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
 const roles={church:id(3),forms:id(1),events:id(2)},retired=new Set(),files=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
 const state={calls:[],loseNextSave:false,loseNextFormSave:false,failNextFormSave:false,holdNextSave:false,pending:null};let address;
 const rpc=async(who,name,args)=>{const c=await db.connect();try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await c.query('set role authenticated');let r;
 if(name==='staff_workspace_context')r=await c.query('select staff_workspace_context() v');
 else if(name==='forms_workspace')r=await c.query('select forms_workspace($1,$2,$3) v',[args.p_action,args.p_org,args.p_payload||{}]);
 else if(name==='outreach_registration_workspace')r=await c.query('select outreach_registration_workspace($1,$2,$3) v',[args.p_action,args.p_campaign,args.p_payload||{}]);
 else if(name==='events_workspace')r=await c.query('select events_workspace($1,$2,$3) v',[args.p_org,args.p_action,args.p_data||{}]);
 else return{status:403,data:{code:'42501',message:'Local module unavailable'}};
 return{status:200,data:r.rows[0].v};}catch(e){return{status:e.code==='42501'?403:400,data:{code:e.code,message:e.message}}}finally{await c.end()}};
 server=createServer(async(req,res)=>{try{
 if(req.headers.host!==address||(req.headers.origin&&req.headers.origin!=='http://'+address)){res.writeHead(403);res.end();return}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const u=new URL(req.url,'http://'+address),p=u.pathname.slice(1),send=(v,type='text/html',status=200)=>{res.writeHead(status,{'Content-Type':type+';charset=utf-8'});res.end(v)},json=(v,status=200)=>send(JSON.stringify(v),'application/json',status);
 if(p==='demo'||p==='')return send('<!doctype html><meta name="viewport" content="width=device-width"><h1>Connected Church operator</h1><p>LOCAL ONLY. Fictional login; actual disposable PostgreSQL persistence. No hosted acceptance. Forms remain private drafts; use only fictional event content.</p>'+Object.keys(roles).map(r=>'<p><a href="/start?role='+r+'">'+r+'</a></p>').join(''));
 if(p==='start'){const r=u.searchParams.get('role');if(!roles[r])return send('Unknown role','text/plain',400);return send('<!doctype html><script>localStorage.setItem("sb-127-auth-token",'+JSON.stringify(JSON.stringify(session(roles[r])) )+');location.replace("/staff-home.html")</script>')}
 if(p==='__sdk')return send(sdk,'text/javascript');
 if(p==='assets/js/supabase-config.js')return send('window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:'http://'+address,publishableKey:'fictional-no-provider-authority'}),'text/javascript');
 if(p.startsWith('auth/')||p.startsWith('rest/')){
 const token=req.headers.authorization?.split(' ')[1];let who;try{who=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub}catch{}
 if(!Object.values(roles).includes(who)||!token?.endsWith('.fictional-signature')||retired.has(token))return json({code:'42501',message:'Fictional identity denied'},401);
 if(p==='auth/v1/user')return json(session(who).user);if(p==='auth/v1/logout'){retired.add(token);return send('','text/plain',204)}
 let raw='';for await(const part of req){raw+=part;if(raw.length>200000)return json({code:'42501'},413)}const args=raw?JSON.parse(raw):{},name=p.split('/').at(-1);state.calls.push({who,name,args});
 if(name==='communications_workspace')return json({organizations:[],campaigns:[],external_delivery_enabled:false});
 if(name==='forms_workspace'&&args.p_action==='save'&&state.failNextFormSave){state.failNextFormSave=false;return json({message:'Fictional interruption before database execution'},502)}
 const result=await rpc(who,name,args);
 if(name==='forms_workspace'&&args.p_action==='save'&&result.status===200&&state.loseNextFormSave){state.loseNextFormSave=false;return json({message:'Fictional lost Forms response after commit'},502)}
 if(name==='events_workspace'&&args.p_action==='save'&&result.status===200&&state.loseNextSave){state.loseNextSave=false;return json({message:'Fictional lost response after commit'},502)}
 return json(result.data,result.status);
 }
 if(!files.has(p))return send('Not in public inventory','text/plain',404);
 let bytes=readFileSync(new URL(p,root));if(p.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.118\.0(?:\/dist\/umd\/supabase\.js)?/g,'/__sdk'));
 return send(bytes,p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.png')?'image/png':'application/octet-stream');
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Local harness error'}));console.error(e)}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));address='127.0.0.1:'+server.address().port;
 return {url:'http://'+address,db,org,other,roles,state,rpc,close:async()=>{await new Promise(r=>server.close(r));await db.close()}};
 }catch(e){if(server)server.close();await db.close();throw e}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const app=await start();console.log('LOCAL_OPERATOR_URL='+app.url+'/demo');await new Promise(r=>{for(const s of ['SIGINT','SIGTERM'])process.once(s,r)});await app.close()}
