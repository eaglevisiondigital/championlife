// Disposable fictional test setup. Never used by the repository or website.
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {partnerAuthorityFixture} from './authority-fixture.mjs';
export async function canonicalSourceFixture(db){
 const f=await partnerAuthorityFixture(db);
 const sql=readFileSync(new URL('./fixtures/issue50-identity-source.sql',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/issue50-identity-source.json',import.meta.url),'utf8'));
 if(createHash('sha256').update(sql).digest('hex')!==manifest.fixtureSha256)throw Error('Fixture provenance mismatch');
 await db.exec(sql);
 await db.query('insert into outreach_campaign_sources(source,campaign_id)values($1,$2)',['fictional_source',f.campaign]);
 await db.query('update outreach_registrations set user_id=$1,consent=true where id=$2',[f.subject,f.decision]);
 await db.query('update outreach_campaign_registrants set person_id=null where id=$1',[f.registrant]);
 await db.query("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional reviewer')",[f.org,f.other]);
 for(const permission of ['staff.manage','portal.manage','people.read','people.update'])await db.query('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[f.org,f.other,permission]);
 await db.query("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic independent review')",[f.org,f.other]);
 await db.query("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'local_leader',array['view','decisions.read'],'Synthetic exact review scope')",[f.campaign,f.other]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[f.other]);
 const hash=(await db.query("select encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex') hash from outreach_registrations d where id=$1",[f.decision])).rows[0].hash;
 f.request=randomUUID();
 // Generate all review/receipt/audit proof through accepted A/B2 writers, never
 // hand-insert invented identity evidence. These are fictional local records.
 const receipt=(await db.query("select private.city_care_workspace($1,'identity_save',$2) receipt",[f.campaign,{request_id:f.request,source_id:f.decision,source_hash:hash,registrant_revision:1,review_revision:0,person_id:f.person,outcome:'linked',reason:'Fictional independent identity review for isolated test'}])).rows[0].receipt;
 if(receipt.registrant_revision!==2||receipt.review_revision!==1)throw Error('Accepted writer fixture failed');
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 return f;
}
