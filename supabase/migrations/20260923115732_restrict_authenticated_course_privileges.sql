
revoke all on public.profiles from authenticated;
revoke all on public.courses from authenticated;
revoke all on public.course_enrollments from authenticated;
revoke all on public.lesson_progress from authenticated;
revoke all on public.lesson_answers from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.courses to authenticated;
grant select, insert, update on public.course_enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select, insert, update on public.lesson_answers to authenticated;
