// Synthetic local source-contract fixture only. No hosted URL, grants or identities.
import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';import{PGlite}from'@electric-sql/pglite';
import{localPostgres}from'./local-postgres.mjs';import{migrationOrder}from'./migration-order.mjs';
export const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const campaign='d26b8337-d215-42d3-ac3b-c771f7f07db7';
export const candidate=read('supabase/release/minden-decision-foundation-v2.sql');
export async function decisionFixture(native=false,beforeCandidate=null){
 const db=native?await localPostgres():new PGlite(),q=(s,p=[])=>db.query(s,p);
 try{
  await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
  for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));
  for(const f of['supabase/release/dream-track-v1-forward-candidate.sql','supabase/migrations/20261117190320_outreach_volunteer_applications_v1.sql','supabase/migrations/20261117191223_outreach_volunteer_review_list_fix.sql','supabase/release/outreach-team-travel-v1-forward-candidate.sql','supabase/release/outreach-team-notices-v1-forward-candidate.sql'])await db.exec(read(f));
  // Local P0 replay uses a random UUID. Replace only that empty synthetic event
  // with the explicitly approved fixed event identity before candidate install.
  await db.exec(`do $$declare old public.outreach_campaigns;begin select * into old from public.outreach_campaigns where code='minden_la_2026';update public.outreach_campaigns set code='synthetic_old_p0',public_slug=null where id=old.id;insert into public.outreach_campaigns(id,organization_id,code,name,public_slug,city,state_province,country,timezone,status,public_page)values('${campaign}',old.organization_id,'minden_la_2026',old.name,'minden-2026',old.city,old.state_province,old.country,old.timezone,old.status,old.public_page);update public.outreach_volunteer_settings set campaign_id='${campaign}' where campaign_id=old.id;delete from public.outreach_campaigns where id=old.id;end $$;`);
  await db.exec(`alter table auth.users add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id;
  const previous=(await q(`select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','app_private') and p.prokind='f'`)).rows[0].v;
  // Optional trusted LOCAL installer harness. No URL/configuration enters this fixture.
  const installed=beforeCandidate?await beforeCandidate({db,q,org,campaign,candidate}):false;
  if(installed!==true)await db.exec(candidate);
  const ids={},sessions={};for(const who of['assigner','reader','other','owner','registration','foreign','unverified']){
   ids[who]=randomUUID();sessions[ids[who]]=randomUUID();await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[ids[who],who+'@example.invalid',who==='unverified'?null:new Date()]);
   await q('insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval\'2 hours\')',[sessions[ids[who]],ids[who]]);
   await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'SYNTHETIC staff')",[org,ids[who]]);
  }
  for(const[who,caps]of[['assigner',['view','decisions.assign']],['reader',['view','decisions.read','followup.manage']],['other',['view','decisions.read','followup.manage']],['unverified',['view','decisions.read']],['registration',['view','registration.view']]])await q(`insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,effective_at,expires_at,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',$3,$4,clock_timestamp()-interval'1 hour',clock_timestamp()+interval'1 hour',case when $4='assigned' then clock_timestamp()-interval'30 minutes' end,case when $4='assigned' then clock_timestamp()+interval'50 minutes' end,'SYNTHETIC fixture only')`,[campaign,ids[who],caps,who==='registration'?'campaign':'assigned']);
  await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,ids.owner]);
  const as=async(who,role='authenticated',client=db,claims={})=>{const user=ids[who]||who||'';await client.query('reset role');await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,session_id:sessions[user],exp:Math.floor(Date.now()/1000)+3600,...claims})]);await client.query('set role '+role)};
  const call=async(action,p={},client=db,c=campaign,o=org)=>(await client.query('select public.campaign_decision_foundation($1,$2,$3,$4) v',[action,o,c,JSON.stringify(p)])).rows[0].v;
  async function map(active=true){await db.exec('reset role');await q("insert into outreach_decision_campaign_sources(campaign_id,source,active)values($1,'minden_la_outreach',$2)on conflict(campaign_id)do update set active=excluded.active,revision=outreach_decision_campaign_sources.revision+1",[campaign,active]);}
  async function record(source='minden_la_outreach'){
   await db.exec('reset role');const id=randomUUID(),request=randomUUID();await q("insert into outreach_registrations(id,source,first_name,last_name,email,phone,decision,prayer_request,consent)values($1,$2,'<img src=x onerror=alert(1)>','SYNTHETIC','PRIVATE@example.invalid','15555550123','salvation','PRIVATE PRAYER',true)",[id,source]);await q('insert into outreach_decision_followup(registration_id,campaign_id)values($1,$2)',[id,campaign]);if(source==='minden_la_outreach')await q('select private.minden_decision_record_intake($1,$2,$3)',[campaign,id,request]);return{id,request};
  }
  async function consent(){await db.exec(`reset role;create table private.synthetic_decision_consent(registration_id uuid primary key,allowed boolean not null,expires_at timestamptz not null default 'infinity');create function private.minden_decision_followup_consent(r uuid)returns boolean language plpgsql volatile security definer set search_path='' as $$declare x private.synthetic_decision_consent;begin select * into x from private.synthetic_decision_consent where registration_id=r for share;return x.allowed is true and x.expires_at>clock_timestamp();end $$;revoke all on function private.minden_decision_followup_consent(uuid)from public,anon,authenticated,service_role;`);}
  return{db,q,as,call,map,record,consent,org,ids,sessions,previous};
 }catch(e){await db.close();throw e;}
}
