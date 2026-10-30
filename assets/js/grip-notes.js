// Lessons 5–13: private, device-only notes. No cloud writes or enrollment side effects.
(() => {
  'use strict';
  const field = document.querySelector('[data-grip-notes-lesson]');
  if (!field) return;
  const lesson = Number(field.dataset.gripNotesLesson);
  const status = document.querySelector('[data-grip-notes-status]');
  const signin = document.querySelector('[data-grip-notes-signin]');
  const auth = window.ChampionLifeAuth;
  const course = 'getting-a-grip-on-the-basics';
  const key = id => `championlife-grip-notes-v1:${id}:${course}:lesson:${lesson}`;
  let owner = null, generation = 0, expiresAt = 0, expiryTimer, active = true;

  function clear() {
    generation++; clearTimeout(expiryTimer); owner = null; expiresAt = 0;
    // Clear live and default values so browser history cannot resurrect an unowned value.
    field.value = ''; field.defaultValue = ''; field.disabled = true;
    if (status) status.textContent = 'Sign in to view your private notes on this device.';
    if (signin) signin.hidden = false;
  }
  function current(stamp) { return active && stamp === generation; }
  async function restore() {
    clear(); const stamp = generation;
    if (!active || !auth?.getVerifiedUser || lesson < 5 || lesson > 13) return;
    try {
      const user = await auth.getVerifiedUser();
      if (!current(stamp) || !user?.id || !user.email_confirmed_at || user.is_anonymous) return;
      const session = await auth.getSession();
      if (!current(stamp)) return;
      if (session?.user?.id !== user.id || !session.expires_at || session.expires_at * 1000 <= Date.now()) return;
      owner = user; expiresAt = session.expires_at * 1000;
      // Only this explicitly owned namespace is read. Never import legacy/unowned browser data.
      try {
        const saved = JSON.parse(localStorage.getItem(key(owner.id)) || 'null');
        if (saved?.owner === owner.id && saved.course === course && saved.lesson === lesson && typeof saved.notes === 'string') field.value = saved.notes;
      } catch (_) { /* Missing/invalid/unavailable storage must not reveal any other draft. */ }
      field.disabled = false;
      if (status) status.textContent = `Signed in as ${owner.email}. Private notes are saved on this device only; they do not sync to your course account.`;
      if (signin) signin.hidden = true;
      expiryTimer = setTimeout(restore, Math.min(2147483647, expiresAt - Date.now()));
    } catch (_) { if (current(stamp)) clear(); }
  }
  function save() {
    if (!active || !owner || field.disabled || expiresAt <= Date.now()) { clear(); return; }
    // Synchronous write under the captured verified owner: there is no deferred write to retarget.
    try {
      localStorage.setItem(key(owner.id), JSON.stringify({owner:owner.id, course, lesson, notes:field.value, savedAt:new Date().toISOString()}));
      if (status) status.textContent = `Saved on this device for ${owner.email}. These notes do not sync to the cloud.`;
    } catch (_) {
      if (status) status.textContent = 'Device storage is unavailable. These notes are not saved; copy them privately before leaving this page.';
    }
  }
  field.addEventListener('input', save);
  field.addEventListener('change', save);
  auth?.client?.auth.onAuthStateChange?.(() => { clear(); setTimeout(restore, 0); });
  window.addEventListener('pagehide', () => { active = false; clear(); });
  window.addEventListener('pageshow', () => { active = true; restore(); });
  window.addEventListener('champion-auth-invalid', clear);
  document.addEventListener('visibilitychange', () => { active = !document.hidden; if (active) restore(); else clear(); });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key?.startsWith('sb-') || (owner && event.key === key(owner.id))) { clear(); setTimeout(restore, 0); }
  });
  restore();
})();
