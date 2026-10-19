import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

const migration=read('supabase/migrations/20261019004611_unified_outreach_staff_partner.sql');
for(const table of ['outreach_partner_churches','outreach_partner_users','outreach_partner_assignments','outreach_partner_followup','outreach_partner_pastoral_notes'])assert(migration.includes('create table public.'+table));
assert(migration.includes("capabilities <@ array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']"));
assert(migration.includes("status<>'revoked'"));
assert(migration.includes("partner.pastoral_note_recorded"));
assert(!migration.includes("'note',n.note") || migration.includes("'pastoral_notes'"));
assert(migration.includes("revoke all on public.%I from public,anon,authenticated"));
assert(migration.includes("Do not contact minors directly") || migration.includes("Do not contact minors directly".toLowerCase()) || migration.includes("minor_contact_rule"));

const shell=read('assets/js/staff-workspace.js');
assert(shell.includes("'Partner Follow-Up'"));
assert(shell.includes("'Partner Churches'"));
assert(shell.includes("outreach_partner_workspace"));

const partner=read('assets/js/staff-outreach-partner.js');
assert(partner.includes('outreach_partner_workspace'));
assert(partner.includes('Private pastoral notes'));
assert(partner.includes('Do not contact minors directly'));

const admin=read('assets/js/staff-outreach-partner-admin.js');
assert(admin.includes('Partner Churches & Assignment'));
assert(admin.includes('Partner churches cannot pull records from the campaign pool'));
assert(admin.includes('partner.export'));
assert(admin.includes('partner.pastoral_notes'));

for(const page of ['staff-outreach-partner.html','staff-outreach-partner-admin.html'])assert(read(page).includes('data-staff-workspace'));

const manifest=JSON.parse(read('tools/site-build/public-files.json'));
for(const path of ['staff-outreach-partner.html','staff-outreach-partner-admin.html','assets/js/staff-outreach-partner.js','assets/js/staff-outreach-partner-admin.js'])assert(manifest.includes(path),path);

console.log('PASS partner church scope, follow-up, pastoral privacy, minor messaging, export safety and publish manifest');
