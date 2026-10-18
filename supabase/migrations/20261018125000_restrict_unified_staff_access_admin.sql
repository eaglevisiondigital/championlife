create or replace function private.outreach_access_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select private.outreach_verified(auth.uid()) and exists(
   select 1
   from public.organizations o
   where o.slug in ('champion-life','sowgo')
     and private.has_staff_permission(o.id,'staff.manage')
 )
$$;
