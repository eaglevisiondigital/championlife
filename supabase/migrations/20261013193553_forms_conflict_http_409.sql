-- Optimistic Forms conflicts are HTTP409, not retryable PostgreSQL serialization failures.
-- Preserve the existing guarded function body, authority checks, locking, grants and search path.
do $fix$
declare definition text; expected int;
begin
 definition:=pg_get_functiondef('private.forms_workspace(text,uuid,jsonb)'::regprocedure);
 expected:=(length(definition)-length(replace(definition,'''40001''','')))/7;
 if expected<>4 then raise exception 'Unexpected Forms conflict definition; review before applying';end if;
 execute replace(definition,'''40001''','''PT409''');
end
$fix$;
