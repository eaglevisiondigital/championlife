-- Source-only successor. Uses the existing campaign lock shared with attendee_add.
-- Preserve the installed workspace body, ACL, owner, audit and authorization rules.
begin;
do $migration$
declare
 definition text := pg_get_functiondef('private.outreach_registration_workspace(text,uuid,jsonb)'::regprocedure);
 anchor text := $anchor$   if m.checked_in_at is not null then raise exception 'Reverse check-in before editing attendee';end if;
   perform private.outreach_registration_answers(c,coalesce(p->'answers',m.answers));$anchor$;
 replacement text := $replacement$   if m.checked_in_at is not null then raise exception 'Reverse check-in before editing attendee';end if;
   -- The caller already holds the same campaign lock as attendee_add.
   if not m.active and coalesce((p->>'active')::boolean,false) and
      (select count(*) from public.outreach_event_attendees where registration_id=r.id and active)>=30 then
    raise exception 'Household attendee limit reached';
   end if;
   perform private.outreach_registration_answers(c,coalesce(p->'answers',m.answers));$replacement$;
begin
 if (select md5(prosrc) from pg_proc where oid='private.outreach_registration_workspace(text,uuid,jsonb)'::regprocedure) <> 'ad750e647756c6e45590932313cdd052'
    or (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1
    or position($lock$perform 1 from public.outreach_campaigns where outreach_campaigns.id=c for update;
  if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;$lock$ in definition)=0 then
  raise exception 'Incompatible registration workspace; review restoration capacity migration';
 end if;
 execute replace(definition,anchor,replacement);
end
$migration$;
commit;
