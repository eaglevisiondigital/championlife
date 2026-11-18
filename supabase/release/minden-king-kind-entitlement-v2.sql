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
