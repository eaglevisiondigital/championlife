import {f,fixtureSQL} from './communications-fixture.mjs';export{f,fixtureSQL};
export const h={profile:'ffffffff-ffff-4fff-8fff-ffffffffffa1',ref:'bkbmjisprwmkptywtmih'};
export const activationFixtureSQL=`
insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.user}',unnest(array['communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable']);
update communication_external_control set environment='acceptance',project_ref='${h.ref}';
insert into communication_super_admins(user_id,active,expires_at,approved_by,reason)values('${f.user}',true,now()+interval '1 day','${f.user}','Synthetic local global control');
insert into communication_sender_profiles(id,organization_id,channel,provider,display_name,from_address,reply_to,active,approved_at)values('${h.profile}','${f.org}','email','smtp_transport','Synthetic Church','smtp@example.test','reply@example.test',false,now());
insert into communication_provider_controls(profile_id,organization_id,environment,project_ref,provider_name,configured,sender_approved,mode)values('${h.profile}','${f.org}','acceptance','${h.ref}','Synthetic SMTP',true,true,'configured');
insert into communication_consents(organization_id,recipient_key,channel,purpose,status,source,proof_reference,recorded_by)values('${f.org}','person:${f.person}','email','transactional','granted','Synthetic test approval','synthetic-proof','${f.user}');
insert into communication_test_allowlist(organization_id,channel,recipient,purpose,expires_at,approved_by)values('${f.org}','email','ada@example.test','transactional',now()+interval '1 day','${f.user}');
`;
