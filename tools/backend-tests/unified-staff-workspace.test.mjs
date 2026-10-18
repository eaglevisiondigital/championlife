import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

const home=read('staff-home.html');
assert(home.includes('data-staff-workspace'));
assert(home.includes('assets/js/staff-workspace.js'));
assert(home.includes('assets/js/staff-dashboard.js'));

const registration=read('staff-outreach-registration.html');
assert(registration.includes('data-staff-workspace'));
assert(!registration.includes('campaign-sidebar'));
assert(!registration.includes('Return to Staff Home'));

const people=read('staff-people.html');
assert(people.includes('data-staff-workspace'));
assert(people.includes('People & Follow-Up'));

const shell=read('assets/js/staff-workspace.js');
assert(shell.includes("'Sign out'"));
assert(shell.includes("'Current outreach campaign'"));
assert(shell.includes("'Staff & Access'"));
assert(shell.includes("'Decisions & Follow-Up'"));
assert(shell.includes("'Team & Travel'"));
assert(shell.includes("hasGrant('staff.manage')"));
assert(shell.includes("ctx?.settings?.campaign_id"));

const huntsville=read('huntsville/index.html');
assert(huntsville.includes('Huntsville, Alabama Outreach'));
assert(huntsville.includes('October 24, 2026'));
assert(huntsville.includes("source:'huntsville_al_2026'"));
assert(huntsville.includes('sowgo.org/go'));
assert(!/Bessemer, Alabama/i.test(huntsville));

const decision=read('assets/js/staff-outreach-decisions.js');
assert(decision.includes('outreach_decision_workspace'));
assert(decision.includes('Save follow-up'));

const access=read('assets/js/staff-access.js');
assert(access.includes('Invite & apply access'));
assert(access.includes('champion_full'));
assert(access.includes('campaign_followup'));

const teamMigration=read('supabase/migrations/20261018124600_unified_staff_team_travel_v1.sql');
assert(!teamMigration.includes('outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check'));
assert(!teamMigration.includes('private.outreach_can(p_campaign)'));
assert(teamMigration.includes('outreach_team_signups'));

const accessFix=read('supabase/migrations/20261018125000_restrict_unified_staff_access_admin.sql');
assert(accessFix.includes("private.has_staff_permission(o.id,'staff.manage')"));

const manifest=JSON.parse(read('tools/site-build/public-files.json'));
for(const p of ['staff-home.html','staff-outreach-overview.html','staff-outreach-decisions.html','staff-access.html','staff-outreach-team.html','huntsville/index.html','assets/js/unified-preview-config.js'])assert(manifest.includes(p),p);

console.log('PASS unified staff shell, Huntsville page, decision follow-up, team/travel, access controls and publish manifest');
