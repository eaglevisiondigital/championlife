// Explicit historical groups; only exact validated private composition adds sibling SQL.
import {diskInventory,selectIntegrationMigrationOrder} from './nmi-integration-inventory.mjs';
export const baselineOrder=[
  "20260923114743_create_course_progress_schema.sql",
  "20260923114822_harden_course_security_and_indexes.sql",
  "20260923115114_revoke_public_rls_helper_execution.sql",
  "20260923115706_grant_authenticated_course_api_access.sql",
  "20260923115732_restrict_authenticated_course_privileges.sql",
  "20260923121707_add_st_lucia_registration_and_account_linking.sql",
  "20260923122017_secure_st_lucia_registration_claim_after_login.sql",
  "20260925200310_organization_foundation.sql",
  "20260925200318_harden_outreach_claim.sql",
  "20260925202633_lesson_notes.sql",
  "20260926000821_followup_tasks.sql",
  "20260926022613_staff_access_and_people.sql",
  "20260926024742_household_records.sql",
  "20260926032026_department_tags.sql",
  "20260926034222_tag_workflows.sql",
  "20260926035410_giving_configuration.sql",
  "20260926040812_participant_portals.sql",
  "20260928172557_people_staff_v1.sql",
  "20261004055336_outreach_partner_intake_v1.sql",
  "20261004154340_allow_bessemer_outreach_registrations.sql",
  "20261004230453_outreach_partner_gateway.sql",
  "20261005161946_outreach_network_limit_120.sql"
];
export const candidateOrder=[
  "20261016201932_huntsville_registration_foundation.sql",
  "20261016201933_huntsville_registration_draft.sql"
];
export const productionOrder=[...baselineOrder,...candidateOrder,"20261018121900_allow_huntsville_decision_registrations.sql"];
export const givingOrder=[
  "20261019002847_nmi_friday_giving_core_giv_1.sql",
  "20261019002848_nmi_friday_giving_finance_management_giv_2a.sql",
  "20261019002849_nmi_friday_giving_reports_statements_giv_2b.sql",
  "20261019002850_nmi_friday_platform_forms_giv_2c.sql",
  "20261019002851_nmi_friday_forms_conflict_http_409.sql",
  "20261019002853_nmi_friday_giving_provider_foundation_giv_3a.sql",
  "20261019002854_nmi_friday_giving_nmi_sandbox_giv_3b.sql",
  "20261019002855_nmi_friday_giving_payment_operations_giv_3d.sql",
  "20261019002856_nmi_friday_giving_payment_ops_amount_filters.sql"
];
export const integrationOrder=["20261019003215_nmi_friday_operations_bridge.sql"];
export const executionOrder=["20261019010048_nmi_sandbox_execution.sql","20261019010932_nmi_sandbox_recovery_reconciliation.sql"];
// Primary-owned dependency, appended after all twelve Giving forward files.
export const gate0Order=["20261019012735_shared_platform_gate0.sql"];
export const nmiOrder=[...productionOrder,...givingOrder,...integrationOrder,...executionOrder,...gate0Order];
// Both NMI database fixtures import this order: 38 standalone, 42 only after all guards pass.
export const migrationOrder=selectIntegrationMigrationOrder({...diskInventory(new URL('../../',import.meta.url)),nmiOrder});
