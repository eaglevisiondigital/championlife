-- Source-only successor. No hosted execution, seed mappings, grants to people,
-- identity links, contact routes, historical RPC replacement or UI activation.
-- Requires PR72's exact registration baseline, not PR35's broad migration chain.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.outreach_decision_campaign_sources') IS NOT NULL
 OR to_regclass('public.outreach_decision_followup') IS NOT NULL THEN
  RAISE EXCEPTION 'Existing decision foundation requires explicit reconciliation';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.outreach_campaign_assignments'::regclass
  AND conname='outreach_campaign_assignments_capabilities_check'
  AND pg_get_constraintdef(oid) = $baseline$CHECK (((capabilities <@ ARRAY['view'::text, 'registration.view'::text, 'registration.manage'::text, 'registration.export'::text, 'checkin.manage'::text]) AND (cardinality(capabilities) > 0) AND (array_position(capabilities, NULL::text) IS NULL) AND ((NOT (capabilities && ARRAY['registration.manage'::text, 'registration.export'::text, 'checkin.manage'::text])) OR ('registration.view'::text = ANY (capabilities)))))$baseline$) THEN
  RAISE EXCEPTION 'Unreviewed campaign capability baseline';
 END IF;
 IF to_regclass('auth.sessions') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN
  RAISE EXCEPTION 'Current provider session primitives required';
 END IF;
 IF (SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('private.outreach_immutable()')) IS DISTINCT FROM 'e3cbb5520d2fd4742808a369ea3215d2812f3f2f677469327122bdf114b0ac75' THEN RAISE EXCEPTION 'Unreviewed outreach_immutable baseline'; END IF;
 IF (SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('private.set_portal_account_link(uuid,uuid,text,boolean,text,integer)')) IS DISTINCT FROM '49c036e4d1ca79a93bbd95ecef9cf81490d0084a95eff194cf66a17470289680' THEN RAISE EXCEPTION 'Unreviewed set_portal_account_link baseline'; END IF;
 IF (SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('private.outreach_registration_workspace(text,uuid,jsonb)')) IS DISTINCT FROM '866f7e8a1c4ff02fa23ebe09fb4c1aa799a1387f24bdda85e4bfa1fceddd80ae' THEN RAISE EXCEPTION 'Unreviewed outreach_registration_workspace baseline'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('users','id','uuid'),('users','email_confirmed_at','timestamp with time zone'),('users','is_anonymous','boolean'),('users','deleted_at','timestamp with time zone'),('users','banned_until','timestamp with time zone'),('sessions','id','uuid'),('sessions','user_id','uuid'),('sessions','not_after','timestamp with time zone')) need(tbl,col,typ) WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname=need.tbl AND a.attname=need.col AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=need.typ)) THEN RAISE EXCEPTION 'Unreviewed provider session column contract'; END IF;
END $$;

-- Preserve every existing registration capability. Nothing activates these new
-- separately reviewed finite capabilities, including existing campaign admins.
ALTER TABLE public.outreach_campaign_assignments
 ADD COLUMN care_scope text NOT NULL DEFAULT 'campaign' CHECK(care_scope IN ('campaign','assigned')),
 ADD COLUMN decision_effective_at timestamptz,
 ADD COLUMN decision_expires_at timestamptz;
ALTER TABLE public.outreach_campaign_assignments DROP CONSTRAINT outreach_campaign_assignments_capabilities_check;
ALTER TABLE public.outreach_campaign_assignments ADD CONSTRAINT outreach_campaign_assignments_capabilities_check CHECK(
 capabilities <@ ARRAY['view','registration.view','registration.manage','registration.export','checkin.manage','decisions.read','followup.manage']::text[]
 AND cardinality(capabilities)>0 AND array_position(capabilities,NULL) IS NULL
 AND (NOT(capabilities && ARRAY['registration.manage','registration.export','checkin.manage']) OR 'registration.view'=ANY(capabilities))
 AND (NOT('followup.manage'=ANY(capabilities)) OR 'decisions.read'=ANY(capabilities))
 AND (NOT('decisions.read'=ANY(capabilities)) OR
  ('view'=ANY(capabilities) AND care_scope='assigned' AND decision_effective_at IS NOT NULL AND decision_expires_at IS NOT NULL
   AND isfinite(decision_effective_at) AND isfinite(decision_expires_at) AND decision_expires_at>decision_effective_at))
);

-- Accepted Issue50 names and shapes: sources are mappings, never copied people.
CREATE TABLE public.outreach_decision_campaign_sources(
 campaign_id uuid PRIMARY KEY REFERENCES public.outreach_campaigns(id),
 source text NOT NULL UNIQUE CHECK(source ~ '^[a-z0-9_]{3,80}$'), active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.outreach_decision_followup(
 registration_id uuid PRIMARY KEY REFERENCES public.outreach_registrations(id),
 campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','needs_contact','attempted','connected','in_progress','completed','declined')),
 assigned_user_id uuid REFERENCES auth.users(id), next_contact_on date,
 updated_by uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), UNIQUE(campaign_id,registration_id)
);
CREATE INDEX outreach_decision_followup_assigned_idx ON public.outreach_decision_followup(campaign_id,assigned_user_id,registration_id);
CREATE TABLE public.outreach_decision_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL,
 registration_id uuid NOT NULL, actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL CHECK(action='followup.updated'), request_id uuid NOT NULL,
 request_payload jsonb NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(campaign_id,request_id),
 FOREIGN KEY(campaign_id,registration_id) REFERENCES public.outreach_decision_followup(campaign_id,registration_id)
);
CREATE TRIGGER outreach_decision_audit_immutable BEFORE UPDATE OR DELETE ON public.outreach_decision_audit
 FOR EACH ROW EXECUTE FUNCTION private.outreach_immutable();
ALTER TABLE public.outreach_decision_campaign_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_decision_followup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_decision_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outreach_decision_campaign_sources,public.outreach_decision_followup,public.outreach_decision_audit
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.campaign_foundation_session() RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); sid uuid; expiry timestamptz; valid boolean; claims jsonb:=auth.jwt();
BEGIN
 BEGIN
  sid:=(claims->>'session_id')::uuid;
  IF coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' THEN RAISE invalid_text_representation; END IF;
  expiry:=to_timestamp((claims->>'exp')::bigint);
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501';
 END;
 IF actor IS NULL OR sid IS NULL OR expiry<=clock_timestamp() THEN
  RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501';
 END IF;
 SELECT email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)
  AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=clock_timestamp()) INTO valid
 FROM auth.users WHERE id=actor FOR SHARE;
 IF valid IS DISTINCT FROM true THEN RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501'; END IF;
 SELECT not_after IS NULL OR not_after>clock_timestamp() INTO valid FROM auth.sessions WHERE id=sid AND user_id=actor FOR SHARE;
 IF valid IS DISTINCT FROM true OR expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;

CREATE FUNCTION private.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; c public.outreach_campaigns; a public.outreach_campaign_assignments;
 src text; f public.outreach_decision_followup; r public.outreach_registrations; item record;
 result jsonb; rows jsonb:='[]'; person uuid; subject uuid; identity_state text;
 target uuid; expected integer; request uuid; receipt public.outreach_decision_audit;
 before_row jsonb; after_row jsonb; deadline timestamptz; page_number integer:=0;
BEGIN
 actor:=private.campaign_foundation_session();
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>2000
 OR p_action IS NULL OR p_action NOT IN ('context','list','detail','followup_save','learner_status') THEN
  RAISE EXCEPTION 'Invalid decision request' USING ERRCODE='22023';
 END IF;
 IF p_action='learner_status' THEN
  IF p_org IS NOT NULL OR p_campaign IS NOT NULL OR p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Owner scope required' USING ERRCODE='22023'; END IF;
  -- This base permits owner-written progress. It is activity, NOT trusted completion.
  SELECT jsonb_build_object('kind','own-learner-activity','book','not_instrumented',
   'completion_authority','unavailable','courses',coalesce(jsonb_agg(jsonb_build_object(
    'course_id',e.course_id,'enrolled_at',e.started_at,'activity_recorded',EXISTS(SELECT 1 FROM public.lesson_progress p WHERE p.user_id=actor AND p.course_id=e.course_id),
    'last_activity_at',(SELECT max(p.updated_at) FROM public.lesson_progress p WHERE p.user_id=actor AND p.course_id=e.course_id)) ORDER BY e.course_id),'[]'::jsonb))
   INTO result FROM public.course_enrollments e WHERE e.user_id=actor;
  PERFORM private.campaign_foundation_session(); RETURN result;
 END IF;
 -- Locks protect revocation and exact org/campaign mapping. No admin, organization
 -- People, registration.view or old decision.view capability substitutes.
 SELECT * INTO c FROM public.outreach_campaigns WHERE id=p_campaign AND organization_id=p_org FOR SHARE;
 SELECT * INTO a FROM public.outreach_campaign_assignments WHERE campaign_id=p_campaign AND user_id=actor FOR SHARE;
 SELECT source INTO src FROM public.outreach_decision_campaign_sources WHERE campaign_id=p_campaign AND active FOR SHARE;
 IF c.id IS NULL OR src IS NULL OR a.user_id IS NULL OR NOT a.active OR a.effective_at>clock_timestamp()
 OR a.expires_at<=clock_timestamp() OR a.care_scope<>'assigned'
 OR NOT('view'=ANY(a.capabilities)) OR NOT('decisions.read'=ANY(a.capabilities))
 OR a.decision_effective_at IS NULL OR a.decision_expires_at IS NULL
 OR a.decision_effective_at>clock_timestamp() OR a.decision_expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501';
 END IF;
 deadline:=least(coalesce(a.expires_at,'infinity'),a.decision_expires_at);
 IF p_action='context' THEN
  IF p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Unexpected request fields' USING ERRCODE='22023'; END IF;
  result:=jsonb_build_object('organization_id',p_org,'campaign_id',p_campaign,'scope','assigned','capabilities',
   CASE WHEN 'followup.manage'=ANY(a.capabilities) THEN jsonb_build_array('decisions.read','followup.manage') ELSE jsonb_build_array('decisions.read') END);
 ELSIF p_action='list' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'page') OR
   (p_payload ? 'page' AND coalesce(p_payload->>'page','') !~ '^[0-9]{1,4}$') THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
  page_number:=coalesce((p_payload->>'page')::integer,0);
  FOR item IN SELECT d.id,d.first_name,d.last_name,d.decision,d.created_at,d.consent,x.status,x.revision,x.next_contact_on
   FROM public.outreach_decision_followup x JOIN public.outreach_registrations d ON d.id=x.registration_id AND d.source=src
   WHERE x.campaign_id=p_campaign AND x.assigned_user_id=actor ORDER BY d.created_at,d.id LIMIT 50 OFFSET page_number*50 FOR SHARE OF x,d
  LOOP rows:=rows||jsonb_build_array(jsonb_build_object('registration_id',item.id,'kind','decision-free-book-registration',
   'name',concat_ws(' ',item.first_name,item.last_name),'decision',item.decision,'registered_at',item.created_at,'consent',item.consent,
   'status',item.status,'revision',item.revision,'next_contact_on',item.next_contact_on,'contact_allowed',false)); END LOOP;
  result:=jsonb_build_object('organization_id',p_org,'campaign_id',p_campaign,'page',page_number,'registrations',rows);
 ELSE
  IF coalesce(p_payload->>'registration_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Registration required' USING ERRCODE='22023'; END IF;
  target:=(p_payload->>'registration_id')::uuid;
  -- Lock by identity first, then validate ownership AFTER a queued reassignment.
  SELECT * INTO f FROM public.outreach_decision_followup WHERE registration_id=target FOR UPDATE;
  SELECT * INTO r FROM public.outreach_registrations WHERE id=target FOR SHARE;
  IF f.registration_id IS NULL OR f.campaign_id<>p_campaign OR f.assigned_user_id IS DISTINCT FROM actor OR r.source IS DISTINCT FROM src THEN
   RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501';
  END IF;
  IF p_action='detail' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k<>'registration_id') THEN RAISE EXCEPTION 'Unexpected request fields' USING ERRCODE='22023'; END IF;
   -- Match identifiers already bound by separately reviewed canonical workflows.
   -- An email, name, or optional person_id alone proves nothing.
   SELECT cr.person_id,l.user_id INTO person,subject FROM public.outreach_campaign_registrants cr
    JOIN public.organization_people op ON op.organization_id=cr.organization_id AND op.id=cr.person_id
    JOIN public.portal_account_links l ON l.organization_id=op.organization_id AND l.person_id=op.id AND l.active
    JOIN public.portal_admin_events current_link_event ON current_link_event.organization_id=p_org AND current_link_event.kind='account_link'
     AND current_link_event.subject_id=l.id AND current_link_event.after_state=to_jsonb(l)
    JOIN public.portal_admin_events original_link_event ON original_link_event.organization_id=p_org AND original_link_event.kind='account_link'
     AND original_link_event.subject_id=l.id AND original_link_event.before_state IS NULL
     AND original_link_event.after_state->>'user_id'=l.user_id::text
     AND original_link_event.after_state->>'person_id'=l.person_id::text
     AND original_link_event.after_state->>'organization_id'=p_org::text
    JOIN auth.users u ON u.id=l.user_id AND u.id=r.user_id AND u.email_confirmed_at IS NOT NULL
     AND NOT coalesce(u.is_anonymous,false) AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
    WHERE cr.campaign_id=p_campaign AND cr.organization_id=p_org AND cr.legacy_registration_id=r.id
    FOR SHARE OF cr,op,l,u,current_link_event,original_link_event;
   identity_state:=CASE WHEN person IS NULL THEN 'not_linked' ELSE 'reviewed_existing_account_link' END;
   result:=jsonb_build_object('organization_id',p_org,'campaign_id',p_campaign,'registration_id',r.id,
    'kind','decision-free-book-registration','name',concat_ws(' ',r.first_name,r.last_name),'decision',r.decision,
    'registered_at',r.created_at,'consent',r.consent,'person_id',person,'identity_status',identity_state,
    'status',f.status,'revision',f.revision,'next_contact_on',f.next_contact_on,
    'contact_allowed',false,'contact_reason','verified_contact_route_not_installed',
    'book','not_instrumented','course','separate_permission_and_authority_required');
  ELSE
   IF NOT('followup.manage'=ANY(a.capabilities)) OR r.consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Follow-up access unavailable' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('registration_id','revision','status','next_contact_on','request_id'))
    OR coalesce(p_payload->>'revision','') !~ '^[1-9][0-9]{0,7}$'
    OR coalesce(p_payload->>'status','') NOT IN ('new','needs_contact','attempted','connected','in_progress','completed','declined')
    OR coalesce(p_payload->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR (p_payload->>'next_contact_on' IS NOT NULL AND (p_payload->>'next_contact_on') !~ '^\d{4}-\d{2}-\d{2}$') THEN
    RAISE EXCEPTION 'Invalid follow-up update' USING ERRCODE='22023';
   END IF;
   request:=(p_payload->>'request_id')::uuid; expected:=(p_payload->>'revision')::integer;
   SELECT * INTO receipt FROM public.outreach_decision_audit WHERE campaign_id=p_campaign AND request_id=request;
   IF receipt.id IS NOT NULL THEN
    IF receipt.registration_id<>r.id OR receipt.actor_user_id<>actor OR receipt.request_payload<>p_payload THEN
     RAISE EXCEPTION 'Conflicting follow-up retry' USING ERRCODE='23505';
    END IF;
    IF receipt.after_state IS DISTINCT FROM jsonb_build_object('status',f.status,'next_contact_on',f.next_contact_on,'revision',f.revision) THEN
     RAISE EXCEPTION 'Follow-up changed; reload' USING ERRCODE='40001';
    END IF;
    result:=jsonb_build_object('saved',true,'revision',receipt.after_state->'revision','replayed',true);
   ELSE
    IF f.revision<>expected THEN RAISE EXCEPTION 'Follow-up changed; reload' USING ERRCODE='40001'; END IF;
    before_row:=jsonb_build_object('status',f.status,'next_contact_on',f.next_contact_on,'revision',f.revision);
    UPDATE public.outreach_decision_followup SET status=p_payload->>'status',next_contact_on=(p_payload->>'next_contact_on')::date,
     updated_by=actor,updated_at=clock_timestamp(),revision=revision+1 WHERE registration_id=r.id AND revision=expected RETURNING * INTO f;
    IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up changed; reload' USING ERRCODE='40001'; END IF;
    after_row:=jsonb_build_object('status',f.status,'next_contact_on',f.next_contact_on,'revision',f.revision);
    INSERT INTO public.outreach_decision_audit(campaign_id,registration_id,actor_user_id,action,request_id,request_payload,before_state,after_state)
     VALUES(p_campaign,r.id,actor,'followup.updated',request,p_payload,before_row,after_row);
    result:=jsonb_build_object('saved',true,'revision',f.revision,'replayed',false);
   END IF;
  END IF;
 END IF;
 -- Expiry crossed during row/audit waits rolls back mutation and audit together.
 PERFORM private.campaign_foundation_session();
 IF clock_timestamp()>=deadline THEN RAISE EXCEPTION 'Decision access unavailable' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.campaign_decision_foundation(p_action,p_org,p_campaign,p_payload)
$$;
REVOKE ALL ON FUNCTION private.campaign_foundation_session(),private.campaign_decision_foundation(text,uuid,uuid,jsonb),
 public.campaign_decision_foundation(text,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.campaign_decision_foundation(text,uuid,uuid,jsonb),public.campaign_decision_foundation(text,uuid,uuid,jsonb) TO authenticated;
COMMIT;
