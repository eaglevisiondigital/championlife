-- Shared Platform Gate 0. Forward-only; vocabulary does not materialize grants.
-- Existing migration files, assignments, role templates and authorization helpers stay unchanged.
begin;
create function private.platform_capability_catalog() returns jsonb
language sql immutable set search_path='' as $catalog$
 select '{"version":1,"organization":["care.read","checkin.manage","checkin.view","communications.bulk_send","communications.delivery.view","communications.providers.enable","communications.providers.manage","communications.providers.test","communications.providers.view","communications.send","communications.templates.manage","communications.templates.view","communications.view","courses.manage","discipleship.read","dream_team.application.manage","dream_team.application.read","dream_team.application.restricted","dream_team.placement.manage","events.manage","events.view","finance.configure","finance.export","finance.gifts.adjust","finance.gifts.create","finance.gifts.read","finance.merchant.configure","finance.pledges.manage","finance.pledges.read","finance.read","finance.reconciliation.manage","finance.reconciliation.read","finance.recurring.manage","finance.recurring.read","finance.refunds.manage","finance.reports.export","finance.reports.merchant","finance.reports.read","finance.statements.generate","followup.manage","followup.read","forms.archive","forms.create","forms.edit","forms.manage","forms.payment.configure","forms.publish","forms.read","forms.submissions.export","forms.submissions.read","forms.view","households.manage","households.read","outreach.manage","outreach.view","payments.configure","payments.issue.assign","payments.manage","payments.method.manage","payments.provider.activate","payments.reconcile","payments.recurring.manage","payments.refund","payments.refund.approve","payments.refund.execute","payments.refund.request","payments.route","payments.view","payments.void","payments.void.approve","payments.void.execute","payments.void.request","people.create","people.export","people.notes.manage","people.notes.view","people.read","people.update","portal.manage","registrations.manage","registrations.override","registrations.restricted","registrations.view","staff.manage","staff.view","tags.manage","tags.read"],"campaign":["checkin.manage","communications.bulk_send","communications.delivery.view","communications.send","communications.templates.manage","communications.templates.view","communications.view","decision.manage","decision.view","decisions","documents","draw","export","followup","host.respond","host.view","inventory.manage","inventory.view","issue.manage","ops.manage","ops.view","preevent.manage","preevent.view","prize.claim","prize.draw","prize.manage","prize.view","registration.export","registration.manage","registration.view","team.manage","team.view","travel.manage","travel.view","view","workflow"],"partner":["partner.view","partner.followup","partner.assign_local","partner.export","partner.pastoral_notes"],"rule":"Vocabulary is not authority. Organization grants, campaign assignments and partner church assignments are separate; no scope translation or automatic grants."}'::jsonb
$catalog$;
revoke all on function private.platform_capability_catalog() from public,anon,authenticated;
-- Additive union with any capabilities installed since the pinned candidates.
-- Never derive valid permissions from arbitrary data or from user metadata.
do $$declare keys text[];begin
 keys:=array(select distinct k from unnest(private.staff_permission_keys() || array['care.read','checkin.manage','checkin.view','communications.bulk_send','communications.delivery.view','communications.providers.enable','communications.providers.manage','communications.providers.test','communications.providers.view','communications.send','communications.templates.manage','communications.templates.view','communications.view','courses.manage','discipleship.read','dream_team.application.manage','dream_team.application.read','dream_team.application.restricted','dream_team.placement.manage','events.manage','events.view','finance.configure','finance.export','finance.gifts.adjust','finance.gifts.create','finance.gifts.read','finance.merchant.configure','finance.pledges.manage','finance.pledges.read','finance.read','finance.reconciliation.manage','finance.reconciliation.read','finance.recurring.manage','finance.recurring.read','finance.refunds.manage','finance.reports.export','finance.reports.merchant','finance.reports.read','finance.statements.generate','followup.manage','followup.read','forms.archive','forms.create','forms.edit','forms.manage','forms.payment.configure','forms.publish','forms.read','forms.submissions.export','forms.submissions.read','forms.view','households.manage','households.read','outreach.manage','outreach.view','payments.configure','payments.issue.assign','payments.manage','payments.method.manage','payments.provider.activate','payments.reconcile','payments.recurring.manage','payments.refund','payments.refund.approve','payments.refund.execute','payments.refund.request','payments.route','payments.view','payments.void','payments.void.approve','payments.void.execute','payments.void.request','people.create','people.export','people.notes.manage','people.notes.view','people.read','people.update','portal.manage','registrations.manage','registrations.override','registrations.restricted','registrations.view','staff.manage','staff.view','tags.manage','tags.read']::text[])k order by k);
 alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
 execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
 execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end$$;
-- Scope-specific campaign/partner constraints and prerequisite rules stay owned by
-- their existing authorizers. The catalog never converts those into organization grants.
create function public.shared_platform_context() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; value jsonb; item record;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 result:=jsonb_build_object('staff',public.staff_workspace_context(),'modules',jsonb_build_array());
 for item in select * from (values
 ('outreach','public.unified_outreach_context()','select public.unified_outreach_context()'),
 ('giving','public.giving_workspace(text,uuid,jsonb)', 'select public.giving_workspace(''context'',null::uuid,''{}''::jsonb)'),
 ('forms','public.forms_workspace(text,uuid,jsonb)', 'select public.forms_workspace(''context'',null::uuid,''{}''::jsonb)'),
 ('payments','public.payments_workspace(text,uuid,jsonb)', 'select public.payments_workspace(''context'',null::uuid,''{}''::jsonb)'),
 ('communications','public.communications_workspace(text,uuid,jsonb)', 'select public.communications_workspace(''context'',null::uuid,''{}''::jsonb)')
 ) as installed(module,signature,statement) loop
  if to_regprocedure(item.signature) is not null then
   result:=jsonb_set(result,'{modules}',(result->'modules')||to_jsonb(item.module));
   begin
    execute item.statement into value;
   exception when insufficient_privilege then value:=null;
   end;
   result:=result||jsonb_build_object(item.module,value);
  end if;
 end loop;
 if to_regprocedure('public.unified_outreach_context()') is not null then
  execute 'select public.outreach_decision_workspace(''campaigns'',null::uuid,''{}''::jsonb)' into value;
  result:=result||jsonb_build_object('decisions',value);
  execute 'select public.outreach_partner_workspace(''partners'',null::uuid,''{}''::jsonb)' into value;
  result:=result||jsonb_build_object('partners',value);
 end if;
 return result;
end$$;
revoke all on function public.shared_platform_context() from public,anon,authenticated;
grant execute on function public.shared_platform_context() to authenticated;
commit;
