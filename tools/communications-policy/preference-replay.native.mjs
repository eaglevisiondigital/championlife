// Disposable native PostgreSQL and fictional callback fixtures only. No provider,
// credentials, network listener, send, real consent or hosted migration is used.
import assert from 'node:assert/strict';
import {execFileSync,execFile,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {f,h,fixtureSQL,activationFixtureSQL} from '../backend-tests/activation-fixture.mjs';
import {verifiedProviderEvent} from '../../supabase/functions/_shared/communications/activation.mjs';
const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-preference-')),data=join(root,'data'),socket=join(root,'socket');mkdirSync(socket);
const exe=n=>join(bin,n),args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55509','-U','postgres','postgres'];
const sql=s=>execFileSync(exe('psql'),args,{input:s,encoding:'utf8',maxBuffer:8e6,stdio:['pipe','pipe','pipe']}).trim();
const asyncSql=s=>new Promise((resolve,reject)=>{const p=execFile(exe('psql'),args,{encoding:'utf8',maxBuffer:8e6},(e,out)=>e?reject(e):resolve(out.trim()));p.stdin.end(s)});
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
let started=false,checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const deny=async(fn,label)=>{await assert.rejects(fn);checks++;console.log('PASS '+label)};
const migration='20261106071632_communications_preference_replay_binding.sql';
const read=name=>readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const callSQL=(action,p,org=f.org)=>`set role service_role;select communications_provider_service(${lit(action)},${lit(org)},${lit(JSON.stringify(p))});`;
const service=(action,p,org)=>JSON.parse(sql(callSQL(action,p,org)));
const core=(p,org=f.org)=>JSON.parse(sql(`set role service_role;select communications_service('keyword',${lit(org)},${lit(JSON.stringify(p))});`));
const scalar=q=>{const value=sql(q);return value==='t'?true:value==='f'?false:JSON.parse(value)};
const ledger=()=>scalar(`select coalesce(jsonb_agg(to_jsonb(k) order by organization_id,event_id),'[]'::jsonb) from communication_keyword_events k`);
const auditCount=()=>Number(sql("select count(*) from communication_audit where kind='preference.keyword'"));
const suppressed=address=>scalar(`select coalesce(bool_or(active),false) from communication_suppressions where channel='sms' and address=${lit(address)} and reason='stop'`);
const mutations=()=>scalar(`select jsonb_build_object('consents',(select jsonb_agg(to_jsonb(c) order by id) from communication_consents c),'outbox',(select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from communication_outbox m),'attempts',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from communication_attempts a))`);
try{
 execFileSync(exe('initdb'),['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
 execFileSync(exe('pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p 55509 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
 sql(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 sql(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const file of migrationOrder)sql(read(file));sql(fixtureSQL+activationFixtureSQL);
 for(const file of ['20261101214121_communications_receipt_reconciliation.sql','20261101231457_communications_callback_context.sql','20261102150100_communications_resend_source.sql','20261102154214_communications_resend_host_lookup.sql','20261102193138_communications_resend_suppressed.sql'])sql(read(file));
 // All outbound flags stay false. Only fictional metadata enables the uninstalled
 // callback contract; this is not a real SMS source or signed-provider acceptance.
 sql(`update communication_sender_profiles set channel='sms',provider='sms_transport',from_address='+15555550100',reply_to=null where id='${h.profile}';update communication_provider_controls set structured_callbacks=true where profile_id='${h.profile}';`);
 const profile=service('profile',{id:h.profile});
 const binding={profile_id:h.profile,organization_id:f.org,environment:'acceptance',project_ref:h.ref,provider:'sms_transport',from:profile.sender.from_address,reply_to:null};
 const normalize=async(id,keyword,address,p=profile,b=binding)=>{
  const n=await verifiedProviderEvent('{}',new Headers(),p,b,async()=>({type:'preference',event_id:id,keyword,address,provider:'sms_transport'}));return{id:p.profile_id,...n.payload};
 };
 const first=await normalize('fictional-replay','STOP','+15555550111');
 const candidate=read(migration),old=scalar("select to_jsonb(p) from pg_proc p where oid='private.comm_service(text,uuid,jsonb)'::regprocedure");
 sql(`insert into communication_keyword_events(organization_id,event_id,keyword) values('${f.org}','fictional-legacy','STOP')`);
 const legacyBefore=ledger();
 if(process.env.REPRODUCE_PRIOR!=='1'){
  for(const drift of [
   'grant execute on function private.comm_service(text,uuid,jsonb) to authenticated;',
   'grant select on communication_keyword_events to anon;',
   'grant truncate on communication_keyword_events to authenticated;',
   'alter table communication_keyword_events disable row level security;',
   "create or replace function private.comm_external_lock(o uuid) returns void language sql security definer set search_path='' as $$select null::void$$;",
   "create or replace function private.comm_service(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin return '{}'::jsonb;end $$;"
  ])await deny(async()=>sql('begin;'+drift+candidate),'installation rejects dependency/access drift and rolls back');
  eq(sql("select count(*) from information_schema.columns where table_name='communication_keyword_events' and column_name='receipt_binding'"),'0','rejected installation leaves no partial metadata column');
  sql(candidate);
  const after=scalar("select to_jsonb(p) from pg_proc p where oid='private.comm_service(text,uuid,jsonb)'::regprocedure");
  for(const key of ['oid','proowner','proacl','prosecdef','proconfig','proargtypes','prorettype'])eq(after[key],old[key],'existing function '+key+' preserved');
  eq(ledger().map(({receipt_binding,...r})=>r),legacyBefore,'historical rows preserved without invented provenance');
 }
 eq(service('keyword_external',first),{keyword:'STOP',consent_granted:false},'new authenticated-context STOP accepted');
 eq(suppressed('+15555550111'),true,'original recipient stopped');
 const beforeReplayAudit=auditCount();
 eq(service('keyword_external',first),{duplicate:true},'exact context replay idempotent');
 eq(auditCount(),beforeReplayAudit,'exact replay has no duplicate audit');
 for(const changed of [await normalize('fictional-replay','STOP','+15555550222'),await normalize('fictional-replay','START','+15555550111'),await normalize('fictional-replay','HELP','+15555550111')]){
  const before=ledger();await deny(async()=>service('keyword_external',changed),'conflicting recipient/keyword must not be acknowledged duplicate');eq(ledger(),before,'conflict preserves exact ledger');
 }
 eq(suppressed('+15555550222'),false,'rejected recipient conflict causes no hidden mutation');
 eq(suppressed('+15555550111'),true,'rejected START cannot clear original STOP');
 await deny(async()=>service('keyword_external',await normalize('fictional-legacy','STOP','+15555550111')),'legacy unbound event is held rather than silently adopted');
 for(const context of [{...first.callback_context,from_address:'+15555550999'},{...first.callback_context,organization_id:f.other},null])await deny(async()=>service('keyword_external',{...first,callback_context:context}),'current outer profile context remains mandatory');
 await deny(async()=>service('keyword_external',{...first,provider:'smtp_transport'}),'provider mismatch denied');
 await deny(async()=>service('keyword_external',first,f.other),'cross-organization profile denied');
 // A second valid source profile still cannot reuse this ledger identity.
 const otherProfile='ffffffff-ffff-4fff-8fff-ffffffffffa2';
 sql(`insert into communication_sender_profiles(id,organization_id,channel,provider,display_name,from_address,active,approved_at)values('${otherProfile}','${f.org}','sms','sms_transport','Fictional alternate','+15555550300',false,now());insert into communication_provider_controls(profile_id,organization_id,environment,project_ref,provider_name,structured_callbacks)values('${otherProfile}','${f.org}','acceptance','${h.ref}','Fictional alternate',true);`);
 const other=service('profile',{id:otherProfile}),otherBinding={...binding,profile_id:otherProfile,from:other.sender.from_address};
 await deny(async()=>service('keyword_external',await normalize('fictional-replay','STOP','+15555550111',other,otherBinding)),'valid different profile cannot alias an event');
 // Current sender rotation is valid for NEW events, not a way to reinterpret old ones.
 sql(`update communication_sender_profiles set from_address='+15555550400' where id='${h.profile}'`);
 const rotated=service('profile',{id:h.profile}),rotatedBinding={...binding,from:rotated.sender.from_address};
 await deny(async()=>service('keyword_external',await normalize('fictional-replay','STOP','+15555550111',rotated,rotatedBinding)),'current changed sender context cannot rewrite old event');
 sql(`update communication_sender_profiles set from_address=${lit(binding.from)} where id='${h.profile}'`);
 const immutableState=mutations();
 sql(`insert into communication_suppressions(organization_id,channel,address,reason) values('${f.org}','sms','+15555550111','admin')`);
 eq(service('keyword_external',await normalize('fictional-start','START','+15555550111')),{keyword:'START',consent_granted:false},'new START retains original no-consent semantics');
 eq(suppressed('+15555550111'),false,'new START clears STOP only');
 eq(scalar(`select active from communication_suppressions where address='+15555550111' and reason='admin'`),true,'START preserves other suppression reasons');
 eq(service('keyword_external',await normalize('fictional-help','HELP','+15555550111')),{keyword:'HELP',consent_granted:false},'new HELP preserved');
 eq(mutations(),immutableState,'all preference transitions leave consent/outbox/attempt rows exact');
 // The existing acceptance-sink route is protected too, using its own binding.
 const sink={event_id:'fictional-sink',keyword:'UNSUBSCRIBE',channel:'email',address:'  A@EXAMPLE.TEST  '};
 eq(core(sink),{keyword:'UNSUBSCRIBE',consent_granted:false},'existing sink unsubscribe preserved');
 eq(core({...sink,address:'a@example.test'}),{duplicate:true},'canonical same recipient replay preserved');
 await deny(async()=>core({...sink,address:'b@example.test'}),'sink changed recipient conflicts');
 await deny(async()=>core({event_id:'fictional-replay',keyword:'STOP',channel:'sms',address:'+15555550111'}),'sink route cannot alias external profile receipt');
 for(const bad of [{keyword:null},{channel:null},{address:null},{event_id:123},{address:15555550111},{provider:123},{provider:null},{provider:'unaccepted'}, {callback_context:{raw:'PRIVATE-CONTENT'}},{keyword:'UNSUBSCRIBE',channel:'sms'},{keyword:'STOP',channel:'email'},{address:'invalid'},{event_id:'bad\nID'}]){
  const before=ledger();await deny(async()=>core({...sink,event_id:'bad-input',...bad}),'malformed preference rejected before recording');eq(ledger(),before,'invalid input leaves no event');
 }
 // Direct service calls cannot bypass the external wrapper's source context or
 // store arbitrary provider metadata, even under its existing privileged role.
 for(const bad of [{...first,callback_context:{...first.callback_context,raw:'PRIVATE-CONTENT'}},
  {...first,callback_context:null},{...first,id:otherProfile},{...first,provider:'acceptance_sink'},
  {...first,callback_context:{...first.callback_context,organization_id:f.other}}]){
  await deny(async()=>core({...bad,channel:'sms'}),'low-level service rejects forged external context');
 }
 eq(JSON.stringify(ledger()).includes('PRIVATE-CONTENT'),false,'ledger retains no arbitrary metadata');
 // Cross-organization event IDs remain isolated; the same ID is not a global
 // permission or a lookup into another organization's recipient preferences.
 sql(`insert into communication_settings(organization_id) values('${f.other}') on conflict do nothing`);
 eq(core({...sink,address:'other@example.test'},f.other),{keyword:'UNSUBSCRIBE',consent_granted:false},'other organization may independently record its own event ID');
 eq(Number(sql(`select count(*) from communication_keyword_events where event_id='fictional-sink'`)),2,'organization-specific event keys preserved');
 // A suppressed/audit write failure rolls back the newly inserted replay binding.
 sql("create function public.fail_fixture_preference_audit() returns trigger language plpgsql as $$begin if new.kind='preference.keyword' then raise exception 'fictional audit failure';end if;return new;end$$;create trigger fail_fixture_preference_audit before insert on communication_audit for each row execute function public.fail_fixture_preference_audit();");
 const preFailure=ledger();await deny(async()=>service('keyword_external',await normalize('fictional-audit-fail','STOP','+15555550555')),'audit failure rolls back preference and receipt');eq(ledger(),preFailure,'audit rollback preserves ledger');eq(suppressed('+15555550555'),false,'audit rollback preserves suppression');sql('drop trigger fail_fixture_preference_audit on communication_audit;drop function public.fail_fixture_preference_audit();');
 // Real separate-session lock waits before two identical/conflicting deliveries.
 for(const conflict of [false,true]){
  const id='fictional-race-'+conflict,p1=await normalize(id,'STOP','+15555550666'),p2=await normalize(id,'STOP',conflict?'+15555550777':'+15555550666');
  const holder=spawn(exe('psql'),args,{stdio:['pipe','pipe','pipe']});
  const locked=new Promise((resolve,reject)=>{holder.stdout.on('data',d=>{if(d.toString().includes('LOCKED'))resolve()});holder.on('error',reject);holder.on('exit',code=>{if(code)reject(Error('lock holder failed'))})});
  holder.stdin.write(`begin;select private.comm_lock('${f.org}');select 'LOCKED';\n`);await locked;
  const before=auditCount();
  const a=asyncSql(`set application_name='preference-race-a';`+callSQL('keyword_external',p1)),b=asyncSql(`set application_name='preference-race-b';`+callSQL('keyword_external',p2));
  const joined=Promise.allSettled([a,b]);
  let waiting=0;try{for(let i=0;i<100;i++){waiting=Number(sql("select count(*) from pg_stat_activity where application_name in ('preference-race-a','preference-race-b') and wait_event_type='Lock'"));if(waiting===2)break;await new Promise(r=>setTimeout(r,10))}eq(waiting,2,'both native callbacks wait on canonical organization lock');}finally{holder.stdin.end('commit;\n\\q\n')}
  const results=await joined;
  eq(results.filter(r=>r.status==='fulfilled').length,conflict?1:2,'concurrent committed outcome count');
  eq(results.filter(r=>r.status==='rejected').length,conflict?1:0,'concurrent conflicting replay rejection count');
  if(!conflict)eq(results.map(r=>JSON.parse(r.value).duplicate===true).filter(Boolean).length,1,'identical concurrent replay is duplicate once');
  eq(auditCount(),before+1,'concurrent deliveries append one canonical preference audit');
  eq(Number(sql(`select count(*) from communication_keyword_events where event_id=${lit(id)}`)),1,'concurrent deliveries persist one bound receipt');
 }
 // The separately callable low-level service must share global-before-org
 // ordering with profile control changes, not validate a stale context locally.
 {
  const p={...await normalize('fictional-global-wait','STOP','+15555550888'),channel:'sms'};
  const holder=spawn(exe('psql'),args,{stdio:['pipe','pipe','pipe']});
  const locked=new Promise((resolve,reject)=>{holder.stdout.on('data',d=>{if(d.toString().includes('LOCKED'))resolve()});holder.on('error',reject);holder.on('exit',code=>{if(code)reject(Error('global holder failed'))})});
  holder.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('communications:external-control',0));select 'LOCKED';\n`);await locked;
  const before=ledger(),attempt=asyncSql(`set application_name='preference-global-wait';set role service_role;select communications_service('keyword','${f.org}',${lit(JSON.stringify(p))});`),joined=Promise.allSettled([attempt]);
  let waiting=0;try{for(let i=0;i<100;i++){waiting=Number(sql("select count(*) from pg_stat_activity where application_name='preference-global-wait' and wait_event_type='Lock'"));if(waiting===1)break;await new Promise(r=>setTimeout(r,10))}eq(waiting,1,'direct external preference waits for global authority lock');}finally{holder.stdin.end("update communication_external_control set project_ref='aaaaaaaaaaaaaaaaaaaa';commit;\n\\q\n")}
  eq((await joined)[0].status,'rejected','changed global context after wait denies preference');eq(ledger(),before,'post-wait rejection records no preference');
  sql(`update communication_external_control set project_ref='${h.ref}'`);
 }
 eq(scalar("select external_enabled from communication_external_control"),false,'global outbound remains disabled');
 eq(scalar("select bool_or(enabled) from communication_provider_controls"),false,'all provider controls remain disabled');
 for(const role of ['anon','authenticated']){
  await deny(async()=>sql(`set role ${role};select communications_service('keyword','${f.org}','{}');`),role+' cannot submit core receipt');
  await deny(async()=>sql(`set role ${role};select communications_provider_service('keyword_external','${f.org}','{}');`),role+' cannot submit provider receipt');
  await deny(async()=>sql(`set role ${role};select * from communication_keyword_events;`),role+' cannot read private receipt bindings');
 }
 const receipt=ledger().find(r=>r.event_id==='fictional-replay').receipt_binding;
 eq(JSON.stringify(receipt).includes('+15555550111'),false,'ledger omits raw recipient');
 eq(Object.keys(receipt).sort(),['channel','keyword','recipient_sha256','provider','context_sha256'].sort(),'receipt metadata uses exact whitelist');
 eq(scalar("select count(*) from communication_outbox"),0,'no provider test outbox created');
 console.log(JSON.stringify({status:'PASS',checks,migration,hostedAcceptance:false,realSending:false,automaticRetry:false}));
}finally{if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(root,{recursive:true,force:true});}
