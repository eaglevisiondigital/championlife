
grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.courses to authenticated;
grant select, insert, update on public.course_enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select, insert, update on public.lesson_answers to authenticated;

grant usage, select on sequence public.courses_id_seq to authenticated;
grant usage, select on sequence public.course_enrollments_id_seq to authenticated;
grant usage, select on sequence public.lesson_progress_id_seq to authenticated;
grant usage, select on sequence public.lesson_answers_id_seq to authenticated;

revoke all on public.profiles from anon;
revoke all on public.courses from anon;
revoke all on public.course_enrollments from anon;
revoke all on public.lesson_progress from anon;
revoke all on public.lesson_answers from anon;
