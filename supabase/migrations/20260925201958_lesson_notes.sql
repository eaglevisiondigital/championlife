-- Additive: old clients omit notes and preserve the existing value on update.
-- The existing lesson_progress owner-only RLS covers this column.
alter table public.lesson_progress add column notes text not null default '';
comment on column public.lesson_progress.notes is 'Private learner notes, protected by lesson_progress owner-only RLS.';
