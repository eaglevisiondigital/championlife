// TEST ONLY: loopback + disposable Unix-socket PG, fictional tokens, never genuine Auth.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {installCampaignBaseline} from './campaign-foundation-baseline.mjs';
import {FOUNDATION} from './campaign-assignment-contract.mjs';
const actions=new Set(['context','list','detail','followup_save','learner_status']);
const deny=(code='42501')=>Object.assign(new Error('Synthetic fixture request unavailable'),{code});
export async function createCampaignFoundationTestHost(options={}) {
  assert.deepEqual(Object.keys(options).sort(),options.directory===true?['directory']:[],'fixed optional directory fixture only');
  const withDirectory=options.directory===true;
  const db=await localPostgres();let server;
  try {
    await installCampaignBaseline(db);
    const sql=readFileSync(new URL('../../'+FOUNDATION.migration,import.meta.url),'utf8');
    assert.equal(createHash('sha256').update(sql).digest('hex'),FOUNDATION.sha256,'exact reviewed PR80 SQL');
    await db.exec(sql);
    if(withDirectory) {
      const directorySql=readFileSync(new URL('../../supabase/migrations/20261103114754_campaign_decision_directory.sql',import.meta.url),'utf8');
      assert.equal(createHash('sha256').update(directorySql).digest('hex'),'3118ec4eed4cb1569dfd81b0f7e7bc1850867e876b8d65b4a3c8261cf355166e','exact reviewed directory SQL');
      await db.exec(directorySql);
    }
    const q=(...a)=>db.query(...a),orgId=(await q("select id from organizations where slug='sowgo'")).rows[0].id;
    const foreignOrgId=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
    const campaignId=randomUUID(),otherCampaignId=randomUUID(),foreignCampaignId=randomUUID();
    const users=Object.fromEntries(['worker','other','reader','unverified',...(withDirectory?['registrationOnly','peopleOnly','emptyWorker']:[])].map(key=>[key,{id:randomUUID(),sessionId:randomUUID(),token:randomBytes(32).toString('hex')}]));
    const tokens=new Map(Object.entries(users).map(([key,u])=>[u.token,{...u,key}]));
    for(const [key,u] of Object.entries(users)) {
      await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[u.id,key+'@example.invalid',key==='unverified'?null:new Date()]);
      await q("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[u.sessionId,u.id]);
    }
    for(const [id,org] of [[campaignId,orgId],[otherCampaignId,orgId],[foreignCampaignId,foreignOrgId]]) await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status) values($1,$2,$3,'Synthetic campaign','Synthetic city','US','UTC','approved')",[id,org,'synthetic_'+id.replaceAll('-','_')]);
    await q("insert into outreach_decision_campaign_sources(campaign_id,source) values($1,'synthetic_decision_a'),($2,'synthetic_decision_b'),($3,'synthetic_decision_foreign')",[campaignId,otherCampaignId,foreignCampaignId]);
    for(const [key,u] of Object.entries(users).filter(([key])=>!['registrationOnly','peopleOnly'].includes(key))) await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason) values($1,$2,'local_leader',$3,'assigned',now()-interval '1 hour',now()+interval '1 hour','Synthetic fixture only')",[campaignId,u.id,key==='reader'?['view','decisions.read']:['view','decisions.read','followup.manage']]);
    if(withDirectory) {
      await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason) values($1,$2,'host_pastor',array['view','registration.view'],'Synthetic event-only fixture')",[campaignId,users.registrationOnly.id]);
      await q("insert into organization_staff_directory(organization_id,user_id,display_name) values($1,$2,'Synthetic unrelated People authority')",[orgId,users.peopleOnly.id]);
      for(const capability of ['people.read','outreach.view','followup.manage','staff.manage','finance.read']) await q('insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,$3)',[orgId,users.peopleOnly.id,capability]);
    }
    const records=Object.fromEntries(['a','b','c','readOnly','foreign','mismapped','eventOnly'].map(key=>[key,randomUUID()]));
    const recordDefs=[['a',campaignId,'synthetic_decision_a','worker'],['b',campaignId,'synthetic_decision_a','worker'],['c',campaignId,'synthetic_decision_a','other'],['readOnly',campaignId,'synthetic_decision_a','reader'],['foreign',otherCampaignId,'synthetic_decision_b','worker'],['mismapped',campaignId,'synthetic_decision_b','worker']];
    for(const [key,campaign,source,worker] of recordDefs) {
      await q("insert into outreach_registrations(id,first_name,last_name,email,phone,decision,prayer_request,source,consent) values($1,$2,'Fixture','PRIVATE-CONTACT@example.invalid','15555550123','salvation','PRIVATE-PRAYER',$3,true)",[records[key],'Person '+key.toUpperCase(),source]);
      await q('insert into outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by) values($1,$2,$3,$3)',[records[key],campaign,users[worker].id]);
    }
    await q("insert into outreach_event_registrations(id,campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,source) values($1,$2,$3,$4,'{}','Synthetic','Event','event@example.invalid','15555550124','public')",[records.eventOnly,campaignId,orgId,randomUUID()]);
    const requests=[];
    const queryRpc=async(token,args)=>{
      const user=tokens.get(token);if(!user)throw deny();
      if(!args||Object.getPrototypeOf(args)!==Object.prototype||Object.keys(args).sort().join(',')!=='p_action,p_campaign,p_org,p_payload'||!actions.has(args.p_action))throw deny('22023');
      const entry={userId:user.id,action:args.p_action,organizationId:args.p_org,campaignId:args.p_campaign,payload:structuredClone(args.p_payload),submittedAt:Date.now(),code:null};requests.push(entry);
      const conn=await db.connect();
      try {
        await conn.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user.id,JSON.stringify({sub:user.id,session_id:user.sessionId,exp:Math.floor(Date.now()/1000)+3600})]);
        await conn.query('set role authenticated');
        const result=(await conn.query('select public.campaign_decision_foundation($1,$2,$3,$4) v',[args.p_action,args.p_org,args.p_campaign,args.p_payload])).rows[0].v;
        entry.code='ok';return result;
      }catch(e){entry.code=e.code;throw e}finally{await conn.end()}
    };
    const queryDirectory=async(token,args)=>{
      if(!withDirectory)throw deny('42883');
      const user=tokens.get(token);if(!user)throw deny();
      if(!args||Object.getPrototypeOf(args)!==Object.prototype||Object.keys(args).length)throw deny('22023');
      const entry={userId:user.id,action:'directory',payload:{},submittedAt:Date.now(),code:null};requests.push(entry);
      const conn=await db.connect();
      try {
        await conn.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user.id,JSON.stringify({sub:user.id,session_id:user.sessionId,exp:Math.floor(Date.now()/1000)+3600})]);
        await conn.query('set role authenticated');
        const result=(await conn.query('select public.campaign_decision_directory() v')).rows[0].v;
        entry.code='ok';return result;
      }catch(e){entry.code=e.code;throw e}finally{await conn.end()}
    };
    server=createServer(async(req,res)=>{
      const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
      if(!['/rpc',...(withDirectory?['/directory']:[])].includes(req.url)||req.method!=='POST')return reply(404,{error:{code:'NOT_FOUND'}});
      const origin=req.headers.origin;
      if(origin&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))return reply(403,{error:{code:'42501'}});
      // Test harness should use same-origin routing or node-side rpc(); never widen CORS.
      try {
        let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)throw deny('22023')}
        const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1];
        const result=await (req.url==='/directory'?queryDirectory:queryRpc)(token,JSON.parse(body));reply(200,{data:result,error:null});
      }catch(e){const code=/^[A-Z0-9]{5}$/.test(e.code||'')?e.code:'22023';reply(code==='42501'?403:400,{data:null,error:{code,message:'Request unavailable'}})}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const url='http://127.0.0.1:'+server.address().port;
    const rpc=async(token,args)=>{const response=await fetch(url+'/rpc',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});return result.data};
    const directory=async(token)=>{const response=await fetch(url+'/directory',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});return result.data};
    // Local host-composition discovery only: exact existing read operations, no generic SQL bridge.
    const staffDiscovery=async(token,name)=>{
      const user=tokens.get(token);if(!user)throw deny();
      const queries={staff_workspace_context:'select public.staff_workspace_context() v',outreach_registration_workspace:"select public.outreach_registration_workspace('campaigns',null,'{}') v",forms_workspace:"select public.forms_workspace('context',null,'{}') v",communications_workspace:"select public.communications_workspace('context',null,'{}') v"};
      if(!Object.hasOwn(queries,name))throw deny('22023');
      const conn=await db.connect();try{
        await conn.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user.id,JSON.stringify({sub:user.id,session_id:user.sessionId,exp:Math.floor(Date.now()/1000)+3600})]);await conn.query('set role authenticated');
        return (await conn.query(queries[name])).rows[0].v;
      }finally{await conn.end()}
    };
    const expire=userId=>q("update outreach_campaign_assignments set decision_expires_at=now()-interval '1 minute' where user_id=$1 and decision_effective_at is not null",[userId]);
    const revoke=userId=>q('update outreach_campaign_assignments set active=false where user_id=$1',[userId]);
    const retire=userId=>q("update auth.sessions set not_after=now()-interval '1 minute' where user_id=$1",[userId]);
    const consent=(id,value)=>{assert.equal(typeof value,'boolean');return q('update outreach_registrations set consent=$2 where id=$1',[id,value])};
    const mapSource=value=>{assert.equal(typeof value,'boolean');return q('update outreach_decision_campaign_sources set active=$2 where campaign_id=$1',[campaignId,value])};
    const reset=async()=>{
      await q("update outreach_campaign_assignments set active=true,decision_expires_at=now()+interval '1 hour'");
      await q("update auth.sessions set not_after=now()+interval '1 hour'");
      await q('update outreach_decision_campaign_sources set active=true');
      await q('update outreach_registrations set consent=true');
      for(const [key,, ,worker] of recordDefs)await q('update outreach_decision_followup set assigned_user_id=$2 where registration_id=$1',[records[key],users[worker].id]);
    };
    const seedAssigned=async(count)=>{
      assert.ok(Number.isInteger(count)&&count>0&&count<=100,'bounded synthetic pagination fixture');
      const ids=[];
      for(let i=0;i<count;i++){
        const id=randomUUID();ids.push(id);
        await q("insert into outreach_registrations(id,first_name,last_name,email,phone,decision,source,consent) values($1,$2,'Pagination','pagination@example.invalid','15555550123','salvation','synthetic_decision_a',true)",[id,'Synthetic '+i]);
        await q('insert into outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by) values($1,$2,$3,$3)',[id,campaignId,users.worker.id]);
      }
      return ids;
    };
    return {url,orgId,campaignId,otherCampaignId,foreignOrgId,foreignCampaignId,users,records,requests,rpc,staffDiscovery,revoke,retire,consent,mapSource,reset,seedAssigned,...(withDirectory?{directory,expire}:{}),
      audit:async()=>(await q('select registration_id,actor_user_id,request_id,before_state,after_state from outreach_decision_audit order by recorded_at')).rows,
      reassign:(recordId,userId)=>q('update outreach_decision_followup set assigned_user_id=$2 where registration_id=$1',[recordId,userId]),
      close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close()}};
  }catch(e){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}await db.close();throw e}
}
