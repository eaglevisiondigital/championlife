-- Source-only directory successor to exact PR80. No seeds, grants to users,
-- source mapping writes, issuance, contact access, or public staff mount.
BEGIN;
DO $$
DECLARE item record; proc oid; owner_id oid;
BEGIN
 IF to_regprocedure('public.campaign_decision_directory()') IS NOT NULL
 OR to_regprocedure('private.campaign_decision_directory()') IS NOT NULL THEN
  RAISE EXCEPTION 'Existing decision directory requires explicit reconciliation';
 END IF;
 FOR item IN SELECT * FROM (VALUES
  ('public.campaign_decision_foundation(text,uuid,uuid,jsonb)','76f41d6e5ddbe2c59e01ee4f392d9a1f90a3b0936849571ab27ada239bbbb6bb',true),
  ('private.campaign_decision_foundation(text,uuid,uuid,jsonb)','1994d8005e185bb3f97f53353f1699a3837ec9fe9afca4480a5bbff131e02bba',true),
  ('private.campaign_foundation_session()','d29e82b9aa314f78f79e842ede2f2269878a6bfb713769973e5e7420fe75a90e',false)
 ) expected(signature,sha256,authenticated_execute)
 LOOP
  proc:=to_regprocedure(item.signature);
  IF proc IS NULL OR (SELECT encode(sha256(convert_to(pg_get_functiondef(proc),'UTF8')),'hex')) IS DISTINCT FROM item.sha256 THEN
   RAISE EXCEPTION 'Unreviewed campaign foundation function: %',item.signature;
  END IF;
  SELECT proowner INTO owner_id FROM pg_proc WHERE oid=proc;
  IF EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   WHERE p.oid=proc AND (acl.grantee NOT IN (owner_id,CASE WHEN item.authenticated_execute THEN 'authenticated'::regrole::oid ELSE owner_id END)
   OR (acl.grantee<>owner_id AND acl.is_grantable)))
  OR has_function_privilege('authenticated',proc,'EXECUTE') IS DISTINCT FROM item.authenticated_execute
  OR has_function_privilege('anon',proc,'EXECUTE') OR has_function_privilege('service_role',proc,'EXECUTE') THEN
   RAISE EXCEPTION 'Unreviewed campaign foundation execute privileges: %',item.signature;
  END IF;
 END LOOP;
 FOR item IN SELECT oid,relowner,relacl,relrowsecurity FROM pg_class WHERE oid IN (
  'public.outreach_decision_campaign_sources'::regclass,'public.outreach_decision_followup'::regclass,'public.outreach_decision_audit'::regclass)
 LOOP
  IF NOT item.relrowsecurity OR EXISTS(SELECT 1 FROM aclexplode(coalesce(item.relacl,acldefault('r',item.relowner))) acl WHERE acl.grantee<>item.relowner) THEN
   RAISE EXCEPTION 'Unreviewed decision foundation table security';
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION private.campaign_decision_directory() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; candidate record; context jsonb; campaigns jsonb:='[]'; item jsonb; campaign_name text;
BEGIN
 actor:=private.campaign_foundation_session();
 -- This is only a candidate key scan. Names and capabilities are never projected
 -- before exact PR80 context authorization locks the current campaign, assignment,
 -- and active source map. No registration/People/admin role substitutes.
 FOR candidate IN SELECT c.id,c.organization_id FROM public.outreach_campaigns c
  JOIN public.outreach_campaign_assignments a ON a.campaign_id=c.id
  WHERE a.user_id=actor ORDER BY c.id
 LOOP
  BEGIN
   context:=private.campaign_decision_foundation('context',candidate.organization_id,candidate.id,'{}');
  EXCEPTION WHEN insufficient_privilege THEN CONTINUE;
  END;
  SELECT name INTO campaign_name FROM public.outreach_campaigns WHERE id=candidate.id;
  campaigns:=campaigns||jsonb_build_array(context||jsonb_build_object('campaign_name',campaign_name));
 END LOOP;
 -- All successful contexts retain compatible SHARE locks until transaction end.
 -- Recheck every finite deadline after the last wait, not only each initial check.
 -- A campaign with a valid scope but no assigned records remains discoverable;
 -- list/detail authorization remains entirely within the unchanged PR80 API.
 FOR item IN SELECT value FROM jsonb_array_elements(campaigns)
 LOOP
  PERFORM private.campaign_decision_foundation('context',(item->>'organization_id')::uuid,(item->>'campaign_id')::uuid,'{}');
 END LOOP;
 PERFORM private.campaign_foundation_session();
 RETURN jsonb_build_object('kind','assigned-decision-campaign-directory','campaigns',campaigns);
END $$;
CREATE FUNCTION public.campaign_decision_directory() RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.campaign_decision_directory()
$$;
REVOKE ALL ON FUNCTION private.campaign_decision_directory(),public.campaign_decision_directory() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.campaign_decision_directory(),public.campaign_decision_directory() TO authenticated;
-- Managed/default ACLs may add roles beyond PUBLIC/anon/service_role. Never
-- silently accept those inherited-at-creation grants or change global defaults.
DO $$
DECLARE proc oid; owner_id oid;
BEGIN
 FOREACH proc IN ARRAY ARRAY['private.campaign_decision_directory()'::regprocedure::oid,'public.campaign_decision_directory()'::regprocedure::oid]
 LOOP
  SELECT proowner INTO owner_id FROM pg_proc WHERE oid=proc;
  IF EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
   WHERE p.oid=proc AND (acl.grantee NOT IN (owner_id,'authenticated'::regrole::oid)
    OR (acl.grantee<>owner_id AND acl.is_grantable)))
  OR NOT has_function_privilege('authenticated',proc,'EXECUTE')
  OR has_function_privilege('anon',proc,'EXECUTE') OR has_function_privilege('service_role',proc,'EXECUTE') THEN
   RAISE EXCEPTION 'Unreviewed decision directory execute privileges';
  END IF;
 END LOOP;
END $$;
COMMIT;
