// Generates reviewed synthetic SQL ONLY. Never creates Auth users or connects to a DB.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),cfg=JSON.parse(readFileSync(path.join(root,'config/outreach/unified-acceptance.json'),'utf8'));
if(!/^[a-z]{20}$/.test(cfg.projectRef||'')||[cfg.productionRefDenied,cfg.sharedAcceptanceRefDenied].includes(cfg.projectRef))throw Error('Fresh isolated target must be approved/pinned first. No SQL emitted.');
const [input,output]=process.argv.slice(2);if(!input||!output||!path.isAbsolute(output)||existsSync(output)||!path.relative(root,output).startsWith('..'))throw Error('Provide a private Auth-ID JSON file and a new absolute output path outside the repository.');
const users=JSON.parse(readFileSync(input,'utf8')),roles=['leader','bessemer','huntsville','readonly','followup','revoked'];if(roles.some(k=>!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(users[k]||''))||new Set(roles.map(k=>users[k])).size!==6)throw Error('Six distinct synthetic Auth UUIDs required.');
const values=roles.map(k=>`('${k}','${users[k]}'::uuid)`).join(',');
const sql=`-- ISOLATED ACCEPTANCE ONLY: project ${cfg.projectRef}. No automatic application.
-- Confirm the selected connector/CLI target independently before execution.
begin;
create temporary table unified_fixture_users(role text primary key,id uuid) on commit drop;
insert into unified_fixture_users values ${values};
do $$declare b uuid;h uuid;o uuid;champion uuid;leader uuid;bc uuid;hc uuid;r record;k text;target uuid;begin
 if exists(select 1 from public.outreach_registrations) or exists(select 1 from public.outreach_event_registrations) or exists(select 1 from public.outreach_partner_users) then raise exception 'Expected fresh isolated operational tables; refusing fixtures';end if;
 if exists(select 1 from unified_fixture_users f left join auth.users u on u.id=f.id where u.id is null or u.email is distinct from f.role||'-synthetic@example.test' or u.email_confirmed_at is null or coalesce(u.is_anonymous,false)) then raise exception 'Existing verified synthetic Auth identities required';end if;
 select id into strict o from organizations where slug='sowgo';select id into strict champion from organizations where slug='champion-life';select id into strict b from outreach_campaigns where code='bessemer_al_2026';select id into strict h from outreach_campaigns where code='huntsville_al_2026';select id into leader from unified_fixture_users where role='leader';
 foreach target in array array[o,champion] loop
  insert into organization_staff_directory(organization_id,user_id,display_name)values(target,leader,'SYNTHETIC acceptance leader');
  foreach k in array private.staff_permission_keys() loop insert into organization_staff_permissions(organization_id,user_id,permission)values(target,leader,k);end loop;
  insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values(target,leader,'manage','SYNTHETIC acceptance only');
 end loop;
 insert into outreach_registrations(first_name,last_name,email,phone,decision,prayer_request,consent,source)
 select 'SYNTHETIC','Acceptance '||n,'bessemer-fixture@example.test','+15555550100',case when n<=14 then 'salvation' when n<=23 then 'rededication' when n<=30 then 'learn_more' else 'prayer_followup' end,'SYNTHETIC original prayer '||n,true,'bessemer_al_2026' from generate_series(1,48)n;
 insert into outreach_registrations(first_name,last_name,email,phone,decision,prayer_request,consent,source) values('SYNTHETIC','Huntsville','huntsville-fixture@example.test','+15555550111','salvation','SYNTHETIC prayer',true,'huntsville_al_2026');
 insert into outreach_partner_churches(campaign_id,name,slug,created_by)values(b,'SYNTHETIC Bessemer Church','synthetic-bessemer',leader)returning id into bc;
 insert into outreach_partner_churches(campaign_id,name,slug,created_by)values(h,'SYNTHETIC Huntsville Church','synthetic-huntsville',leader)returning id into hc;
 for r in select * from unified_fixture_users where role in ('bessemer','huntsville') loop
  insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values(case when r.role='bessemer' then bc else hc end,case when r.role='bessemer' then b else h end,r.id,array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes'],leader,'SYNTHETIC church-scoped acceptance');
 end loop;
 insert into outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason)select b,bc,id,leader,'SYNTHETIC central assignment' from outreach_registrations where source='bessemer_al_2026' order by created_at,id limit 1;
 insert into outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason)select h,hc,id,leader,'SYNTHETIC central assignment' from outreach_registrations where source='huntsville_al_2026' order by created_at,id limit 1;
 for r in select * from unified_fixture_users where role in ('readonly','followup','revoked') loop
  foreach target in array array[b,h] loop insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values(target,r.id,'internal_team',case when r.role='readonly' then array['view','decision.view','registration.view'] else array['view','decision.view','decision.manage'] end,'SYNTHETIC role acceptance only');end loop;
 end loop;
end$$;
commit;
-- Open revoked-synthetic in its existing session; revoke its assignments centrally,
-- then prove the next RPC and the open page/export fail without logout.
`;
writeFileSync(output,sql,{mode:0o600});
const cleanup=`-- SAME ISOLATED PROJECT ${cfg.projectRef} ONLY. Reverse/close test check-ins first using scoped RPCs; keep immutable source/audit/legal history.
begin;
update organization_staff_permissions set revoked_at=now() where user_id in (${roles.map(k=>`'${users[k]}'::uuid`).join(',')});
update organization_staff_directory set active=false where user_id in (${roles.map(k=>`'${users[k]}'::uuid`).join(',')});
update outreach_campaign_admins set active=false where user_id in (${roles.map(k=>`'${users[k]}'::uuid`).join(',')});
update outreach_campaign_assignments set active=false where user_id in (${roles.map(k=>`'${users[k]}'::uuid`).join(',')});
update outreach_partner_users set active=false where user_id in (${roles.map(k=>`'${users[k]}'::uuid`).join(',')});
update outreach_registration_settings set enabled=false;update outreach_team_settings set enabled=false,window_override='closed';
commit;
`;
writeFileSync(output+'.cleanup.sql',cleanup,{mode:0o600});console.log(JSON.stringify({project:cfg.projectRef,fixtureFile:output,cleanupFile:output+'.cleanup.sql',applied:false}));
