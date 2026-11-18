-- SOURCE-ONLY REVIEW PACKAGE. Applying requires separate exact owner release approval.
-- Never apply old PR149 installers. Default OFF; no policy, source map, grant or messages.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $minden_guard$ declare matches boolean;begin
with snapshot as(select jsonb_build_object(
'collected_at',clock_timestamp(),'target','exdocjbmylgxssanymjk',
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_hash',md5(statements::text)) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||pg_get_userbyid(p.proowner))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','app_private') and p.prokind='f'),
'table_policies',(select jsonb_object_agg(key,hash) from(select schemaname||'.'||tablename||'.'||policyname key,md5(roles::text||cmd||permissive||coalesce(qual,'')||coalesce(with_check,'')) hash from pg_policies where schemaname in('public','private','app_private','storage'))x),
'tables',(select jsonb_object_agg(n.nspname||'.'||c.relname,md5(jsonb_build_object(
'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
'triggers',(select jsonb_agg(jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal)
)::text)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and (n.nspname in('public','private','app_private') or(n.nspname='auth' and c.relname in('users','sessions')) or(n.nspname='storage' and c.relname in('objects','buckets'))))
) catalog), actual as(select catalog-array['collected_at','target'] value from snapshot)
select value=$minden_expected${"functions":{"rls_auto_enable()":"ea885949b178a84bbe0d1a36a5f9d53f","dream_track(text,jsonb)":"78f2605ab300361a58585907281af66f","outreach_team_own(uuid)":"610fed513d2c2b8762a2131c89d47013","private.person_anchor()":"5f8aab345c9d23fa13381439feeb04a3","private.audit_tag_write()":"1e7107457baf0fb26b09b840ce5f1c01","private.guard_tag_write()":"1a097ab3c6bf1990a9d1a73f6853013d","staff_workspace_context()":"79d5c7631d703a7b6957a650fba1a4a2","private.course_immutable()":"fff85f404a0909728447bed3c1f7f179","private.portal_staff(uuid)":"0879611cb578b3ba33945ee0596d2da6","private.audit_person_write()":"545da548e4151ffe23b8f193a6663e37","private.guard_person_write()":"b853c94b7dd9ae89abd56377eec4cf0c","private.outreach_immutable()":"39f74565b3ce07b0d01da7057249cecc","claim_st_lucia_registration()":"8e53f951a9957b4f6f075978a180c8f3","private.audit_followup_task()":"a1e510a4b837f3d7037d7a49518e8ba9","private.guard_followup_task()":"bf775dd42c8934a7f344e32e05f8cb14","private.course_normalize(text)":"56ebe88fd000148849edb3496dbf994b","private.enqueue_tag_workflow()":"4a3b818de869fcda493f6f47eba00285","private.audit_household_write()":"2f05970c5dbac65943e901af5c298bf3","private.audit_portal_resource()":"bb0e298bd9bc484a09fd6ea7fbd3a673","private.dream_track(text,jsonb)":"9fe95c09a78578a273e6a7a8227b6340","private.guard_household_write()":"752158c34ba22abab7339edcd1aa789f","private.guard_portal_resource()":"eddf10f6d17c11c3575c9ffb03aebe38","private.outreach_csv_cell(text)":"9f9aed633e073e11c44a65707931ef85","private.outreach_team_own(uuid)":"ec35f4654b2b2c3e6dcb66a976f43a70","private.outreach_verified(uuid)":"6f40df56fb47d6be937f5ad7f0d20bb6","private.staff_permission_keys()":"112562db87285e8bee94c748a630202c","app_private.can_read_king_kind()":"8047a18d3ee81cdd8cf481ed9395958a","private.outreach_abuse_cleanup()":"cd7c4af9ca286b968e4282bab2044c5d","people_workspace(uuid,text,jsonb)":"4dce337eb28b5d001a67aedb96e87656","private.guard_portal_access_tag()":"ced9cfcd0999ea36bed749abb7ec7392","private.staff_workspace_context()":"0ab41548824ebddb8ff12d8bd6e641fd","dream_track_admin(uuid,text,jsonb)":"306add1fac5203eb4ce0086241d8cd9b","list_staff_directory(uuid,boolean)":"b6900f0f1b2e80c1b393d58d635b9a40","outreach_registration_config(text)":"9c2b9f9f5c3ffbb53ab839fc14bfad80","private.outreach_abuse_limit(text)":"ff1c241217ca50ef6cbd2865d74d4906","private.course_code_hash(text,text)":"1484e666d5db89b1f5df3c852e222512","outreach_partner_gateway(jsonb,text)":"852a514f6a1d453265406d876606b980","private.audit_giving_configuration()":"d22c65ab1ba000d4f328cea5b013f369","private.guard_giving_configuration()":"a8f24b487daa70148fb393d638bcbe20","private.outreach_admin(uuid,boolean)":"74ac62a8b97f4bccc03c46da66cb9188","private.outreach_team_can(uuid,text)":"3b7115acb60c7e480ec6fc47ae34233e","private.outreach_volunteer_can(uuid)":"196db183f02ac97140197ca2a0303089","private.pause_changed_tag_workflow()":"f822ca96291ec49cd65ef33ce487fcbb","private.portal_has_access(uuid,uuid)":"dc424deaf88870e9c64d89df2cbb9025","private.claim_st_lucia_registration()":"86083f84df407213d417b215dff4f227","private.outreach_team_lock(uuid,text)":"7d56c0db1437617d20c873fb8eb4938c","private.outreach_volunteer_preserve()":"b87598b02a52843fe8943aa29b2a44a4","outreach_volunteer_gateway(jsonb,text)":"6913a1a54d66aa1298cab2d0be766894","private.outreach_partner_submit(jsonb)":"a35bf236705b39a6fc81765861ae9614","private.outreach_team_ready(uuid,uuid)":"f35011bde76f90e53a626e5858688b6d","private.execute_tag_workflow(uuid,uuid)":"5c375ef6e0d2aeab16a95bfb6dbc86e6","private.outreach_team_notice_sha(jsonb)":"3d3ee92148051f4c80868db10310d4bd","outreach_team_workspace(text,uuid,jsonb)":"067310a59bd3aba3e43551690fa0c3a4","outreach_volunteer_workspace(text,jsonb)":"8007e2c97fdcc81b2edf7e342779a52c","private.outreach_registration_open(uuid)":"bc7b774e9366570005e9db0f59b6c186","private.outreach_team_notice_immutable()":"19b460bde8b5d37f809a9c95afa908fb","course_invite_delivery(uuid,uuid,boolean)":"82477f9217bf38e7893becd1b04bdaec","private.people_workspace(uuid,text,jsonb)":"23496918b02b29d9489bdc40eb6aeb15","private.person_permission(uuid,uuid,text)":"260b63103492ac716b30e4206451b817","private.dream_track_admin(uuid,text,jsonb)":"6e0cd7ad8b2d969106f92d235b2a938b","private.list_staff_directory(uuid,boolean)":"9fd53fc30b432923ff3272b1455fdd34","private.outreach_registration_config(uuid)":"8b3ef1854d637edb77f453616683e255","private.staff_assignment_active(uuid,uuid)":"d5cddad7d72a0895f9a5f7a542e99c23","outreach_partner_workspace(uuid,text,jsonb)":"e45c4917e8d5b511c7592597a40fb28d","private.guard_portal_access_configuration()":"f7b445bde03f730a94b15f2e54453d4b","private.outreach_event(uuid,text,uuid,text)":"1dfee876b973e4f75f7ffe65a4274d91","outreach_team_notice_worker(text,uuid,jsonb)":"d32f6daf63a694be8a1caf6ada21bea8","private.course_snapshot(bigint,uuid,integer)":"1b7f9c5b5c612bbb93b00d0171c5521f","private.has_staff_permission(uuid,text,uuid)":"20cb5569a71324b0da76079de00354d0","private.outreach_partner_gateway(jsonb,text)":"acd4f3729a5ef00aa75c9eb3bd6a584a","private.outreach_registration_can(uuid,text)":"6c679d5f555209adc7de7e5ce6e7a8db","resolve_tag_workflow(uuid,uuid,integer,text)":"6008647b366f479563e389d5b5c2cc25","private.course_recompute(bigint,uuid,integer)":"17ce9592d187b5fdf401a721ffc6d4a2","outreach_registration_gateway(text,jsonb,text)":"f76bb69eff8ae8275b08c2e4d0f9c31e","private.cancel_changed_workflow_notification()":"a29cbd7ad30529c4a1bc9f81afa287d1","private.outreach_volunteer_gateway(jsonb,text)":"92d5f73a374b1a77701ed895d676ba93","outreach_team_notice_workspace(text,uuid,jsonb)":"f74fbafe060a656fcad4f8cd84d6e4b4","private.operational_followup_visible(uuid,uuid)":"0071fd0f9e1a70f733ea89b7d1b4c8f9","private.outreach_registration_detail(uuid,uuid)":"eb6823fea5b54d00569ef2c900f468b1","outreach_registration_workspace(text,uuid,jsonb)":"56bf450edaff61e70e8bd4d4a61a5f34","private.outreach_team_notice_can(uuid,uuid,text)":"8e15c148bb9903a38471eede5100916a","private.outreach_team_workspace(text,uuid,jsonb)":"d96333c7215dd90459f46190d82b6886","private.outreach_volunteer_workspace(text,jsonb)":"f1bcda30d0c5f8e9aaf1f2a0c2f51ee3","outreach_volunteer_delivery(text,uuid,uuid,jsonb)":"a0ac29bb0b9fe6d8de92d6ca5848c996","private.course_invite_delivery(uuid,uuid,boolean)":"338a13f9b0ca7cb1b8c3a0e65e906410","private.outreach_audit(uuid,uuid,text,uuid,jsonb)":"1f727bd2fd4ea3b3ca355e332db5cc8b","private.outreach_registration_answers(uuid,jsonb)":"f7699859d7488a74da9a5900e103e443","private.outreach_registration_coverage(uuid,uuid)":"7e63ddbe131e62684e68d8642453febb","private.outreach_registration_public_config(text)":"4a33629fb1ba015c61eeabdad8f3c7c8","private.outreach_team_record(uuid,text,uuid,jsonb)":"730bdfe986fd97695a441ae5150ad0fc","private.outreach_partner_workspace(uuid,text,jsonb)":"83ebe7515dbb4191463b874801b5371d","private.outreach_registration_sign(uuid,uuid,jsonb)":"232346530035c3e6ceecdc00f865d126","private.outreach_team_confirmation_valid(uuid,uuid)":"0f0dbce18ce397f8bfd2fb19d30eafa3","set_portal_tag_rule(uuid,uuid,uuid,boolean,integer)":"6c330cd36398d3b5dcdbf5fec23cd312","private.outreach_registration_address(jsonb,boolean)":"67aecf434a461f711954599f27a5e5cb","private.outreach_team_notice_worker(text,uuid,jsonb)":"639fa047fdb62e2e8fb9418badaa612e","private.outreach_team_permission_now(uuid,text,uuid)":"54837e171f548e63de9a7003300faee4","private.resolve_tag_workflow(uuid,uuid,integer,text)":"801b50589df6dff909937cfa271668ef","set_staff_access(uuid,uuid,text,text,text[],integer)":"1c6211819b020212359e6455faea3a93","private.outreach_registration_submit(uuid,jsonb,text)":"dbf077f16f4627e5e352c898b49c8b72","private.outreach_team_notice_snapshot(uuid,uuid,uuid)":"bfb035f3fb1850523f8f74d9e7ee974a","private.outreach_registration_gateway(text,jsonb,text)":"03886e7ef802969dff32f0f98b8c5bf5","private.outreach_registration_attendee(uuid,uuid,jsonb)":"c649e78c0ea4d948253e8cd7ec7d9dc1","private.outreach_team_notice_workspace(text,uuid,jsonb)":"d9a8f4561d2512c65e552e5599e5ec63","private.operational_relationship_visible(uuid,uuid,text)":"91638752778f3fb4cf989984805b69ff","private.outreach_registration_workspace(text,uuid,jsonb)":"165280c47e7a82001b820fa5b21e9717","private.outreach_volunteer_delivery(text,uuid,uuid,jsonb)":"a46a674af09be5779f2fa24ea1780215","configure_tag_workflow(uuid,uuid,integer,boolean,text,text)":"801e5e7ca253605b6e56690e302412dc","private.outreach_team_person_permission_now(uuid,uuid,text)":"5ae61faabcf5540ac46c40a364294895","private.set_portal_tag_rule(uuid,uuid,uuid,boolean,integer)":"eda9e35c8956ea25ed4f0168b3fca791","private.outreach_team_notice_kind_valid(uuid,uuid,uuid,text)":"ad3165ae437aaa3a385a27d84bb41f7d","private.set_staff_access(uuid,uuid,text,text,text[],integer)":"e3120ff0e2aec7fe78e049be32f40076","set_portal_account_link(uuid,uuid,text,boolean,text,integer)":"6f87e507c32309d78ea555679e34ef4c","private.configure_tag_workflow(uuid,uuid,integer,boolean,text,text)":"787bcbba17ca74eb71ea017b38b5803c","private.set_portal_account_link(uuid,uuid,text,boolean,text,integer)":"c71aef35865c2ddf1239dd8730128368","private.outreach_team_notice_adopt(private.outreach_team_notice_intents)":"23ad9bfb7d827d66caeb51e72bf1e4b4","private.outreach_team_notice_valid(private.outreach_team_notice_intents)":"e46d9a48f87b84f117629125f07d1ed2","private.outreach_team_notice_recipient(private.outreach_team_notice_intents)":"23ca06444f906a7e09ff3dc2f29ee058","private.outreach_team_notice_conflicted(private.outreach_team_notice_intents)":"e348fbe2731e18e110ed178ea53d2a9c"},"table_policies":{"public.households.households_read":"74bb166a9ed661eb46011530809489f2","public.households.households_insert":"bead994bfa874d8767d5899fc70edc2c","public.households.households_update":"0ac4d13e1e958534655282e69379e409","public.profiles.profiles_insert_own":"1b61bf2d895f48413a8164724f386dce","public.profiles.profiles_select_own":"8214eb61b527950e131a42171d845e74","public.profiles.profiles_update_own":"056920dfd0c98811c7dbbcc795ddc9d0","public.giving_funds.giving_funds_read":"dd370de55b2fe2d8c9aa6b6790fec578","public.portal_areas.portal_areas_read":"c67262df391993d697d87f7a41911c4d","public.giving_funds.giving_funds_insert":"5b805774cef67b90e7fc0b434d087135","public.giving_funds.giving_funds_update":"cd545835730c967d21e491246702ac59","public.lesson_answers.answers_insert_own":"dab818ffba8eb00ae62ea8f2ab46a124","public.lesson_answers.answers_select_own":"8214eb61b527950e131a42171d845e74","public.lesson_answers.answers_update_own":"c49671b6b79432f06416a930fcdf735f","public.courses.courses_read_authenticated":"78815f2f85cc11ba35bebef571232476","public.followup_tasks.followup_tasks_read":"a2aacf00f7a6c9edb8f2f8c53091fa9d","public.lesson_progress.progress_insert_own":"dab818ffba8eb00ae62ea8f2ab46a124","public.lesson_progress.progress_select_own":"8214eb61b527950e131a42171d845e74","public.lesson_progress.progress_update_own":"c49671b6b79432f06416a930fcdf735f","public.followup_tasks.followup_tasks_insert":"29a09823d0ecad180afbd51f7e5b7e59","public.followup_tasks.followup_tasks_update":"c036d35828f75fd778acfc47bf29ee4f","public.portal_resources.portal_resources_read":"81351c52fc5e60b1c8b8954447646c90","public.portal_tag_rules.portal_tag_rules_read":"aec1e0dfdbfecce81dc800d3fbbeca7c","public.organization_tag_events.tag_events_read":"0af6f8c64e98449802ba1f406cfff85e","public.household_members.household_members_read":"4be72e0c435a770cc482faf3ec0da8ea","public.organization_tags.organization_tags_read":"0e3ee9d415df1d2682fa7f1a28989244","public.organizations.organizations_read_related":"9b56102631f87216956a592e5ba13e3a","public.portal_resources.portal_resources_insert":"46bb164e2967b0ef9c27e5f1f1a3fda1","public.portal_resources.portal_resources_update":"023e66a4e917faf24c2357289e9ae5ad","public.tag_workflow_runs.tag_workflow_runs_read":"55c4af2cb876ac433d2f28bd20d68e2a","public.course_enrollments.enrollments_insert_own":"dab818ffba8eb00ae62ea8f2ab46a124","public.course_enrollments.enrollments_select_own":"8214eb61b527950e131a42171d845e74","public.course_enrollments.enrollments_update_own":"c49671b6b79432f06416a930fcdf735f","public.followup_task_events.followup_events_read":"60a1e56993deb8dfc9d9e5794e0b799b","public.followup_tasks.followup_financial_boundary":"c83b2ed2f5460eb8fc7d429a4977c9cf","public.giving_form_routes.giving_form_routes_read":"bfa6229371fd3a962b4a441ba0527b6d","public.household_members.household_members_insert":"10e5a3573ccee146aa70d3684faf3a5a","public.household_members.household_members_update":"73af6cf2342b1e828d5fca30c9eedf66","public.organization_tags.organization_tags_insert":"c6427e6e78cd12c0f417781941a815fa","public.organization_tags.organization_tags_update":"18e30db72140460e7ee27eae912e23af","public.outreach_registrations.outreach_select_own":"8214eb61b527950e131a42171d845e74","storage.objects.king_kind_registered_outreach_read":"db094d3c355f98119a15c75601580e41","public.giving_destinations.giving_destinations_read":"fd2212af08189858f4a62d8a1a6cfb07","public.giving_form_routes.giving_form_routes_insert":"d6cba067d084564bd5ed1f1fb26fd9f6","public.giving_form_routes.giving_form_routes_update":"e2f256f0ff9b63eeb0170238d8cf118e","public.organization_people.organization_people_read":"4a436b272d7edb1e55c96ffc92d5204e","public.portal_admin_events.portal_admin_events_read":"aec1e0dfdbfecce81dc800d3fbbeca7c","public.tag_workflow_events.tag_workflow_events_read":"ec25247414e24c542063fca2706820e2","public.outreach_registrations.outreach_insert_public":"e4fe6c34629b2904306cc5388336c02f","public.organization_people.organization_people_insert":"d70749ea80747143e06c1b5299cea121","public.organization_people.organization_people_update":"5a5aedfbdb2d599f0668e1b6fa97ec3f","public.portal_account_links.portal_account_links_read":"aec1e0dfdbfecce81dc800d3fbbeca7c","public.organization_admin_events.org_admin_events_read":"27a2a0baa684a610b0ec954a5c1478fc","public.organization_affiliations.affiliations_read_own":"45681686e02c95ee825b913d0e969c3d","public.followup_task_events.followup_event_financial_boundary":"9238d3585844e8603bd10648f1ba0985","public.organization_departments.organization_departments_read":"09af98dd249862a0622efe3bfec264db","public.organization_person_tags.organization_person_tags_read":"7b272929cf256486eb657a3b6d67f94b","public.organization_departments.organization_departments_insert":"3998dfd3648ce65da02328da6d6cd112","public.organization_departments.organization_departments_update":"e4d52bd7484509484bd76a5d25ca2c93","public.organization_person_tags.organization_person_tags_insert":"fca8e6eb60404f0491dc003a88ea2bf2","public.organization_person_tags.organization_person_tags_update":"779200cccc5bfcaba7ae98d62646b2dc","public.organization_staff_permissions.staff_permissions_read_own":"bc899a2e752262d8a7bee80df4c6a7a8","public.tag_workflow_notifications.tag_workflow_notifications_read":"eaec516a442d8b66ad101f23a498698e","public.giving_configuration_events.giving_configuration_events_read":"fbe124df72c1bce8e3f480b7ff4bb046","public.organization_admin_events.people_relationship_financial_boundary":"e63ebf2e1a078fdb9da8c84e616d0c35"},"migrations":[{"name":"create_course_progress_schema","version":"20260923114743","statements_hash":"7ce9d5544ed44c190e24c805b9f2a765"},{"name":"harden_course_security_and_indexes","version":"20260923114822","statements_hash":"66244fafbdabe35df3b78f00101aaac9"},{"name":"revoke_public_rls_helper_execution","version":"20260923115114","statements_hash":"3b0832f4d9b3861c47cf4e262129e4e8"},{"name":"grant_authenticated_course_api_access","version":"20260923115706","statements_hash":"63765885f5f250f0f7b37a3865ae5754"},{"name":"restrict_authenticated_course_privileges","version":"20260923115732","statements_hash":"32e78b814529389e9ca1e5463f2271be"},{"name":"add_st_lucia_registration_and_account_linking","version":"20260923121707","statements_hash":"3149c605cb524ed07759fa1766395572"},{"name":"secure_st_lucia_registration_claim_after_login","version":"20260923122017","statements_hash":"bcf038a2a29e57f05366197dc620f2fb"},{"name":"organization_foundation","version":"20260925200310","statements_hash":"f1383d9870bbcdb4c3a1094e1e6d89d0"},{"name":"harden_outreach_claim","version":"20260925200318","statements_hash":"e79ff7fd6aa9a198298bf0203fbf4bec"},{"name":"lesson_notes","version":"20260925202633","statements_hash":"9a09e24a5b3bd8e3e6ff4a0d9a4f52c6"},{"name":"followup_tasks","version":"20260926000821","statements_hash":"736e0306d89718634de571844a7600b1"},{"name":"staff_access_and_people","version":"20260926022613","statements_hash":"7b34868e2d31919ff14832b236736236"},{"name":"household_records","version":"20260926024742","statements_hash":"f5f309691ebe8cf6701cdb5dcb5ff68a"},{"name":"department_tags","version":"20260926032026","statements_hash":"be7f22706bf4049894f40efdc04b9e64"},{"name":"tag_workflows","version":"20260926034222","statements_hash":"45b1432f6df6213d1a8020ae505e38b7"},{"name":"giving_configuration","version":"20260926035410","statements_hash":"1ca75c592c093cdc473cef10618e6fb1"},{"name":"participant_portals","version":"20260926040812","statements_hash":"1d01d7fe75c2fd127d22875eb4c69727"},{"name":"people_staff_v1","version":"20260928172557","statements_hash":"e89dd27b23c8c1b7ce6c8903cffa3962"},{"name":"outreach_partner_intake_v1","version":"20261004055336","statements_hash":"8e5b069d1fabaafecffe252a024b45ef"},{"name":"allow_bessemer_outreach_registrations","version":"20261004154340","statements_hash":"a7787b9ca9fbd608e5b311e7f51d32fe"},{"name":"outreach_partner_gateway","version":"20261004230453","statements_hash":"d2b6e0f42fc801864599e88c990db047"},{"name":"outreach_network_limit_120","version":"20261005161946","statements_hash":"5eb7c9764bebb5f9b521067394b637db"},{"name":"20261016201932_huntsville_registration_foundation","version":"20261018113932","statements_hash":"ff6a4b0be78ac6bed3fe7abfd1c5c9bd"},{"name":"20261016201933_huntsville_registration_draft","version":"20261018113939","statements_hash":"4c7f005279963fa642b239d4c3290da4"},{"name":"20261018121900_allow_huntsville_decision_registrations","version":"20261018144843","statements_hash":"cec9b23f5503adb48503527375f798d6"},{"name":"operations_admin_security","version":"20261022201357","statements_hash":"e4e17986934ff2cc3bff197fc040c7dc"},{"name":"temporary_huntsville_three_staff_provisioner_install","version":"20261024013753","statements_hash":"16985390af194602a45c332291ac02fc"},{"name":"temporary_huntsville_three_staff_header_release_install","version":"20261024035121","statements_hash":"16985390af194602a45c332291ac02fc"},{"name":"temporary_huntsville_three_staff_pretty_url_release_install","version":"20261024120734","statements_hash":"16985390af194602a45c332291ac02fc"},{"name":"king_kind_private_reader_release","version":"20261027115906","statements_hash":"1e1156c2fc472f99dab5202574532803"},{"name":"dream_track_v1_recovery","version":"20261117155502","statements_hash":"0d01cdc8e493fcb2678082590993d017"},{"name":"outreach_volunteer_applications_v1","version":"20261117190320","statements_hash":"9d411b28067e10665b4129eeb82e674d"},{"name":"outreach_volunteer_review_list_fix","version":"20261117191223","statements_hash":"5b525686bebc4197a4aad6fce6dc9a7b"},{"name":"outreach_team_travel_v1_recovery","version":"20261118141019","statements_hash":"3e02dd04b515239595085b3b37b6b933"},{"name":"outreach_team_notices_v1_disabled","version":"20261118141048","statements_hash":"659979686dccdf70be36c48c0d33943e"},{"name":"p1_production_core_access_stop","version":"20261118152359","statements_hash":"0f269a75ec076ab45e24c99fe0b1e889"},{"name":"p1_production_core_access_restore","version":"20261118152540","statements_hash":"852fa884ea2afb06e868ea90cb29183c"}],"tables":{"auth.users":"ac864b137e1eb5ce2eb5a5510f81c900","auth.sessions":"c2528d8ee860ea563d2450ee685f4cd9","private.people":"11443622f7ec49eb4777cfc127b023d9","public.courses":"aac78f9e24252bbb451a3e634952d169","public.profiles":"9ed6df3293a0c2b724de84b1625370cb","storage.buckets":"85419b6f8da47dbadfa2acbe87191e5b","storage.objects":"369fa5bbee835866201eb6a6f310aec0","public.households":"1e24cb858d6dcf7cf19dd9fad1f65e1e","public.course_audit":"6d663e9172ab1dd6a2adae326d6d3fb1","public.giving_funds":"22c302a49c3b5f2fe46758d3e0082851","public.portal_areas":"6d0d57d534e9e3c1f145ff082dd933da","public.organizations":"692e3f411e287083cebdaaee7f7e2dcc","public.course_invites":"ab12077509ae7cce2faef23f33e219c7","public.course_lessons":"b73b7f9641161c834d488e1b8bc09bc0","public.followup_tasks":"88aaf3cc384c0e994054b954413fb7bc","public.lesson_answers":"3927e631f842ca5b3a34557501c4e9bf","public.course_attempts":"c087873edc1ebcfb0b0c3932ab9956ef","public.course_settings":"1113af4a25f7f466d779d524ad585002","public.lesson_progress":"c458ee22afdff54cfe0109e41d78b5bf","public.course_questions":"4ef89e80f3319b8ad2d3973827e0cc31","public.portal_resources":"914904e04be02f0d13dbeb2160926a0b","public.portal_tag_rules":"4610cde5f60c684e08ab96e2bbadb4ad","public.household_members":"017f7c17d64c50cefdb82d0d508c97f2","public.organization_tags":"0c569f527bf93eed4583fe86c68fbc15","public.tag_workflow_runs":"5fd7cdc9983e0b480b0008f80d3f0b97","public.course_completions":"5f8833669789916d21bf6badac89efc5","public.course_enrollments":"faecd856d372c12a4c3643e70289493f","public.giving_form_routes":"abedf32a00d40bf6c538745cfbca7be9","public.outreach_campaigns":"fdef091fd63f7473bf7283ddf0c17e2e","public.outreach_team_legs":"3cb5d34ab8397d862288b26922993808","public.course_claim_limits":"0f0b521ef614292d72261cffa63aa49f","public.giving_destinations":"10d0ec5ba23917e38bd657b60df3efaf","public.organization_people":"691777d398061d33f38795887f6d9bd3","public.portal_admin_events":"d2fa3505b617d2bb91df2937b1b4c7b2","public.tag_workflow_events":"61c3567aae852fde086ae26ba3832716","public.followup_task_events":"e4b3e652e3c16f84074a8034a34ec01d","public.portal_account_links":"67d8e00251ac4eb83ff550ee35d54449","public.staff_role_templates":"0d19fd1d1f0d0acee5a1db93e208a471","public.outreach_team_history":"59fed51df17b4378973e06d235bd93ce","public.outreach_team_members":"cb40fcd834fe74cfa9c8598fdb25be9c","public.outreach_registrations":"98a149bb95836e1388cc4c464bd055d8","public.outreach_team_vehicles":"eddb4a7b940d5bae570eda324d8a7def","private.outreach_abuse_windows":"06a881892c5b6a968e17c50b00cb3d3d","private.outreach_partner_audit":"059a3ac66776a64ae66e49fbef5cdd4b","public.organization_tag_events":"783e0974eca87c375c9ad10b2139259b","public.outreach_campaign_audit":"080d94949afd1c62c30d0208a900ba9d","private.outreach_volunteer_mail":"60a4473790e7b5159a16d5b2d9f08484","public.organization_departments":"2fd09949444df89e9c4c2620c3bf6e99","public.organization_person_tags":"e1780fdfda7bac75d30ce4b4e553cc53","public.outreach_campaign_admins":"7be81fb861247bd24c550c54efbb5297","public.outreach_campaign_events":"9d5a0cbe5844f55eda68d3e2b17650ab","public.outreach_event_attendees":"54e0ac4872f81f87f1a64e6fcabab5e6","public.outreach_partner_intakes":"9a4846ac9a9eb20a80c6828492994cff","public.outreach_waiver_versions":"59c6dd729a01662ecf332358efa71832","public.organization_admin_events":"cc913945fcf34e09462044ec3e0e7c3f","public.organization_affiliations":"719aa3f01a28404a2b49934692a4b881","private.outreach_volunteer_limits":"2abb672ef0776a951ce6fbd26d395e7c","public.outreach_waiver_signatures":"f7ca2ad17abcc77fb8df9ffa59dbb1e5","public.tag_workflow_notifications":"e2a6a2cef5e2d14b431dcb06f559338a","private.outreach_registration_rate":"9208b0633b6d720a4f48a2f178b07299","public.giving_configuration_events":"23b0a2bde8c50f620aeb43f39cbe53bd","public.outreach_prize_participants":"9f0c6748209d4123c9a3cc84b7245dd9","public.outreach_volunteer_settings":"1fd451b6e526e3f76badb5de467a4e42","public.outreach_waiver_corrections":"0e9d2e317ec6264db04f54ed777a7a09","private.outreach_team_notice_events":"1413b6eb2f4dfd0023f47ffc31b38f56","public.organization_staff_directory":"61b4ee9b519a62463e4159f7d297e3e9","public.outreach_event_registrations":"e38a49675f7a8cbf020b5afdb598bd3b","public.outreach_team_driver_reviews":"945a7b5ed03ccc25acf1277eabdeeef6","private.outreach_team_notice_intents":"b82b577ce6c1601409bf2d7c74ee6838","private.outreach_team_notice_runtime":"54b55b85f4065f665b840b843ed10a34","public.outreach_campaign_assignments":"30d736e2ee6833f8a077ae4d8e42d4e7","public.outreach_campaign_registrants":"d27b42a760b5b92c06e98cf4e453af54","private.outreach_team_notice_attempts":"70b93d737bd19af9acc54ff7b878828b","private.outreach_team_notice_policies":"54f39dd151556a3230619313d02434b4","private.outreach_team_notice_receipts":"11ded176dd10144d34628537df4a5081","public.organization_staff_permissions":"cbe3abdc9024625b791f579e4e1b47bb","public.outreach_registration_settings":"9f92b6fc9dd78d32c576ff5ba68edefa","public.person_department_affiliations":"cebd7b9e6cbe53b2fada931b88ec2db9","private.outreach_team_notice_operators":"e7a2f87e13f82b38665a3aced0854e49","public.outreach_volunteer_applications":"0bc00c6afc92ce01d04c16bd0fc72695","public.outreach_team_vehicle_assignments":"9a14b4e87cec094b8ff3e54f58882ee2","public.person_organization_relationships":"ce3abed5ac44fb6314ee0e0d09778f0e","private.outreach_team_notice_suppressions":"ec2f285091a1de198265dc53e898ce64","private.outreach_team_notice_receipt_bindings":"be7d8e420d41697e2ca94afd53cd7617","private.outreach_team_notice_receipt_conflicts":"3ad4eb711ac3fc1981cd8643673a17ea"}}$minden_expected$::jsonb into matches from actual;

if matches is distinct from true then raise exception 'Production catalog drift: re-review; never replay old installers';end if;
if current_user<>'postgres' or to_regclass('private.minden_decision_receipts') is not null then raise exception 'Wrong owner or partial candidate';end if;
if not exists(select 1 from storage.buckets where id='king-kind-books' and not public and file_size_limit=30000000 and allowed_mime_types=array['application/pdf']) or (select count(*) from storage.objects where bucket_id='king-kind-books' and name='king-kind/king-kind-english.pdf')<>1 then raise exception 'Private approved book prerequisite missing';end if;
end $minden_guard$;

-- FRAGMENT minden-decision-foundation-v2.sql
-- SOURCE-ONLY Minden decision foundation. No hosted execution or activation.
-- Existing canonical event only. No source map, staff grant or assignment seed.

do $$declare r record;begin
 if to_regprocedure('public.campaign_decision_foundation(text,uuid,uuid,jsonb)') is not null
 or to_regprocedure('public.outreach_minden_decisions(uuid)') is not null
 or to_regclass('public.outreach_decision_campaign_sources') is not null
 or to_regclass('public.outreach_decision_followup') is not null
 or to_regclass('public.outreach_decision_audit') is not null then
  raise exception 'Decision foundation already exists or unsafe/partial contract present';end if;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.outreach_campaign_assignments'::regclass
  and conname='outreach_campaign_assignments_capabilities_check') is distinct from 'ce4344b2acc39ee5c94f3e9b5acd27f9' then
  raise exception 'Current registration/Team/travel capability contract required';end if;
 for r in select * from(values
  ('private.staff_assignment_active(uuid,uuid)','05149569926640f4d39bca2eda70169d'),
  ('private.outreach_immutable()','824478818ca3407517607bb0ccc04752'))v(signature,fingerprint) loop
  if to_regprocedure(r.signature) is null or md5(pg_get_functiondef(to_regprocedure(r.signature))) is distinct from r.fingerprint then
   raise exception 'Decision security helper drift: %',r.signature;end if;
 end loop;
 if not exists(select 1 from public.outreach_campaigns c join public.organizations o on o.id=c.organization_id
  where c.id='d26b8337-d215-42d3-ac3b-c771f7f07db7' and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo') then
  raise exception 'Existing approved Minden event required';end if;
 if to_regclass('auth.sessions') is null or to_regprocedure('auth.jwt()') is null then raise exception 'Current Auth session primitives required';end if;
end $$;
alter table public.outreach_campaign_assignments
 add column care_scope text not null default 'campaign' check(care_scope in('campaign','assigned')),
 add column decision_effective_at timestamptz,
 add column decision_expires_at timestamptz;
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(
 capabilities <@ array['view','registration.view','registration.manage','registration.export','checkin.manage','team.view','team.manage','team.export','travel.view','travel.manage','travel.export','decisions.read','followup.manage','decisions.assign']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['team.manage','team.export']) or 'team.view'=any(capabilities))
 and (not(capabilities && array['travel.manage','travel.export']) or 'travel.view'=any(capabilities))
 and (not('followup.manage'=any(capabilities)) or 'decisions.read'=any(capabilities))
 and (not(capabilities && array['decisions.read','followup.manage','decisions.assign']) or
  ('view'=any(capabilities) and care_scope='assigned' and decision_effective_at is not null and decision_expires_at is not null
   and expires_at is not null and isfinite(expires_at) and isfinite(decision_effective_at) and isfinite(decision_expires_at)
   and decision_effective_at>=effective_at and decision_expires_at>decision_effective_at and decision_expires_at<=expires_at))
);
create table public.outreach_decision_campaign_sources(
 campaign_id uuid primary key references public.outreach_campaigns(id),
 source text not null unique check(source ~ '^[a-z0-9_]{3,80}$'),active boolean not null default false,
 revision integer not null default 1 check(revision>0)
);
create table public.outreach_decision_followup(
 registration_id uuid primary key references public.outreach_registrations(id),campaign_id uuid not null references public.outreach_campaigns(id),
 status text not null default 'new' check(status in('new','needs_contact','attempted','connected','in_progress','completed','declined')),
 assigned_user_id uuid references auth.users(id),assignment_expires_at timestamptz,
 next_contact_on date,updated_by uuid references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 revision integer not null default 1 check(revision>0),unique(campaign_id,registration_id),
 check((assigned_user_id is null and assignment_expires_at is null) or
  (assigned_user_id is not null and assignment_expires_at is not null and isfinite(assignment_expires_at)))
);
create index outreach_decision_followup_assigned_idx on public.outreach_decision_followup(campaign_id,assigned_user_id,registration_id);
create table public.outreach_decision_audit(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,registration_id uuid not null,
 actor_kind text not null check(actor_kind in('service_intake','verified_staff')),actor_user_id uuid references auth.users(id),
 action text not null check(action in('service_intake','assignment_save','followup_save')),request_id uuid not null,
 request_payload jsonb not null,before_state jsonb,after_state jsonb not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(campaign_id,request_id),foreign key(campaign_id,registration_id) references public.outreach_decision_followup(campaign_id,registration_id),
 check((actor_kind='service_intake' and actor_user_id is null and action='service_intake') or
  (actor_kind='verified_staff' and actor_user_id is not null and action in('assignment_save','followup_save')))
);
create trigger outreach_decision_audit_immutable before update or delete on public.outreach_decision_audit for each row execute function private.outreach_immutable();
alter table public.outreach_decision_campaign_sources enable row level security;
alter table public.outreach_decision_followup enable row level security;
alter table public.outreach_decision_audit enable row level security;
revoke all on public.outreach_decision_campaign_sources,public.outreach_decision_followup,public.outreach_decision_audit from public,anon,authenticated,service_role;

-- Current server-verified session, reusable by the separately reviewed reader.
-- Held SHARE locks serialize account/session revocation; time is rechecked after waits.
create function private.minden_decision_session() returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid;sid uuid;expiry timestamptz;u auth.users;s auth.sessions;claims jsonb;
begin
 begin
  actor:=auth.uid();claims:=auth.jwt();sid:=(claims->>'session_id')::uuid;
  if coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then raise invalid_text_representation;end if;
  expiry:=to_timestamp((claims->>'exp')::bigint);
 exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Decision access unavailable' using errcode='42501';end;
 if actor is null or sid is null or expiry<=clock_timestamp() then raise exception 'Decision access unavailable' using errcode='42501';end if;
 select * into u from auth.users where id=actor for share;
 select * into s from auth.sessions where id=sid and user_id=actor for share;
 if u.id is null or u.email_confirmed_at is null or coalesce(u.is_anonymous,false) or u.deleted_at is not null
 or (u.banned_until is not null and u.banned_until>clock_timestamp()) or s.id is null
 or (s.not_after is not null and s.not_after<=clock_timestamp()) or expiry<=clock_timestamp() then
  raise exception 'Decision access unavailable' using errcode='42501';end if;
 return actor;
end $$;

-- No owner, registration, People or other module authority substitutes for this
-- exact finite campaign capability. Preserve canonical staff person-link checks.
create function private.minden_decision_authority(c uuid,u uuid,cap text) returns timestamptz language plpgsql volatile security definer set search_path='' as $$
declare campaign public.outreach_campaigns;d public.organization_staff_directory;a public.outreach_campaign_assignments;account auth.users;deadline timestamptz;
begin
 if c is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid or cap is null or cap not in('decisions.read','followup.manage','decisions.assign') then return null;end if;
 select x.* into campaign from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id
  where x.id=c and x.code='minden_la_2026' and x.public_slug='minden-2026' and o.slug='sowgo' for share of x;
 if campaign.id is null then return null;end if;
 select * into d from public.organization_staff_directory where organization_id=campaign.organization_id and user_id=u for share;
 select * into a from public.outreach_campaign_assignments where campaign_id=c and user_id=u for share;
 select * into account from auth.users where id=u for share;
 if d.user_id is null or not d.active or d.effective_at>clock_timestamp() or (d.expires_at is not null and d.expires_at<=clock_timestamp())
 or account.id is null or account.email_confirmed_at is null or coalesce(account.is_anonymous,false) or account.deleted_at is not null
 or (account.banned_until is not null and account.banned_until>clock_timestamp())
 or not private.staff_assignment_active(campaign.organization_id,u) or a.user_id is null or not a.active
 or a.effective_at>clock_timestamp() or a.expires_at is null or not isfinite(a.expires_at) or a.expires_at<=clock_timestamp()
 or a.care_scope<>'assigned' or not('view'=any(a.capabilities)) or not(cap=any(a.capabilities))
 or (cap='followup.manage' and not('decisions.read'=any(a.capabilities)))
 or a.decision_effective_at is null or a.decision_expires_at is null or not isfinite(a.decision_effective_at) or not isfinite(a.decision_expires_at)
 or a.decision_effective_at>clock_timestamp() or a.decision_expires_at<=clock_timestamp() then return null;end if;
 if d.person_id is not null then
  perform 1 from public.portal_account_links l where l.organization_id=campaign.organization_id and l.user_id=u and l.person_id=d.person_id and l.active for share;
  if not found then return null;end if;
 end if;
 deadline:=least(a.expires_at,a.decision_expires_at,coalesce(d.expires_at,'infinity'::timestamptz));
 if deadline<=clock_timestamp() then return null;end if;return deadline;
end $$;
create function private.minden_decision_consent(r uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare allowed boolean;
begin
 if to_regprocedure('private.minden_decision_followup_consent(uuid)') is null then return false;end if;
 execute 'select private.minden_decision_followup_consent($1)' into allowed using r;
 return allowed is true;
end $$;

-- Root's service intake must call this in the same transaction AFTER its legacy
-- registration + UNASSIGNED followup insert. No staff attribution is fabricated.
create function private.minden_decision_record_intake(c uuid,r uuid,request uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare f public.outreach_decision_followup;receipt public.outreach_decision_audit;payload jsonb:=jsonb_build_object('registration_id',r);
begin
 if c is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid or r is null or request is null then raise exception 'Invalid service intake';end if;
 if not exists(select 1 from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id where x.id=c and x.code='minden_la_2026' and x.public_slug='minden-2026' and o.slug='sowgo')
 or not exists(select 1 from public.outreach_decision_campaign_sources where campaign_id=c and source='minden_la_outreach' and active) then raise exception 'Reviewed Minden source required';end if;
 select * into f from public.outreach_decision_followup where campaign_id=c and registration_id=r;
 if not found or not exists(select 1 from public.outreach_registrations where id=r and source='minden_la_outreach') then raise exception 'Exact service intake required';end if;
 select * into receipt from public.outreach_decision_audit where campaign_id=c and request_id=request;
 if found then
  if receipt.actor_kind<>'service_intake' or receipt.registration_id<>r or receipt.request_payload<>payload then raise exception 'Conflicting intake receipt' using errcode='23505';end if;return;
 end if;
 if f.assigned_user_id is not null or f.assignment_expires_at is not null or f.updated_by is not null or f.revision<>1 or f.status<>'new' or f.next_contact_on is not null then raise exception 'Unassigned initial intake required';end if;
 insert into public.outreach_decision_audit(campaign_id,registration_id,actor_kind,action,request_id,request_payload,before_state,after_state)
 values(c,r,'service_intake','service_intake',request,payload,null,to_jsonb(f));
end $$;

create function private.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid;org uuid;cap text;deadline timestamptz;target_deadline timestamptz;f public.outreach_decision_followup;r public.outreach_registrations;
 item record;rows jsonb:='[]';result jsonb;rid uuid;target uuid;expires timestamptz;request uuid;expected integer;why text;receipt public.outreach_decision_audit;before_row jsonb;after_row jsonb;page_number integer:=0;allowed boolean;
begin
 actor:=private.minden_decision_session();
 if p_action is null or p_action not in('context','list','detail','followup_save','queue','assignees','assignment_get','assignment_save')
 or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>3000 then raise exception 'Invalid decision request' using errcode='22023';end if;
 if p_campaign is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid then raise exception 'Decision access unavailable' using errcode='42501';end if;
 select c.organization_id into org from public.outreach_campaigns c join public.organizations o on o.id=c.organization_id
 where c.id=p_campaign and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo' for share of c;
 if org is null or (p_org is distinct from org and not(p_action='context' and p_org is null)) then raise exception 'Decision access unavailable' using errcode='42501';end if;
 cap:=case when p_action in('queue','assignees','assignment_get','assignment_save') then 'decisions.assign' when p_action='followup_save' then 'followup.manage' else 'decisions.read' end;
 deadline:=private.minden_decision_authority(p_campaign,actor,cap);
 if p_action='context' and deadline is null then deadline:=private.minden_decision_authority(p_campaign,actor,'decisions.assign');end if;
 if deadline is null then raise exception 'Decision access unavailable' using errcode='42501';end if;
 perform 1 from public.outreach_decision_campaign_sources where campaign_id=p_campaign and source='minden_la_outreach' and active for share;
 if not found then raise exception 'Reviewed Minden source required' using errcode='42501';end if;
 if p_action in('context','queue','assignees') and p_payload<>'{}'::jsonb then raise exception 'Unexpected request fields' using errcode='22023';end if;
 if p_action='context' then
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'scope','assigned','expires_at',least(deadline,to_timestamp((auth.jwt()->>'exp')::bigint),(select coalesce(not_after,'infinity'::timestamptz) from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=actor)),'server_time',clock_timestamp(),
   'capabilities',to_jsonb(array(select k from unnest(array['decisions.read','followup.manage','decisions.assign']) k where private.minden_decision_authority(p_campaign,actor,k) is not null)));
 elsif p_action='queue' then
  select coalesce(jsonb_agg(jsonb_build_object('registration_id',x.registration_id,'registered_at',x.created_at) order by x.created_at,x.registration_id),'[]') into rows
  from(select fu.registration_id,reg.created_at from public.outreach_decision_followup fu join public.outreach_registrations reg on reg.id=fu.registration_id and reg.source='minden_la_outreach'
   where fu.campaign_id=p_campaign and (fu.assigned_user_id is null or fu.assignment_expires_at<=clock_timestamp() or private.minden_decision_authority(p_campaign,fu.assigned_user_id,'decisions.read') is null) order by reg.created_at,reg.id limit 50)x;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'queue',rows);
 elsif p_action='assignees' then
  for item in select a.user_id from public.outreach_campaign_assignments a where a.campaign_id=p_campaign order by a.user_id loop
   target_deadline:=private.minden_decision_authority(p_campaign,item.user_id,'decisions.read');
   if target_deadline is not null then rows:=rows||jsonb_build_array(jsonb_build_object('user_id',item.user_id,'expires_at',target_deadline));end if;
  end loop;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'assignees',rows);
 elsif p_action='list' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'page') or (p_payload?'page' and coalesce(p_payload->>'page','') !~ '^[0-9]{1,4}$') then raise exception 'Invalid page' using errcode='22023';end if;
  page_number:=coalesce((p_payload->>'page')::integer,0);
  for item in select fu.*,reg.first_name,reg.last_name,reg.decision,reg.created_at from public.outreach_decision_followup fu join public.outreach_registrations reg on reg.id=fu.registration_id and reg.source='minden_la_outreach'
   where fu.campaign_id=p_campaign and fu.assigned_user_id=actor and fu.assignment_expires_at>clock_timestamp()
   order by reg.created_at,reg.id limit 50 offset page_number*50 for share of fu,reg loop
   deadline:=least(deadline,item.assignment_expires_at);
   allowed:=private.minden_decision_authority(p_campaign,actor,'followup.manage') is not null and private.minden_decision_consent(item.registration_id);
   rows:=rows||jsonb_build_array(jsonb_build_object('registration_id',item.registration_id,'name',concat_ws(' ',item.first_name,item.last_name),'decision',item.decision,
    'registered_at',item.created_at,'status',item.status,'revision',item.revision,'next_contact_on',item.next_contact_on,'followup_allowed',allowed,'contact_allowed',false));
  end loop;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'page',page_number,'registrations',rows);
 else
  if coalesce(p_payload->>'registration_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Registration required' using errcode='22023';end if;
  rid:=(p_payload->>'registration_id')::uuid;
  select * into f from public.outreach_decision_followup where registration_id=rid for update;
  select * into r from public.outreach_registrations where id=rid for share;
  if f.registration_id is null or f.campaign_id<>p_campaign or r.source is distinct from 'minden_la_outreach' then raise exception 'Decision access unavailable' using errcode='42501';end if;
  if p_action in('detail','followup_save') and (f.assigned_user_id is distinct from actor or f.assignment_expires_at<=clock_timestamp()) then raise exception 'Decision access unavailable' using errcode='42501';end if;
  if p_action in('detail','followup_save') then deadline:=least(deadline,f.assignment_expires_at);end if;
  if p_action='detail' then
   if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'registration_id') then raise exception 'Unexpected request fields' using errcode='22023';end if;
   allowed:=private.minden_decision_authority(p_campaign,actor,'followup.manage') is not null and private.minden_decision_consent(rid);
   result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'registration_id',rid,'name',concat_ws(' ',r.first_name,r.last_name),'decision',r.decision,
    'registered_at',r.created_at,'status',f.status,'revision',f.revision,'next_contact_on',f.next_contact_on,'followup_allowed',allowed,'contact_allowed',false);
  elsif p_action='assignment_get' then
   if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'registration_id') then raise exception 'Unexpected request fields' using errcode='22023';end if;
   result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'registration_id',rid,'assigned_user_id',f.assigned_user_id,'expires_at',f.assignment_expires_at,'revision',f.revision,'updated_at',f.updated_at);
  else
   if coalesce(p_payload->>'revision','') !~ '^[1-9][0-9]{0,7}$' or coalesce(p_payload->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Revision and request key required' using errcode='22023';end if;
   expected:=(p_payload->>'revision')::integer;request:=(p_payload->>'request_id')::uuid;
   before_row:=to_jsonb(f);
   select * into receipt from public.outreach_decision_audit where campaign_id=p_campaign and request_id=request;
   if found then
    if receipt.actor_kind<>'verified_staff' or receipt.actor_user_id<>actor or receipt.action<>p_action or receipt.registration_id<>rid or receipt.request_payload<>p_payload then raise exception 'Conflicting decision retry' using errcode='23505';end if;
    if receipt.after_state is distinct from before_row then raise exception 'Decision changed; reload' using errcode='40001';end if;
    if p_action='assignment_save' then target:=f.assigned_user_id;expires:=f.assignment_expires_at;end if;
    result:=jsonb_build_object('saved',true,'revision',f.revision,'replayed',true);
   else
    if f.revision<>expected then raise exception 'Decision changed; reload' using errcode='40001';end if;
    if p_action='assignment_save' then
     if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('registration_id','revision','request_id','assigned_user_id','expires_at','reason'))
      or not(p_payload?'assigned_user_id') or not(p_payload?'expires_at') or jsonb_typeof(p_payload->'reason') is distinct from 'string'
      or length(btrim(p_payload->>'reason')) not between 10 and 500 then raise exception 'Explicit assignment review required' using errcode='22023';end if;
     why:=btrim(p_payload->>'reason');
     if p_payload->'assigned_user_id'='null'::jsonb then
      if p_payload->'expires_at' is distinct from 'null'::jsonb then raise exception 'Revoke requires null expiry' using errcode='22023';end if;target:=null;expires:=null;
     else
      if coalesce(p_payload->>'assigned_user_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(p_payload->'expires_at') is distinct from 'string' then raise exception 'Finite reviewed assignee required' using errcode='22023';end if;
      target:=(p_payload->>'assigned_user_id')::uuid;
      begin expires:=(p_payload->>'expires_at')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Finite assignment expiry required' using errcode='22023';end;
      target_deadline:=private.minden_decision_authority(p_campaign,target,'decisions.read');
      if target_deadline is null or not isfinite(expires) or expires<=clock_timestamp() or expires>least(deadline,target_deadline) then raise exception 'Assignee authority or expiry unavailable' using errcode='42501';end if;
     end if;
     update public.outreach_decision_followup set assigned_user_id=target,assignment_expires_at=expires,updated_by=actor,updated_at=clock_timestamp(),revision=revision+1 where registration_id=rid returning * into f;
    else
     if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('registration_id','revision','request_id','status','next_contact_on'))
      or coalesce(p_payload->>'status','') not in('new','needs_contact','attempted','connected','in_progress','completed','declined')
      or not(p_payload?'next_contact_on') or (p_payload->>'next_contact_on' is not null and (p_payload->>'next_contact_on') !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Invalid follow-up update' using errcode='22023';end if;
     if r.consent is distinct from true or not private.minden_decision_consent(rid) then raise exception 'Current follow-up consent required' using errcode='42501';end if;
     update public.outreach_decision_followup set status=p_payload->>'status',next_contact_on=(p_payload->>'next_contact_on')::date,updated_by=actor,updated_at=clock_timestamp(),revision=revision+1 where registration_id=rid returning * into f;
    end if;
    after_row:=to_jsonb(f);
    insert into public.outreach_decision_audit(campaign_id,registration_id,actor_kind,actor_user_id,action,request_id,request_payload,before_state,after_state)
     values(p_campaign,rid,'verified_staff',actor,p_action,request,p_payload,before_row,after_row);
    result:=jsonb_build_object('saved',true,'revision',f.revision,'replayed',false);
   end if;
  end if;
 end if;
 -- Any expiry/session change crossed during row, receipt or audit waits rolls
 -- back both mutation and audit. Repeat all relevant current authority/consent.
 perform private.minden_decision_session();
 if private.minden_decision_authority(p_campaign,actor,cap) is null and not(p_action='context' and private.minden_decision_authority(p_campaign,actor,'decisions.assign') is not null)
 or deadline<=clock_timestamp() then raise exception 'Decision access unavailable' using errcode='42501';end if;
 if p_action in('detail','followup_save') and f.assignment_expires_at<=clock_timestamp() then raise exception 'Decision assignment expired' using errcode='42501';end if;
 if p_action='assignment_save' and target is not null and (expires<=clock_timestamp() or expires>private.minden_decision_authority(p_campaign,target,'decisions.read') or private.minden_decision_authority(p_campaign,target,'decisions.read') is null) then raise exception 'Assignee authority expired' using errcode='42501';end if;
 if p_action='followup_save' and (r.consent is distinct from true or not private.minden_decision_consent(rid)) then raise exception 'Current follow-up consent required' using errcode='42501';end if;
 perform private.minden_decision_session();
 if deadline<=clock_timestamp() or (p_action='assignment_save' and target is not null and expires<=clock_timestamp()) then raise exception 'Decision access expired' using errcode='42501';end if;
 return result||jsonb_build_object('access_expires_at',least(deadline,to_timestamp((auth.jwt()->>'exp')::bigint),(select coalesce(not_after,'infinity'::timestamptz) from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=actor)),'server_time',clock_timestamp());
end $$;
create function public.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.campaign_decision_foundation(p_action,p_org,p_campaign,p_payload)
$$;
revoke all on function private.minden_decision_session(),private.minden_decision_authority(uuid,uuid,text),private.minden_decision_consent(uuid),private.minden_decision_record_intake(uuid,uuid,uuid),private.campaign_decision_foundation(text,uuid,uuid,jsonb),public.campaign_decision_foundation(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.campaign_decision_foundation(text,uuid,uuid,jsonb),public.campaign_decision_foundation(text,uuid,uuid,jsonb) to authenticated;
grant execute on function private.minden_decision_record_intake(uuid,uuid,uuid) to service_role;

-- FRAGMENT minden-decision-intake-v2.sql
-- SOURCE CANDIDATE ONLY. No production application or policy approval is implied.
-- This fragment follows minden-decision-foundation-v2.sql in one forward transaction.
create table private.minden_decision_policies (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 version text not null check(length(version) between 1 and 80),
 copy jsonb not null check(jsonb_typeof(copy)='object'), allow_guardian boolean not null default false,
 approved_by uuid not null references auth.users(id), approval_reference text not null check(length(approval_reference) between 12 and 500),
 approved_at timestamptz not null, effective_at timestamptz not null, expires_at timestamptz not null,
 check(isfinite(approved_at) and isfinite(effective_at) and isfinite(expires_at) and approved_at<=effective_at and effective_at<expires_at), unique(campaign_id,version)
);
create trigger minden_decision_policy_immutable before update or delete on private.minden_decision_policies for each row execute function private.outreach_immutable();
create table private.minden_decision_runtime (
 campaign_id uuid primary key references public.outreach_campaigns(id), enabled boolean not null default false,
 reader_enabled boolean not null default false, active_policy_id uuid references private.minden_decision_policies(id),
 revision integer not null default 1 check(revision>0), check(not enabled or active_policy_id is not null), check(not reader_enabled or active_policy_id is not null)
);
create table private.minden_decision_receipts (
 request_id uuid primary key, secret_hash text not null check(secret_hash~'^[0-9a-f]{64}$'), payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),
 campaign_id uuid not null references public.outreach_campaigns(id), registration_id uuid not null unique references public.outreach_registrations(id),
 policy_id uuid not null references private.minden_decision_policies(id), locale text not null check(locale in ('en','es')),
 subject_kind text not null check(subject_kind in ('adult_self','guardian')),
 guardian_name text, resource_consent boolean not null, followup_consent boolean not null,
 resource_revoked_at timestamptz, followup_revoked_at timestamptz,
 accepted_at timestamptz not null default clock_timestamp(), check(subject_kind<>'guardian' or length(guardian_name) between 1 and 100)
);
create function private.minden_decision_receipt_immutable() returns trigger language plpgsql set search_path='' as $$
 begin
 if tg_op='DELETE' then raise exception 'Receipt is immutable' using errcode='42501'; end if;
 if (to_jsonb(old)-array['resource_revoked_at','followup_revoked_at']) is distinct from (to_jsonb(new)-array['resource_revoked_at','followup_revoked_at'])
 or (old.resource_revoked_at is not null and new.resource_revoked_at is distinct from old.resource_revoked_at)
 or (old.followup_revoked_at is not null and new.followup_revoked_at is distinct from old.followup_revoked_at)
 or new.resource_revoked_at>clock_timestamp() or new.followup_revoked_at>clock_timestamp() then raise exception 'Receipt binding/revocation is immutable' using errcode='42501'; end if;
 return new;
 end $$;
revoke all on function private.minden_decision_receipt_immutable() from public,anon,authenticated,service_role;
create trigger minden_decision_receipt_immutable before update or delete on private.minden_decision_receipts for each row execute function private.minden_decision_receipt_immutable();
create table private.minden_decision_consent_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references private.minden_decision_receipts(request_id),
 actor_user_id uuid not null references auth.users(id), resource_withdrawn boolean not null, followup_withdrawn boolean not null,
 recorded_at timestamptz not null default clock_timestamp(), check(resource_withdrawn or followup_withdrawn)
);
create trigger minden_decision_consent_event_immutable before update or delete on private.minden_decision_consent_events for each row execute function private.outreach_immutable();
create table private.minden_decision_token_spends(token_hash text primary key check(token_hash~'^[0-9a-f]{64}$'), request_id uuid not null unique references private.minden_decision_receipts(request_id));
create table private.minden_decision_network_windows(network_hash text not null check(network_hash~'^[0-9a-f]{64}$'), window_start timestamptz not null, count integer not null check(count>0), primary key(network_hash,window_start));
alter table private.minden_decision_policies enable row level security;
alter table private.minden_decision_runtime enable row level security;
alter table private.minden_decision_receipts enable row level security;
alter table private.minden_decision_token_spends enable row level security;
alter table private.minden_decision_consent_events enable row level security;
alter table private.minden_decision_network_windows enable row level security;
revoke all on private.minden_decision_policies,private.minden_decision_runtime,private.minden_decision_receipts,private.minden_decision_token_spends,private.minden_decision_network_windows,private.minden_decision_consent_events from public,anon,authenticated,service_role;
-- No mapping, policy, runtime activation, staff grant, Person merge or email is installed here.

create function private.minden_decision_policy_valid(p private.minden_decision_policies) returns boolean language sql volatile set search_path='' as $$
 select p.campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid
 and p.effective_at<=clock_timestamp() and p.expires_at>clock_timestamp()
 and not exists(select 1 from unnest(array['en','es']) l cross join unnest(array['processing','resource','followup','adult','guardian']) k where
 jsonb_typeof(p.copy->l->k) is distinct from 'string' or length(p.copy->l->>k) not between 12 and 4000)
$$;
create function private.minden_decision_public_config() returns jsonb language plpgsql security definer set search_path='' as $$
 declare p private.minden_decision_policies; r private.minden_decision_runtime;
 begin
 select * into r from private.minden_decision_runtime where campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7';
 select * into p from private.minden_decision_policies where id=r.active_policy_id and campaign_id=r.campaign_id;
 if not coalesce(r.enabled,false) or not coalesce(private.minden_decision_policy_valid(p),false) or not exists(select 1 from public.outreach_decision_campaign_sources s join public.outreach_campaigns c on c.id=s.campaign_id join public.organizations o on o.id=c.organization_id where s.campaign_id=r.campaign_id and s.active and s.source='minden_la_outreach' and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo' and c.status not in('cancelled','closed')) then return jsonb_build_object('enabled',false); end if;
 return jsonb_build_object('enabled',true,'policy_id',p.id,'version',p.version,'copy',p.copy,'allow_guardian',p.allow_guardian);
 end $$;
-- Fixed no-argument public config facade matches current registration config pattern;
-- avoids adding anonymous USAGE to the private schema. Returns approved non-PII copy only.
create function public.minden_decision_config() returns jsonb language sql security definer set search_path='' as $$select private.minden_decision_public_config()$$;
revoke all on function private.minden_decision_public_config(),public.minden_decision_config() from public;
grant execute on function public.minden_decision_config() to anon,authenticated;

create function private.minden_decision_gateway(p_action text,p_request uuid,p_secret text,p_payload jsonb default '{}'::jsonb,p_network text default null,p_token_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.outreach_campaigns; r private.minden_decision_runtime; p private.minden_decision_policies; receipt private.minden_decision_receipts; x jsonb; h text; reg uuid; counter integer; win timestamptz; k text; v text;
 begin
 if p_request is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' or p_action is null or p_action not in ('status','submit') then raise exception 'Invalid receipt request' using errcode='22023'; end if;
 -- Same-key requests serialize even before a receipt exists. No unbounded lock-key namespace or PII in logs.
 perform pg_advisory_xact_lock(hashtextextended('minden-decision:'||p_request::text,0));
 select * into receipt from private.minden_decision_receipts where request_id=p_request;
 h:=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
 if receipt.request_id is not null then
  if receipt.secret_hash<>h then return jsonb_build_object('state','UNKNOWN'); end if;
  if p_action='submit' and receipt.payload_hash<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then return jsonb_build_object('state','CONFLICT'); end if;
  return jsonb_build_object('state','ACCEPTED','receipt',receipt.request_id,'accepted_at',receipt.accepted_at);
 end if;
 if p_action='status' then return jsonb_build_object('state','UNKNOWN'); end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload) t(key) where key<>all(array['first_name','last_name','email','phone','decision','prayer_request','policy_id','locale','subject_kind','guardian_name','processing_consent','resource_consent','followup_consent','adult_attested','guardian_attested'])) then raise exception 'Invalid fields' using errcode='22023'; end if;
 for k in select unnest(array['first_name','last_name','email','phone','decision','prayer_request','policy_id','locale','subject_kind','guardian_name']) loop
  if jsonb_typeof(p_payload->k) is distinct from 'string' then raise exception 'Invalid fields' using errcode='22023'; end if;
 end loop;
 for k in select unnest(array['processing_consent','resource_consent','followup_consent','adult_attested','guardian_attested']) loop
  if jsonb_typeof(p_payload->k) is distinct from 'boolean' then raise exception 'Invalid consent' using errcode='22023'; end if;
 end loop;
 if length(btrim(p_payload->>'first_name')) not between 1 and 100 or length(btrim(p_payload->>'last_name')) not between 1 and 100 or length(btrim(p_payload->>'email')) not between 3 and 320 or p_payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_payload->>'phone')>40 or (length(p_payload->>'phone')>0 and length(p_payload->>'phone')<7) or length(p_payload->>'prayer_request')>2000 or p_payload->>'decision' not in ('salvation','rededication','learn_more','prayer_followup') or p_payload->>'locale' not in ('en','es') or p_payload->>'subject_kind' not in ('adult_self','guardian') or p_payload->'processing_consent'<>'true'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
 if p_network is null or p_network !~ '^[0-9a-f]{64}$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Verified proof required' using errcode='42501'; end if;
 select * into c from public.outreach_campaigns where id='d26b8337-d215-42d3-ac3b-c771f7f07db7' for share;
 if c.id is null or c.code<>'minden_la_2026' or c.public_slug<>'minden-2026' or c.status in ('cancelled','closed') or not exists(select 1 from public.organizations where id=c.organization_id and slug='sowgo') then raise exception 'Intake closed' using errcode='42501'; end if;
 select * into r from private.minden_decision_runtime where campaign_id=c.id for share;
 select * into p from private.minden_decision_policies where id=r.active_policy_id and campaign_id=c.id for share;
 if not coalesce(r.enabled,false) or not coalesce(private.minden_decision_policy_valid(p),false) then raise exception 'Intake closed' using errcode='42501'; end if;
 if p_payload->>'policy_id'<>p.id::text then raise exception 'Consent changed; review current consent' using errcode='40001'; end if;
 perform 1 from public.outreach_decision_campaign_sources where campaign_id=c.id and source='minden_la_outreach' and active for share;
 if not found then raise exception 'Intake closed' using errcode='42501'; end if;
 if p_payload->>'subject_kind'='adult_self' then
  if p_payload->'adult_attested'<>'true'::jsonb or p_payload->'guardian_attested'<>'false'::jsonb or p_payload->>'guardian_name'<>'' then raise exception 'Adult attestation required' using errcode='22023'; end if;
 else
  if not p.allow_guardian or p_payload->'guardian_attested'<>'true'::jsonb or p_payload->'adult_attested'<>'true'::jsonb or length(btrim(p_payload->>'guardian_name')) not between 1 and 100 then raise exception 'Guardian authority required' using errcode='22023'; end if;
 end if;
 win:=date_trunc('hour',clock_timestamp());
 insert into private.minden_decision_network_windows values(p_network,win,1) on conflict(network_hash,window_start) do update set count=private.minden_decision_network_windows.count+1 returning count into counter;
 if counter>12 then return jsonb_build_object('state','RATE_LIMITED'); end if;
 reg:=gen_random_uuid();
 insert into public.outreach_registrations(id,first_name,last_name,email,phone,decision,prayer_request,consent,source)
 values(reg,btrim(p_payload->>'first_name'),btrim(p_payload->>'last_name'),lower(btrim(p_payload->>'email')),btrim(p_payload->>'phone'),p_payload->>'decision',nullif(p_payload->>'prayer_request',''),true,'minden_la_outreach');
 insert into public.outreach_decision_followup(registration_id,campaign_id) values(reg,c.id);
 insert into private.minden_decision_receipts(request_id,secret_hash,payload_hash,campaign_id,registration_id,policy_id,locale,subject_kind,guardian_name,resource_consent,followup_consent)
 values(p_request,h,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),c.id,reg,p.id,p_payload->>'locale',p_payload->>'subject_kind',nullif(btrim(p_payload->>'guardian_name'),''),(p_payload->>'resource_consent')::boolean,(p_payload->>'followup_consent')::boolean);
 insert into private.minden_decision_token_spends values(p_token_hash,p_request);
 perform private.minden_decision_record_intake(c.id,reg,p_request);
 -- Recheck real time after any waits; expiry during lock acquisition is a denial with complete rollback.
 if not private.minden_decision_policy_valid(p) or p.expires_at<=clock_timestamp() then raise exception 'Consent expired' using errcode='40001'; end if;
 return jsonb_build_object('state','ACCEPTED','receipt',p_request,'accepted_at',clock_timestamp());
 end $$;
create function public.minden_decision_gateway(p_action text,p_request uuid,p_secret text,p_payload jsonb default '{}'::jsonb,p_network text default null,p_token_hash text default null) returns jsonb language sql security invoker set search_path='' as $$select private.minden_decision_gateway(p_action,p_request,p_secret,p_payload,p_network,p_token_hash)$$;
revoke all on function private.minden_decision_gateway(text,uuid,text,jsonb,text,text),public.minden_decision_gateway(text,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.minden_decision_gateway(text,uuid,text,jsonb,text,text),public.minden_decision_gateway(text,uuid,text,jsonb,text,text) to service_role;

create function private.minden_decision_followup_consent(p_registration uuid) returns boolean language plpgsql security definer set search_path='' as $$
 declare r private.minden_decision_receipts; p private.minden_decision_policies; runtime private.minden_decision_runtime;
 begin
 select * into r from private.minden_decision_receipts where registration_id=p_registration for share;
 select * into runtime from private.minden_decision_runtime where campaign_id=r.campaign_id for share;
 select * into p from private.minden_decision_policies where id=r.policy_id and campaign_id=r.campaign_id for share;
 return coalesce(r.followup_consent and r.followup_revoked_at is null and runtime.active_policy_id=r.policy_id and private.minden_decision_policy_valid(p) and p.expires_at>clock_timestamp(),false);
 end $$;
revoke all on function private.minden_decision_policy_valid(private.minden_decision_policies),private.minden_decision_followup_consent(uuid) from public,anon,authenticated,service_role;

create function private.minden_decision_revoke(p_request uuid,p_resource boolean,p_followup boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare u uuid; email_address text; r private.minden_decision_receipts;
 begin
 if p_resource is null or p_followup is null or not(p_resource or p_followup) then raise exception 'Choose a permission to withdraw' using errcode='22023'; end if;
 u:=private.minden_decision_session();
 select lower(btrim(email)) into email_address from auth.users where id=u;
 select x.* into r from private.minden_decision_receipts x join public.outreach_registrations d on d.id=x.registration_id where x.request_id=p_request and lower(btrim(d.email))=email_address for update of x;
 if r.request_id is null then raise exception 'Receipt unavailable' using errcode='42501'; end if;
 if (p_resource and r.resource_revoked_at is null) or (p_followup and r.followup_revoked_at is null) then
 insert into private.minden_decision_consent_events(request_id,actor_user_id,resource_withdrawn,followup_withdrawn) values(p_request,u,p_resource and r.resource_revoked_at is null,p_followup and r.followup_revoked_at is null);
 end if;
 update private.minden_decision_receipts set resource_revoked_at=case when p_resource then coalesce(resource_revoked_at,clock_timestamp()) else resource_revoked_at end,followup_revoked_at=case when p_followup then coalesce(followup_revoked_at,clock_timestamp()) else followup_revoked_at end where request_id=p_request;
 perform private.minden_decision_session();
 return jsonb_build_object('revoked',true);
 end $$;
create function public.minden_decision_revoke(p_request uuid,p_resource boolean,p_followup boolean) returns jsonb language sql security invoker set search_path='' as $$select private.minden_decision_revoke(p_request,p_resource,p_followup)$$;
revoke all on function private.minden_decision_revoke(uuid,boolean,boolean),public.minden_decision_revoke(uuid,boolean,boolean) from public,anon;
grant execute on function private.minden_decision_revoke(uuid,boolean,boolean),public.minden_decision_revoke(uuid,boolean,boolean) to authenticated;


-- FRAGMENT minden-king-kind-entitlement-v2.sql
-- Compose the Minden receipt entitlement with the exact existing two-city entitlement.
-- No bucket, object, storage policy, Auth redirect, Site URL or SMTP change.
create or replace function app_private.can_read_king_kind()
returns boolean language plpgsql stable security definer set search_path='' as $$
 declare u uuid;
 begin
 -- Preserve the already deployed Bessemer/Huntsville contract.
 if exists(select 1 from auth.users u join public.outreach_registrations r on lower(btrim(r.email))=lower(btrim(u.email)) where u.id=auth.uid() and u.email_confirmed_at is not null and r.consent=true and r.source in('bessemer_al_2026','huntsville_al_2026')) then return true; end if;
 begin u:=private.minden_decision_session(); exception when insufficient_privilege then return false; end;
 return exists(select 1 from auth.users a join public.outreach_registrations d on lower(btrim(d.email))=lower(btrim(a.email))
 join private.minden_decision_receipts x on x.registration_id=d.id
 join private.minden_decision_policies p on p.id=x.policy_id and p.campaign_id=x.campaign_id
 join private.minden_decision_runtime r on r.campaign_id=x.campaign_id
 join public.outreach_decision_campaign_sources s on s.campaign_id=x.campaign_id
 where a.id=u and x.campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7' and d.source='minden_la_outreach'
 and s.source=d.source and s.active and r.reader_enabled and x.resource_consent and x.resource_revoked_at is null
 and r.active_policy_id=x.policy_id and private.minden_decision_policy_valid(p) and p.expires_at>clock_timestamp());
 end $$;
revoke all on function app_private.can_read_king_kind() from public,anon;
grant execute on function app_private.can_read_king_kind() to authenticated;


-- FRAGMENT minden-family-intake-disabled-v2.sql
-- Deliberately installs NO attendee settings, waiver version, grant or anonymous insert policy.
-- Existing campaign is the approved canonical Minden event. Do not create another event.
-- Attendee intake remains disabled until local host/park/LA waiver/guardian/media/privacy/bike rules
-- and exact activation package receive separate owner approval. No Huntsville terms may be used.
do $$ begin
 if exists(select 1 from public.outreach_registration_settings where campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7' and enabled) then
  raise exception 'Minden attendee intake unexpectedly enabled; stop for reconciliation';
 end if;
end $$;


-- FRAGMENT minden-decision-recovery-v2.sql
-- Source-only stop/recovery primitives. No stop/restore action executes on install.
create table private.minden_decision_release_stops(
 id uuid primary key default gen_random_uuid(),reference text not null,
 prior_runtime jsonb,prior_source jsonb,stopped_at timestamptz not null default clock_timestamp(),restored_at timestamptz
);
alter table private.minden_decision_release_stops enable row level security;
revoke all on private.minden_decision_release_stops from public,anon,authenticated,service_role;
create function private.minden_decision_stop(p_reference text) returns uuid language plpgsql security invoker set search_path='' as $$
 declare c uuid:='d26b8337-d215-42d3-ac3b-c771f7f07db7';r private.minden_decision_runtime;s public.outreach_decision_campaign_sources;i uuid;
 begin
 if current_user<>'postgres' or length(btrim(p_reference)) not between 12 and 500 or p_reference is null then raise exception 'Explicit stop reference and owner required' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 if exists(select 1 from private.minden_decision_release_stops where restored_at is null) then raise exception 'Existing unresolved stop; do not overwrite snapshot';end if;
 select * into r from private.minden_decision_runtime where campaign_id=c for update;
 select * into s from public.outreach_decision_campaign_sources where campaign_id=c for update;
 insert into private.minden_decision_release_stops(reference,prior_runtime,prior_source)values(p_reference,case when r.campaign_id is not null then to_jsonb(r) end,case when s.campaign_id is not null then to_jsonb(s) end) returning id into i;
 update private.minden_decision_runtime set enabled=false,reader_enabled=false,revision=revision+1 where campaign_id=c;
 update public.outreach_decision_campaign_sources set active=false,revision=revision+1 where campaign_id=c;
 return i;
 end $$;
create function private.minden_decision_restore(p_stop uuid,p_reference text) returns boolean language plpgsql security invoker set search_path='' as $$
 declare c uuid:='d26b8337-d215-42d3-ac3b-c771f7f07db7';state private.minden_decision_release_stops;r private.minden_decision_runtime;s public.outreach_decision_campaign_sources;
 begin
 if current_user<>'postgres' or length(btrim(p_reference)) not between 12 and 500 or p_reference is null then raise exception 'Explicit restore reference and owner required' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 select * into state from private.minden_decision_release_stops where id=p_stop and restored_at is null for update;
 if state.id is null then raise exception 'Exact unresolved stop required';end if;
 select * into r from private.minden_decision_runtime where campaign_id=c for update;
 select * into s from public.outreach_decision_campaign_sources where campaign_id=c for update;
 if (state.prior_runtime is null)<>(r.campaign_id is null) or (state.prior_source is null)<>(s.campaign_id is null)
 or (state.prior_runtime is not null and to_jsonb(r) is distinct from state.prior_runtime||jsonb_build_object('enabled',false,'reader_enabled',false,'revision',(state.prior_runtime->>'revision')::integer+1))
 or (state.prior_source is not null and to_jsonb(s) is distinct from state.prior_source||jsonb_build_object('active',false,'revision',(state.prior_source->>'revision')::integer+1)) then raise exception 'Stop state drift; reconcile instead of overwriting';end if;
 update private.minden_decision_runtime set enabled=(state.prior_runtime->>'enabled')::boolean,reader_enabled=(state.prior_runtime->>'reader_enabled')::boolean,revision=revision+1 where campaign_id=c;
 update public.outreach_decision_campaign_sources set active=(state.prior_source->>'active')::boolean,revision=revision+1 where campaign_id=c;
 update private.minden_decision_release_stops set restored_at=clock_timestamp(),reference=reference||E'\nRESTORE: '||p_reference where id=p_stop;
 return true;
 end $$;
revoke all on function private.minden_decision_stop(text),private.minden_decision_restore(uuid,text) from public,anon,authenticated,service_role;

commit;
