// Synthetic fixture for the actual accepted Partner SQL, shared by PGlite and
// native PostgreSQL. No hosted URL, customer data, or production grant path.
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export async function partnerAuthorityFixture(db){
 const q=(...a)=>db.query(...a);
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(`alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt() to authenticated;`);await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));await db.exec(read('supabase/migrations/20261101154618_partner_assigned_metadata_boundary.sql'));
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,foreign=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const actor=uuid(),other=uuid(),subject=uuid(),session=uuid(),otherSession=uuid(),campaign=uuid(),foreignCampaign=uuid(),partner=uuid(),person=uuid(),decision=uuid(),assignment=uuid(),unassigned=uuid(),registrant=uuid();
 for(const id of[actor,other,subject])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.invalid']);
 await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[session,actor,otherSession,other]);
 for(const[id,o]of[[campaign,org],[foreignCampaign,foreign]])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Fictional','Fictional','US','UTC','approved')",[id,o,'fictional_'+id.replaceAll('-','_')]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'local_leader',array['view'],'Fictional explicit campaign')",[campaign,actor]);
 await db.exec('alter table organization_people disable trigger user');await q('insert into private.people(id)values($1)',[person]);await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'CHILD SECRET','PERSON')",[person,org]);await db.exec('alter table organization_people enable trigger user');
 await q("insert into portal_account_links(organization_id,person_id,user_id,verification_note)values($1,$2,$3,'Synthetic reviewed account link')",[org,person,subject]);
 await q("insert into outreach_registrations(id,first_name,last_name,email,phone,decision,source)values($1,'CHILD SECRET','PERSON','private@example.invalid','5550100','salvation','fictional_source')",[decision]);
 await q('insert into outreach_campaign_registrants(id,campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4,$5)',[registrant,campaign,org,decision,person]);
 await q("insert into outreach_partner_churches(id,campaign_id,name,slug,created_by)values($1,$2,'Fictional church','fictional', $3)",[partner,campaign,other]);
 await q("insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values($1,$2,$3,array['partner.view'],$4,'Synthetic reviewed permission')",[partner,campaign,actor,other]);
 await q("insert into outreach_partner_assignments(id,campaign_id,partner_church_id,decision_registration_id,assigned_worker_user_id,assigned_by,assignment_reason)values($1,$2,$3,$4,$5,$6,'Synthetic exact record assignment')",[assignment,campaign,partner,decision,actor,other]);

 return {org,foreign,actor,other,subject,session,otherSession,campaign,foreignCampaign,partner,person,decision,assignment,registrant};
}
export async function setWorker(client,f){
 await client.query('reset role');
 await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[f.actor,JSON.stringify({session_id:f.session})]);
 await client.query('set role authenticated');
}
export const readAssigned=(client,f)=>client.query('select public.partner_assigned_metadata($1,$2) v',[f.campaign,f.assignment]).then(r=>r.rows[0].v);
// Each mutation changes an actual non-key authority field or retires the exact row.
// Restore happens only after the transaction under test has ended.
export function authorityMutations(f){return [
 {name:'actor ban',sql:"update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1",undo:'update auth.users set banned_until=null where id=$1',args:[f.actor]},
 {name:'actor confirmation',sql:'update auth.users set email_confirmed_at=null where id=$1',undo:'update auth.users set email_confirmed_at=now() where id=$1',args:[f.actor]},
 {name:'session retirement',sql:'delete from auth.sessions where id=$1',undo:"insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",args:[f.session],undoArgs:[f.session,f.actor]},
 {name:'campaign grant',sql:'update outreach_campaign_assignments set active=false where user_id=$1 and campaign_id=$2',undo:'update outreach_campaign_assignments set active=true where user_id=$1 and campaign_id=$2',args:[f.actor,f.campaign]},
 {name:'Partner grant',sql:'update outreach_partner_users set active=false where user_id=$1 and partner_church_id=$2',undo:'update outreach_partner_users set active=true where user_id=$1 and partner_church_id=$2',args:[f.actor,f.partner]},
 {name:'Partner church',sql:'update outreach_partner_churches set active=false where id=$1',undo:'update outreach_partner_churches set active=true where id=$1',args:[f.partner]},
 {name:'assignment worker',sql:'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',undo:'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',args:[f.other,f.assignment],undoArgs:[f.actor,f.assignment]},
 {name:'registrant association',sql:'delete from outreach_campaign_registrants where id=$1',undo:'insert into outreach_campaign_registrants(id,campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4,$5)',args:[f.registrant],undoArgs:[f.registrant,f.campaign,f.org,f.decision,f.person]}
];}
