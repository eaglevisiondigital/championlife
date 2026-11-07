// Independent synthetic PostgreSQL security review. Run from repository root,
// or set TEST_REPO_ROOT. No hosted connection, verifier, provider or outbound I/O.
import assert from 'node:assert/strict';
import {execFileSync,execFile,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=resolve(process.env.TEST_REPO_ROOT||process.cwd());
const {migrationOrder}=await import(pathToFileURL(join(repo,'tools/backend-tests/migration-order.mjs')));
const {f,h,fixtureSQL,activationFixtureSQL}=await import(pathToFileURL(join(repo,'tools/backend-tests/activation-fixture.mjs')));
const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'preference-independent-')),data=join(dir,'data'),socket=join(dir,'s');mkdirSync(socket);
const exe=n=>join(bin,n),args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55510','-U','postgres','postgres'];
const sql=s=>execFileSync(exe('psql'),args,{input:s,encoding:'utf8',maxBuffer:8e6,stdio:['pipe','pipe','pipe']}).trim();
const asyncSQL=s=>new Promise((res,rej)=>{const p=execFile(exe('psql'),args,{encoding:'utf8',maxBuffer:8e6},(e,out,stderr)=>e?rej(Object.assign(e,{stderr})):res(out.trim()));p.stdin.end(s)});
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const read=p=>readFileSync(join(repo,p),'utf8');
const migration='20261106071632_communications_preference_replay_binding.sql';
const call=(p,{fn='private.comm_service',org=f.org,action='keyword'}={})=>`set role service_role;select ${fn}(${q(action)},${q(org)},${q(JSON.stringify(p))}::jsonb);`;
const invoke=(p,opt)=>JSON.parse(sql(call(p,opt)));
let started=false,checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const fails=(body,label)=>{assert.throws(body);checks++;console.log('PASS '+label)};
const snapshot=()=>JSON.parse(sql(`select jsonb_build_object(${['communication_keyword_events','communication_suppressions','communication_consents','communication_audit','communication_outbox','communication_attempts','communication_provider_controls'].map(t=>`${q(t)},(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${t} t)`).join(',')})`));
const noMutation=(body,label)=>{const before=snapshot();fails(body,label);eq(snapshot(),before,label+' leaves complete state exact')};
const core={event_id:'independent-external',channel:'sms',keyword:'STOP',address:'+15555550121',provider:'sms_transport',id:h.profile};
const context={profile_id:h.profile,organization_id:f.org,environment:'acceptance',project_ref:h.ref,provider:'sms_transport',channel:'sms',from_address:'+15555550100',reply_to:null};
const external={...core,callback_context:context};
const sink={event_id:'independent-sink',channel:'email',keyword:'UNSUBSCRIBE',address:'Review@Example.Test'};
try{
 execFileSync(exe('initdb'),['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
 execFileSync(exe('pg_ctl'),['-D',data,'-l',join(dir,'server.log'),'-o',`-k ${socket} -p 55510 -c listen_addresses='' -c statement_timeout=10000`,'-w','start'],{stdio:'pipe'});started=true;
 sql(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));sql(read('supabase/bootstrap/automatic-rls.sql'));
 for(const name of migrationOrder)sql(read('supabase/migrations/'+name));
 sql(fixtureSQL+activationFixtureSQL);
 for(const name of ['20261101214121_communications_receipt_reconciliation.sql','20261101231457_communications_callback_context.sql','20261102150100_communications_resend_source.sql','20261102154214_communications_resend_host_lookup.sql','20261102193138_communications_resend_suppressed.sql',migration])sql(read('supabase/migrations/'+name));
 sql(`update communication_sender_profiles set channel='sms',provider='sms_transport',from_address='+15555550100',reply_to=null where id='${h.profile}';update communication_provider_controls set structured_callbacks=true where profile_id='${h.profile}';`);
 const initial=snapshot();
 eq(invoke(external),{keyword:'STOP',consent_granted:false},'direct private service applies valid bound preference');
 const afterFirst=snapshot();
 eq(invoke({...external,address:'+1 (555) 555-0121'},{fn:'public.communications_provider_service',action:'keyword_external'}),{duplicate:true},'wrapper recognizes canonical recipient from direct private call');
 // Wrapper records last_callback_at as before; canonical receipt/reducer/audit do not repeat.
 const afterDuplicate=snapshot();delete afterFirst.communication_provider_controls;delete afterDuplicate.communication_provider_controls;
 eq(afterDuplicate,afterFirst,'cross-route exact duplicate preserves every canonical table');
 noMutation(()=>invoke({...external,channel:'email',keyword:'UNSUBSCRIBE',address:'review@example.test',provider:'acceptance_sink',id:undefined,callback_context:undefined}),'same event cannot change channel and recipient through sink');
 for(const key of Object.keys(context)){
  const omitted={...context};delete omitted[key];
  noMutation(()=>invoke({...external,event_id:'missing-'+key,callback_context:omitted}),'private service requires context field '+key);
 }
 for(const value of [null,[],true,7,'text'])noMutation(()=>sql(call(value)),'reject top-level '+JSON.stringify(value));
 for(const patch of [{event_id:''},{event_id:'x'.repeat(201)},{event_id:'x\tvalue'},{address:{}},{channel:[]},{keyword:true},{id:7},{id:'invalid-uuid'},{callback_context:[]},{callback_context:{...context,reply_to:''}},{extra:'x'.repeat(8200)}])noMutation(()=>invoke({...external,...patch}),'reject malformed input '+Object.keys(patch)[0]);
 eq(invoke(sink),{keyword:'UNSUBSCRIBE',consent_granted:false},'independent sink email accepted');
 const beforeCanonical=snapshot();eq(invoke({...sink,address:'  review@example.test  ',provider:'acceptance_sink',callback_context:null}),{duplicate:true},'explicit sink identity and null context equal omitted default');eq(snapshot(),beforeCanonical,'sink canonical duplicate no changes');
 noMutation(()=>invoke({...external,event_id:sink.event_id}),'external profile cannot reinterpret sink event');
 sql(`insert into communication_keyword_events(organization_id,event_id,keyword)values('${f.org}','independent-legacy','STOP')`);
 noMutation(()=>invoke({...external,event_id:'independent-legacy'}),'legacy same keyword cannot acquire proposed context');
 // A valid early operation followed by a conflicting one must roll back everything.
 noMutation(()=>sql('begin;'+call({...external,event_id:'rolled-back-first',address:'+15555550921'})+call({...external,address:'+15555550922'})+'commit;'),'later conflict rolls back earlier preference and audit');
 const beforeRollback=snapshot();sql('begin;'+call({...external,event_id:'explicit-rollback',address:'+15555550923'})+'rollback;');eq(snapshot(),beforeRollback,'explicit rollback removes receipt suppression and audit');
 // Malicious search_path/temp objects cannot replace explicitly qualified canonical tables.
 const beforeShadow=snapshot();sql(`begin;create temporary table communication_keyword_events(event_id text);set search_path=pg_temp,public;${call({...external,event_id:'shadow-rollback'})}rollback;`);eq(snapshot(),beforeShadow,'caller search path cannot redirect canonical receipt transaction');
 for(const role of ['anon','authenticated']){
  for(const fn of ['private.comm_service','public.communications_service','private.comm_provider_service','public.communications_provider_service'])fails(()=>sql(`set role ${role};select ${fn}('keyword','${f.org}','{}');`),role+' denied '+fn);
  for(const op of ['select * from','delete from','truncate'])fails(()=>sql(`set role ${role};${op} communication_keyword_events;`),role+' denied ledger '+op);
  fails(()=>sql(`set role ${role};insert into communication_keyword_events(organization_id,event_id,keyword,receipt_binding)values('${f.org}','forged','STOP','{}');`),role+' denied forged receipt');
 }
 eq(sql("select relrowsecurity from pg_class where oid='communication_keyword_events'::regclass"),'t','ledger RLS remains enabled');
 for(const sig of ['private.comm_provider_service_h1(text,uuid,jsonb)','private.comm_provider_service_receipt_v1(text,uuid,jsonb)'])eq(sql(`select has_function_privilege('service_role',${q(sig)},'execute')`),'f','legacy callable bypass remains revoked '+sig);
 // Prove global-before-org rather than merely observing some advisory wait.
 const holder=spawn(exe('psql'),args,{stdio:['pipe','pipe','pipe']});
 const ready=new Promise((res,rej)=>{holder.stdout.on('data',d=>{if(d.toString().includes('GLOBAL_HELD'))res()});holder.on('error',rej);holder.on('exit',c=>{if(c)rej(Error('global holder exit '+c))})});
 holder.stdin.write("begin;select pg_advisory_xact_lock(hashtextextended('communications:external-control',0));select 'GLOBAL_HELD';\n");await ready;
 const beforeWait=snapshot();
 const attempt=asyncSQL("set application_name='independent-preference-global';"+call({...external,event_id:'revoked-during-wait'}));
 const joined=Promise.allSettled([attempt]);
 try{
  let waiting=false;for(let i=0;i<100;i++){waiting=sql("select exists(select 1 from pg_stat_activity where application_name='independent-preference-global' and wait_event_type='Lock')")==='t';if(waiting)break;await new Promise(r=>setTimeout(r,10))}
  eq(waiting,true,'direct private service waits for global control lock');
  eq(sql(`begin;select pg_try_advisory_xact_lock(hashtextextended('communications:${f.org}',0));rollback;`),'t','global-blocked direct call has not acquired organization lock');
 }finally{holder.stdin.end(`update communication_provider_controls set structured_callbacks=false where profile_id='${h.profile}';commit;\n\\q\n`)}
 const result=(await joined)[0];eq(result.status,'rejected','waiting direct call observes structured callback revocation');
 if(result.status==='rejected')eq(result.reason.stderr.includes('Current preference context required'),true,'post-wait rejection is context freshness failure');
 const afterWait=snapshot();delete beforeWait.communication_provider_controls;delete afterWait.communication_provider_controls;eq(afterWait,beforeWait,'post-wait rejection preserves full canonical state');
 const final=snapshot();eq(final.communication_consents,initial.communication_consents,'all independent cases preserve exact consent');eq(final.communication_outbox,initial.communication_outbox,'all independent cases preserve exact outbox');eq(final.communication_attempts,initial.communication_attempts,'all independent cases preserve exact attempts');
 eq(sql('select external_enabled from communication_external_control'),'f','global sending stays off');eq(sql('select bool_or(enabled) from communication_provider_controls'),'f','all provider sending stays off');
 console.log(JSON.stringify({status:'PASS',checks,migration,syntheticOnly:true,hostedAcceptance:false}));
}finally{if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(dir,{recursive:true,force:true})}
