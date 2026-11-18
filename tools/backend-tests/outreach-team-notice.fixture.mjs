// Synthetic policy/authority fixtures only. No hosted URL, secret or actual message.
import{fixture as core}from'./outreach-team-travel.fixture.mjs';
import{readFileSync}from'node:fs';import{randomUUID as uuid}from'node:crypto';
export const noticeSql=readFileSync(new URL('../../supabase/release/outreach-team-notices-v1-forward-candidate.sql',import.meta.url),'utf8');
export async function noticeFixture(native=false){
 const f=await core(native),{db,q,owner,campaign,org,as}=f;
 try{
  await db.exec(noticeSql);
  const workspace=async(a,p={},c=campaign,client=db)=>(await client.query('select public.outreach_team_notice_workspace($1,$2,$3) v',[a,c,p])).rows[0].v;
  const service=async(a,c=campaign,p={},client=db)=>{
   await client.exec('reset role;set role service_role');
   return(await client.query('select public.outreach_team_notice_worker($1,$2,$3) v',[a,c,{...p,environment:'isolated_test',provider_account:'synthetic-account'}])).rows[0].v;
  };
  const operator=async(u=owner,c=campaign)=>{
   await db.exec('reset role');
   await q("insert into private.outreach_team_notice_operators(campaign_id,user_id,can_prepare,can_authorize,can_report,can_reconcile,effective_at,expires_at,approval_ref) values($1,$2,true,true,true,true,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','SYNTHETIC fixture approval only')",[c,u]);
  };
  const configure=async()=>{await db.exec('reset role');await q("update private.outreach_team_notice_runtime set enabled=true,environment='isolated_test',provider_account='synthetic-account'");};
  const policy=async(kind='team_approved',version='synthetic_'+uuid().replaceAll('-',''))=>{
   await db.exec('reset role');
   const subject='SYNTHETIC TEST ONLY: {{event_name}}',text='Fixture message only. No real person, travel or delivery approval.';
   await q("insert into private.outreach_team_notice_policies(version,campaign_id,kind,approved_by,approved_at,approval_ref,environment,provider_account,subject_template,text_template,copy_sha256,sender,reply_to,recipient_rule,consent_rule,retention_rule,retry_rule,effective_at,expires_at) values($1,$2,$3,$4,clock_timestamp(),'SYNTHETIC policy fixture only','isolated_test','synthetic-account',$5,$6,private.outreach_team_notice_sha(jsonb_build_object('subject',$5::text,'text',$6::text)),'outreach@auth.championlifefwb.com','synthetic@example.test','verified_adult_own_email','explicit_per_intent','retain_evidence_pending_manual_review','no_automatic_retry_after_start',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')",[version,campaign,kind,owner,subject,text]);
   return version;
  };
  const participant=async(age=30)=>{
   const m=await f.member('Synthetic Notice',age);
   await db.exec('reset role');
   const recipient=uuid(),email=recipient+'@example.test';
   await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[recipient,email]);
   await q('update public.organization_people set email=$1 where id=$2',[email,m.person]);
   const link=(await q("insert into public.portal_account_links(organization_id,person_id,user_id,verification_note) values($1,$2,$3,'SYNTHETIC privileged fixture only') returning id",[org,m.person,recipient])).rows[0].id;
   const history=(await q("select max(id)::int id from public.outreach_team_history where campaign_id=$1 and subject_id=$2 and kind='approval.changed'",[campaign,m.id])).rows[0].id;
   return {...m,recipient,email,link,history};
  };
  const prepare=async(m,kind='team_approved',history=m.history,assignment=null)=>{
   await as(owner);return workspace('prepare',{member_id:m.id,kind,history_id:history,...(assignment?{assignment_id:assignment}:{})});
  };
  const authorize=async(i,m,version,extras={})=>{await as(owner);return workspace('authorize',{intent_id:i.id,policy_version:version,recipient_user_id:m.recipient,portal_link_id:m.link,explicit_consent_reviewed:true,consent_ref:'SYNTHETIC consent fixture only',...extras});};
  const row=async(id)=>{await db.exec('reset role');return(await q('select * from private.outreach_team_notice_intents where id=$1',[id])).rows[0]};
  return {...f,workspace,service,operator,configure,policy,participant,prepare,authorize,row};
 }catch(e){await db.close();throw e}
}
