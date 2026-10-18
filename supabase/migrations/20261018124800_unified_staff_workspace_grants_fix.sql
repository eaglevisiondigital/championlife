-- Allow authenticated callers to traverse the reviewed public invoker wrappers.
grant execute on function private.outreach_decision_workspace(text,uuid,jsonb) to authenticated;
grant execute on function private.outreach_access_workspace(text,jsonb) to authenticated;
