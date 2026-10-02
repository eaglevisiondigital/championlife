do $$ begin if exists(select 1 from pg_available_extensions where name='pg_cron') then create extension if not exists pg_cron with schema pg_catalog; end if; end $$;
