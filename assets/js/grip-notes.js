// Lessons 5–13: private, device-only notes. No cloud writes or enrollment side effects.
(() => {
  'use strict';
  const field = document.querySelector('[data-grip-notes-lesson]');
  if (!field) return;
  const lesson = Number(field.dataset.gripNotesLesson);
  const status = document.querySelector('[data-grip-notes-status]');
  const signin = document.querySelector('[data-grip-notes-signin]');
  const auth = window.ChampionLifeAuth;
  const client = auth?.client, clientAuth = client?.auth;
  const verifier = auth?.getVerifiedUser, sessionReader = auth?.getSession;
  const pinned = () => window.ChampionLifeAuth === auth && auth?.client === client &&
    client?.auth === clientAuth && auth?.getVerifiedUser === verifier && auth?.getSession === sessionReader;
  const course = 'getting-a-grip-on-the-basics';
  const key = id => `championlife-grip-notes-v1:${id}:${course}:lesson:${lesson}`;
  let retired = false;
  let owner = null, generation = 0, writeGeneration = 0, expiresAt = 0, expiryTimer, active = true;

  function clear() {
    generation++; writeGeneration++; clearTimeout(expiryTimer); owner = null; expiresAt = 0;
    // Clear live and default values so browser history cannot resurrect an unowned value.
    field.value = ''; field.defaultValue = ''; field.disabled = true;
    if (status) status.textContent = retired ? 'This notes view is closed. Reload the page to open your private device notes.' : 'Sign in to view your private notes on this device.';
    if (signin) signin.hidden = false;
  }
  // Bind this runtime to the original notes view and its captured ownership chain.
  // Removal permanently retires it, including remove/reinsert in the same task.
  const view = field.closest('.grip-notes-wrap');
  const controls = [view, field, status, signin].filter(Boolean);
  const ancestors = [];
  for (let node = view?.parentNode; node; node = node.parentNode) ancestors.push(node);
  const removed = records => records.some(record => [...record.removedNodes].some(node =>
    [...controls, ...ancestors].some(control => node === control || node.contains?.(control))));
  const owned = () => view?.isConnected && document.querySelector('[data-grip-notes-lesson]') === field &&
    view.contains(field) && (!status || view.contains(status)) && (!signin || view.contains(signin));
  function retire() { retired = true; active = false; clear(); observer.disconnect(); }
  const observer = new MutationObserver(records => { if (!owned() || removed(records)) retire(); });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  function live() {
    if (retired) { clear(); return false; }
    // Drain pending removals before a retained handler can start authentication.
    if (!owned() || removed(observer.takeRecords())) { retire(); return false; }
    return true;
  }
  function current(stamp) {
    if (!live()) return false;
    if (!pinned()) { clear(); return false; }
    return active && stamp === generation;
  }
  async function restore() {
    clear(); const stamp = generation;
    if (!live() || !active || !pinned() || !verifier || !sessionReader || lesson < 5 || lesson > 13) return;
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
  async function save() {
    if (!live() || !active || !pinned() || !owner || field.disabled || expiresAt <= Date.now()) { clear(); return; }
    const stamp = generation, write = ++writeGeneration, capturedOwner = owner, notes = field.value;
    const pending = () => current(stamp) && write === writeGeneration && owner === capturedOwner;
    if (status) status.textContent = 'Verifying your account before saving these device notes…';
    try {
      // Auth callbacks can be missed. Never persist under a cached owner alone.
      // The captured text is not stored until the current verified identity and
      // latest session agree; newer edits and navigation retire older writes.
      const user = await verifier.call(auth);
      if (!pending()) return;
      if (user?.id !== capturedOwner.id || !user.email_confirmed_at || user.is_anonymous) throw Error('Identity changed');
      const session = await sessionReader.call(auth);
      if (!pending()) return;
      if (session?.user?.id !== capturedOwner.id || !(session.expires_at * 1000 > Date.now()) || expiresAt <= Date.now()) throw Error('Session changed');
      try {
        localStorage.setItem(key(capturedOwner.id), JSON.stringify({owner:capturedOwner.id, course, lesson, notes, savedAt:new Date().toISOString()}));
        if (status) status.textContent = `Saved on this device for ${capturedOwner.email}. These notes do not sync to the cloud.`;
      } catch (_) {
        if (status) status.textContent = 'Device storage is unavailable. These notes are not saved; copy them privately before leaving this page.';
      }
    } catch (_) { if (pending()) clear(); }
  }
  field.addEventListener('input', save);
  field.addEventListener('change', save);
  auth?.client?.auth.onAuthStateChange?.(() => { clear(); setTimeout(restore, 0); });
  window.addEventListener('pagehide', () => { active = false; clear(); });
  window.addEventListener('pageshow', () => { active = true; restore(); });
  window.addEventListener('champion-auth-invalid', clear);
  window.addEventListener('popstate', clear);
  document.addEventListener('visibilitychange', () => { active = !document.hidden; if (active) restore(); else clear(); });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key?.startsWith('sb-') || (owner && event.key === key(owner.id))) { clear(); setTimeout(restore, 0); }
  });
  restore();
})();
