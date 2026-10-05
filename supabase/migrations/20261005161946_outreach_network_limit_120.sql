-- Approved initial policy. Preserve already-applied gateway migration history.
create or replace function private.outreach_abuse_limit(p_dimension text) returns integer
 language sql immutable security invoker set search_path='' as $$
 select case p_dimension when 'network' then 120 when 'email' then 5 when 'phone' then 5 else 0 end
$$;
revoke all on function private.outreach_abuse_limit(text) from public,anon,authenticated,service_role;
