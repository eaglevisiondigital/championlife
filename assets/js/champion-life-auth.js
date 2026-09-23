
(() => {
  const cfg = window.CHAMPION_LIFE_SUPABASE;
  if (!cfg || !window.supabase?.createClient) {
    console.warn('Champion Life Supabase client not available');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  let courseCache = null;

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function getGripCourse() {
    if (courseCache) return courseCache;
    const { data, error } = await client
      .from('courses')
      .select('id,slug,title,total_lessons')
      .eq('slug','getting-a-grip-on-the-basics')
      .single();
    if (error) throw error;
    courseCache = data;
    return data;
  }

  async function ensureProfile(values = {}) {
    const user = await getUser();
    if (!user) return null;
    const { data:existing } = await client
      .from('profiles')
      .select('first_name,last_name,email,phone,givehub_contact_id')
      .eq('user_id',user.id)
      .maybeSingle();
    const row = {
      user_id: user.id,
      email: user.email || values.email || existing?.email || null,
      first_name: values.firstName || existing?.first_name || null,
      last_name: values.lastName || existing?.last_name || null,
      phone: values.phone || existing?.phone || null,
      givehub_contact_id: existing?.givehub_contact_id || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client
      .from('profiles')
      .upsert(row, { onConflict:'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function ensureEnrollment() {
    const user = await getUser();
    if (!user) return null;
    const course = await getGripCourse();
    const { data, error } = await client
      .from('course_enrollments')
      .upsert(
        { user_id:user.id, course_id:course.id },
        { onConflict:'user_id,course_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function saveLesson({ lessonNumber, answers, status='in_progress', completed=false, profile={} }) {
    const user = await getUser();
    if (!user) return { skipped:true };
    const course = await getGripCourse();

    await ensureProfile(profile);
    await ensureEnrollment();

    const rows = Object.entries(answers || {})
      .filter(([,value]) => String(value ?? '').trim().length)
      .map(([questionNumber, answer]) => ({
        user_id:user.id,
        course_id:course.id,
        lesson_number:Number(lessonNumber),
        question_number:Number(questionNumber),
        answer:String(answer),
        updated_at:new Date().toISOString()
      }));

    if (rows.length) {
      const { error:answerError } = await client
        .from('lesson_answers')
        .upsert(rows, { onConflict:'user_id,course_id,lesson_number,question_number' });
      if (answerError) throw answerError;
    }

    const { data:existingProgress } = await client
      .from('lesson_progress')
      .select('started_at,completed_at,status')
      .eq('user_id',user.id)
      .eq('course_id',course.id)
      .eq('lesson_number',Number(lessonNumber))
      .maybeSingle();
    const now = new Date().toISOString();
    const progressRow = {
      user_id:user.id,
      course_id:course.id,
      lesson_number:Number(lessonNumber),
      status: completed ? 'completed' : (existingProgress?.status === 'completed' ? 'completed' : status),
      started_at:existingProgress?.started_at || now,
      updated_at:now,
      completed_at: completed ? (existingProgress?.completed_at || now) : (existingProgress?.completed_at || null)
    };
    const { error:progressError } = await client
      .from('lesson_progress')
      .upsert(progressRow, { onConflict:'user_id,course_id,lesson_number' });
    if (progressError) throw progressError;

    return { saved:true };
  }

  async function loadLesson(lessonNumber) {
    const user = await getUser();
    if (!user) return null;
    const course = await getGripCourse();

    const [{ data:answers, error:aerr }, { data:progress, error:perr }, { data:profile, error:profErr }] = await Promise.all([
      client.from('lesson_answers')
        .select('question_number,answer,updated_at')
        .eq('user_id',user.id)
        .eq('course_id',course.id)
        .eq('lesson_number',Number(lessonNumber))
        .order('question_number'),
      client.from('lesson_progress')
        .select('status,started_at,completed_at,updated_at')
        .eq('user_id',user.id)
        .eq('course_id',course.id)
        .eq('lesson_number',Number(lessonNumber))
        .maybeSingle(),
      client.from('profiles')
        .select('first_name,last_name,email,phone')
        .eq('user_id',user.id)
        .maybeSingle()
    ]);
    if (aerr) throw aerr;
    if (perr) throw perr;
    if (profErr) throw profErr;
    return { user, course, answers:answers || [], progress:progress || null, profile:profile || null };
  }

  async function getDashboard() {
    const user = await getUser();
    if (!user) return null;
    const course = await getGripCourse();
    const [{ data:progress, error:perr }, { data:profile, error:profErr }] = await Promise.all([
      client.from('lesson_progress')
        .select('lesson_number,status,started_at,completed_at,updated_at')
        .eq('user_id',user.id)
        .eq('course_id',course.id)
        .order('lesson_number'),
      client.from('profiles')
        .select('first_name,last_name,email,phone')
        .eq('user_id',user.id)
        .maybeSingle()
    ]);
    if (perr) throw perr;
    if (profErr) throw profErr;
    return { user, course, progress:progress || [], profile:profile || null };
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  window.ChampionLifeAuth = {
    client,
    getSession,
    getUser,
    getGripCourse,
    ensureProfile,
    ensureEnrollment,
    saveLesson,
    loadLesson,
    getDashboard,
    signOut
  };
})();
