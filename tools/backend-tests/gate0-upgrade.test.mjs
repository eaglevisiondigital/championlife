import assert from 'node:assert/strict';import {randomUUID as uuid} from 'node:crypto';
import {database,apply,read,registry,gatePath,pins,source,paths} from './gate0.fixture.mjs';
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
// Reproduce the exact original G/H list-replacement statements; whole earlier
// snapshot provenance remains in private audit evidence, not fabricated as a commit.
for(const populated of [false,true]){const db=await database();try{
 await apply(db,'nmi');const before=(await db.query('select private.staff_permission_keys() k')).rows[0].k;
 if(populated){const id=uuid();await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'regression@example.test',now())",[id]);await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) select id,$1,'finance.gifts.read' from organizations limit 1",[id]);}
 if(populated){await db.exec('begin');await assert.rejects(()=>db.exec(read('tools/backend-tests/fixtures/gate0-old-registry.sql')),e=>e.code==='23514'&&e.message.includes('organization_staff_permissions_permission_check'));await db.exec('rollback');ok(true,'old constraint rejects populated finance grant: SQLSTATE 23514');}
 else{await db.exec(read('tools/backend-tests/fixtures/gate0-old-registry.sql'));const after=(await db.query('select private.staff_permission_keys() k')).rows[0].k;const lost=before.filter(k=>!after.includes(k));assert.equal(lost.length,41);console.log('PROVEN_LOST_KEYS '+JSON.stringify(lost));ok(true,'old fixed lists remove exactly 41 capabilities (70 -> 46)');}
}finally{await db.close();}}
// Gate first/last/between and both child orders, populated prior grants/templates.
for(const order of [['gate'],['gate','nmi','outreach'],['gate','outreach','nmi'],['nmi','gate','outreach'],['outreach','gate','nmi'],['nmi','outreach','gate'],['outreach','nmi','gate']]){
 const db=await database();try{
 const q=(s,p=[])=>db.query(s,p),org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,user=uuid();await q("insert into auth.users(id,email,email_confirmed_at) values($1,'upgrade@example.test',now())",[user]);
 let previous=(await q('select private.staff_permission_keys() k')).rows[0].k;
 for(const key of previous)await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,user,key]);
 await q("insert into staff_role_templates(organization_id,name,permissions)values($1,'Existing template',array['people.read','finance.read'])",[org]);
 const template=(await q('select to_jsonb(t) v from staff_role_templates t')).rows[0].v;
 const grantBefore=(await q('select to_jsonb(g) v from organization_staff_permissions g order by permission')).rows.map(x=>x.v);
 for(const track of order){if(track==='gate')await db.exec(read(gatePath));else await apply(db,track);
 const current=(await q('select private.staff_permission_keys() k')).rows[0].k;ok(previous.every(k=>current.includes(k)),order.join(' -> ')+' additive after '+track);previous=current;}
 ok(registry.organization.every(k=>previous.includes(k)),order.join(' -> ')+' complete organization union');
 assert.deepEqual((await q('select to_jsonb(t) v from staff_role_templates t')).rows[0].v,template);ok(true,'template unchanged; no automatic authority');
 const grantAfter=(await q('select to_jsonb(g) v from organization_staff_permissions g order by permission')).rows.map(x=>x.v);assert.deepEqual(grantAfter,grantBefore);ok(true,'every production-vocabulary synthetic grant byte-equivalent after replay');
 for(const key of registry.organization)await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3) on conflict do nothing',[org,user,key]);ok(true,'all organization keys accepted');
 await assert.rejects(()=>q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'partner.pastoral_notes')",[org,user]));ok(true,'partner scope cannot be inserted as organization authority');
 await assert.rejects(()=>q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'arbitrary.superuser')",[org,user]));ok(true,'unknown authority rejected');
 if(order.length>1){const B=(await q("select id from outreach_campaigns where code='bessemer_al_2026'")).rows[0].id;await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'internal_team',$3,'Synthetic scope regression')",[B,user,registry.campaign]);ok(true,'all campaign vocabulary accepted with prerequisites');await assert.rejects(()=>q("update outreach_campaign_assignments set capabilities=array['view','finance.gifts.read'] where user_id=$1",[user]));ok(true,'campaign grant cannot confer finance');}
 ok(!(await q("select has_function_privilege('anon','public.shared_platform_context()','execute') v")).rows[0].v,'anonymous shared context denied');
}finally{await db.close();}}
console.log(n+' Gate 0 upgrade/regression checks passed');
