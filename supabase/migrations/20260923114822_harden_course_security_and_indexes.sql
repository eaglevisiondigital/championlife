
revoke execute on function public.rls_auto_enable() from anon, authenticated;

create index if not exists course_enrollments_course_id_idx on public.course_enrollments(course_id);
create index if not exists lesson_progress_course_id_idx on public.lesson_progress(course_id);
create index if not exists lesson_answers_course_id_idx on public.lesson_answers(course_id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "enrollments_select_own" on public.course_enrollments;
create policy "enrollments_select_own" on public.course_enrollments for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "enrollments_insert_own" on public.course_enrollments;
create policy "enrollments_insert_own" on public.course_enrollments for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "enrollments_update_own" on public.course_enrollments;
create policy "enrollments_update_own" on public.course_enrollments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "progress_select_own" on public.lesson_progress;
create policy "progress_select_own" on public.lesson_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "progress_insert_own" on public.lesson_progress;
create policy "progress_insert_own" on public.lesson_progress for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "progress_update_own" on public.lesson_progress;
create policy "progress_update_own" on public.lesson_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "answers_select_own" on public.lesson_answers;
create policy "answers_select_own" on public.lesson_answers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "answers_insert_own" on public.lesson_answers;
create policy "answers_insert_own" on public.lesson_answers for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "answers_update_own" on public.lesson_answers;
create policy "answers_update_own" on public.lesson_answers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
