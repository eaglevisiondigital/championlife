import assert from 'node:assert/strict';import {randomUUID as uuid} from 'node:crypto';
import {database,apply,read,gatePath,source,pins} from './gate0.fixture.mjs';
// All frozen role-suite assertions run unchanged on the combined schema.
const body=source(pins.outreach,'tools/backend-tests/unified-outreach-roles.test.mjs').replace(/^import .*;\n/gm,'');
await new (Object.getPrototypeOf(async()=>{}).constructor)('assert','uuid','database',body)(assert,uuid,async before=>{const db=await database();if(before)await before(db);await apply(db,'nmi');await apply(db,'outreach');await db.exec(read(gatePath));return db;});
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
const db=await database();try{
 await apply(db,'nmi');await apply(db,'outreach');await db.exec(read(gatePath));
 const q=(s,p=[])=>db.query(s,p),as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role authenticated');},owner=()=>db.exec('reset role');
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,other=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const B=(await q("select id from outreach_campaigns where code='bessemer_al_2026'")).rows[0].id,H=(await q("select id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].id;
 const mixed=uuid(),finance=uuid(),partner=uuid();for(const id of [mixed,finance,partner])await q("insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())",[id,id+'@example.test']);
 for(const id of [mixed,finance]){await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic finance')",[org,id]);for(const key of ['finance.read','finance.gifts.read','finance.reports.read','payments.view'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,id,key]);}
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'internal_team',array['view','decision.view','decision.manage'],'Synthetic only')",[B,mixed]);
 const context=async()=>(await q('select shared_platform_context() v')).rows[0].v;
 await as(mixed);let c=await context();ok(c.giving.organizations.some(o=>o.id===org)&&c.outreach.campaigns.some(o=>o.id===B),'one current session has finance AND Bessemer authority');
 ok(!c.giving.organizations.some(o=>o.id===other),'finance remains organization-scoped');
 await assert.rejects(()=>q("select outreach_decision_workspace('list',$1,'{}')",[H]));ok(true,'mixed finance/outreach cannot cross to Huntsville');
 await assert.rejects(()=>q("select people_workspace($1,'list','{}')",[org]));ok(true,'finance/outreach not general People permission');
 await assert.rejects(()=>q('select * from outreach_partner_pastoral_notes'));ok(true,'finance cannot read raw pastoral notes');
 await q("select outreach_decision_workspace('list',$1,'{}')",[B]);await q("select giving_workspace('gifts',$1,'{}')",[org]);ok(true,'both module read RPCs work under same authenticated role');
 await owner();await q("update organization_staff_permissions set revoked_at=now() where user_id=$1",[mixed]);await as(mixed);c=await context();ok(c.giving.organizations.length===0&&c.outreach.campaigns.some(x=>x.id===B),'finance revocation removes finance projection, preserves independent Outreach');await assert.rejects(()=>q("select giving_workspace('gifts',$1,'{}')",[org]));ok(true,'same-session finance revocation enforced by backend');
 await owner();await q('update outreach_campaign_assignments set active=false where user_id=$1',[mixed]);await as(mixed);c=await context();ok(c.outreach.campaigns.length===0,'same-session Outreach revocation clears projection');
 await as(finance);c=await context();ok(c.giving.organizations.length===1&&c.outreach.campaigns.length===0,'finance-only grants no campaign access');
 ok((await q("select outreach_partner_workspace('partners',null::uuid,'{}') v")).rows[0].v.length===0,'finance-only has no partner authority');
 await owner();const church=uuid();await q("insert into outreach_partner_churches(id,campaign_id,name,slug,created_by)values($1,$2,'Synthetic Church','gate0-synthetic',$3)",[church,B,finance]);await q("insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values($1,$2,$3,array['partner.view'],$4,'Synthetic only')",[church,B,partner,finance]);
 await as(partner);c=await context();ok(c.partners.length===1&&c.giving.organizations.length===0&&c.payments.organizations.length===0,'partner projection excludes all finance/payment organizations');await assert.rejects(()=>q("select people_workspace($1,'list','{}')",[org]));ok(true,'partner cannot browse People');await assert.rejects(()=>q("select giving_workspace('gifts',$1,'{}')",[org]));ok(true,'partner cannot browse gifts');
 console.log(n+' combined finance/Outreach scope checks passed');
}finally{await db.close();}
