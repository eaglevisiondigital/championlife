
(() => {
  const form = document.querySelector('.grip-course-form');
  if (!form) return;

  const lesson = form.dataset.lesson || '1';
  const courseIdentity = 'getting-a-grip-on-the-basics';
  const draftKey = id => `championlife-grip-v2:${id}:${courseIdentity}:lesson:${lesson}`;
  const progressKey = id => `championlife-grip-v2:${id}:${courseIdentity}:progress`;
  // Legacy unowned v1 records remain untouched, quarantined from automatic restoration.
  const saveStatus = document.querySelector('[data-grip-save-status]');
  const answeredEl = document.querySelector('[data-grip-answered]');
  const progressFill = document.querySelector('[data-grip-progress-fill]');
  const formMessage = document.querySelector('[data-grip-form-message]');
  const card = document.querySelector('.grip-form-card');
  const videoPanel = document.querySelector('.grip-video-panel');
  const videoShell = document.querySelector('.grip-video-shell');
  const stickyBtn = document.querySelector('[data-grip-sticky]');
  const miniBtn = document.querySelector('[data-grip-mini]');
  const fullscreenBtn = document.querySelector('[data-grip-fullscreen]');
  const clearBtn = document.querySelector('[data-grip-clear]');
  const printBtn = document.querySelector('[data-grip-print]');
  const downloadBtn = document.querySelector('[data-grip-download]');
  const emailBtn = document.querySelector('[data-grip-email]');
  const auth = window.ChampionLifeAuth || null;

  let pageActive = true;
  let cloudUser = null, generation = 0, controller = new AbortController();
  let remoteSaveTimer = null, expiryTimer = null;
  const learnerField = form.querySelector('[name="learner-id"]');
  const submitText = form.querySelector('[type=submit]')?.textContent;
  const originals = new Map([...form.elements].map(el => [el, el.disabled]));
  const privateActions = [clearBtn, printBtn, downloadBtn, emailBtn];
  function enable(value) {
    originals.forEach((disabled, el) => { el.disabled = !value || disabled; });
    privateActions.forEach(el => { if (el) el.disabled = !value; });
  }
  function invalidate() {
    generation++; controller.abort(); controller = new AbortController();
    clearTimeout(remoteSaveTimer); clearTimeout(expiryTimer);
    cloudUser = null;
    form.reset();
    if(form.querySelector('[type=submit]'))form.querySelector('[type=submit]').textContent=submitText;
    form.querySelectorAll('textarea,input:not([type="hidden"]),select').forEach(el => {
      if (['checkbox','radio'].includes(el.type)) el.checked = false;
      else el.value = '';
    });
    if (learnerField) learnerField.value = '';
    card?.classList.remove('completed'); clearMessage(); enable(false); updateProgress();
    if (saveStatus) saveStatus.textContent = 'Sign in to view your private worksheet.';
    renderCloudState();
  }
  const current = (stamp, id) => stamp === generation && cloudUser?.id === id && !controller.signal.aborted;

  function fieldsToObject() {
    const data = {};
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (!el.name || el.name === 'bot-field' || el.name === 'form-name') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function questionInputs() {
    return [...form.querySelectorAll('[data-grip-answer]')];
  }

  function answerObject() {
    const out = {};
    questionInputs().forEach((input, idx) => {
      out[idx + 1] = input.value.trim();
    });
    return out;
  }

  function profileObject() {
    return {
      firstName: (form.querySelector('[name="first-name"]')?.value || '').trim(),
      lastName: (form.querySelector('[name="last-name"]')?.value || '').trim(),
      email: (form.querySelector('[name="email"]')?.value || '').trim(),
      phone: (form.querySelector('[name="phone"]')?.value || '').trim()
    };
  }

  function updateProgress() {
    const inputs = questionInputs();
    const answered = inputs.filter(i => i.value.trim().length > 0).length;
    if (answeredEl) answeredEl.textContent = answered + ' of ' + inputs.length + ' answered';
    if (progressFill) progressFill.style.width = ((answered / Math.max(inputs.length,1)) * 100) + '%';
  }

  function setMessage(type, text) {
    if (!formMessage) return;
    formMessage.className = 'grip-form-message show ' + type;
    formMessage.textContent = text;
  }

  function clearMessage() {
    if (!formMessage) return;
    formMessage.className = 'grip-form-message';
    formMessage.textContent = '';
  }

  function localSaveLabel(prefix='Saved on this device') {
    if (!saveStatus) return;
    const time = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
    saveStatus.textContent = prefix + ' · ' + time;
  }

  function saveDraft() {
    if (!cloudUser) return;
    const payload = {
      owner: cloudUser.id, course: courseIdentity, lesson,
      savedAt: new Date().toISOString(),
      values: fieldsToObject()
    };
    try { localStorage.setItem(draftKey(cloudUser.id), JSON.stringify(payload)); } catch (_) { if(saveStatus) saveStatus.textContent = 'Device storage unavailable; keep this page open until cloud save succeeds.'; return; }
    localSaveLabel(cloudUser ? 'Saved locally' : 'Saved on this device');
    updateProgress();
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(draftKey(cloudUser.id));
      if (!raw) return;
      const payload = JSON.parse(raw);
      if(payload.owner !== cloudUser.id || payload.course !== courseIdentity || payload.lesson !== lesson) return;
      const values = payload.values || {};
      Object.entries(values).forEach(([name, value]) => {
        const el = form.elements.namedItem(name);
        if (!el || el instanceof RadioNodeList || el.type === 'hidden') return;
        el.value = value;
      });
      if (saveStatus && payload.savedAt) {
        const d = new Date(payload.savedAt);
        saveStatus.textContent = 'Draft restored · ' + d.toLocaleDateString() + ' ' +
          d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      }
    } catch (e) {}
  }

  function updateCourseProgressLocal() {
    if (!cloudUser) return;
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey(cloudUser.id)) || '{}'); } catch(e) {}
    progress[lesson] = {
      completed: true,
      completedAt: new Date().toISOString(),
      learnerId: cloudUser?.id
    };
    try { localStorage.setItem(progressKey(cloudUser.id), JSON.stringify(progress)); } catch (_) {}
  }

  function cloudStateBox() {
    let box = document.querySelector('[data-grip-cloud-state]');
    if (box) return box;
    const profile = document.querySelector('.grip-profile');
    if (!profile) return null;
    box = document.createElement('div');
    box.className = 'grip-cloud-state';
    box.setAttribute('data-grip-cloud-state','');
    profile.insertAdjacentElement('afterbegin', box);
    return box;
  }

  function renderCloudState() {
    const box = cloudStateBox();
    if (!box) return;
    if (cloudUser) {
      box.className = 'grip-cloud-state signed-in';
      box.innerHTML =
        '<div><strong>Cloud Sync On</strong><span>Signed in as ' + escapeHtml(cloudUser.email || '') + '. Your answers can follow you across devices.</span></div>' +
        '<a href="my-discipleship.html">My Discipleship</a>';
    } else {
      const next = encodeURIComponent(location.pathname.split('/').pop() || ('getting-a-grip-' + lesson + '.html'));
      box.className = 'grip-cloud-state';
      box.innerHTML =
        '<div><strong>Want your progress on every device?</strong><span>Sign in to open your private worksheet. Older unassigned device drafts are preserved but will not be attached to an account automatically.</span></div>' +
        '<a href="discipleship-login.html?next=' + next + '">Sign In / Sync</a>';
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[ch]);
  }

  async function syncRemote(completed=false) {
    if (!auth || !cloudUser) return;
    const stamp = generation, id = cloudUser.id, signal = controller.signal;
    try {
      if (learnerField) learnerField.value = id;
      await auth.saveLesson({
        expectedUserId:id, signal, lessonNumber:Number(lesson),
        answers:answerObject(),
        status: completed ? 'completed' : 'in_progress',
        completed,
        profile:profileObject()
      });
      if (!current(stamp,id)) return false;
      if (saveStatus) {
        const time = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
        saveStatus.textContent = completed ? 'Submitted & synced · ' + time : 'Cloud saved · ' + time;
      }
      return true;
    } catch (e) {
      if (current(stamp,id)) { invalidate(); if(saveStatus) saveStatus.textContent = 'Your account draft is preserved. Verify your session again before continuing.'; }
      return false;
    }
  }

  function scheduleRemoteSave() {
    if (!cloudUser) return;
    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(() => syncRemote(false), 1000);
  }

  function scheduleSave() {
    if (!cloudUser) return;
    // Capture unfinished edits immediately under their current owner before any transition.
    saveDraft(); scheduleRemoteSave();
  }

  async function restoreRemote() {
    invalidate();
    const stamp = generation, signal = controller.signal;
    if (!pageActive || !auth?.getVerifiedUser) return;
    try {
      const u = await auth.getVerifiedUser();
      if (stamp !== generation || !u) return;
      const data = await auth.loadLesson(Number(lesson), u.id, signal);
      if (stamp !== generation || data?.user?.id !== u.id) return;
      const session = await auth.getSession();
      if (stamp !== generation) return;
      if (session?.user?.id !== u.id || !session.expires_at || session.expires_at * 1000 <= Date.now()) { invalidate(); return; }
      cloudUser = u;
      if (learnerField) learnerField.value = u.id;
      restoreDraft();
      const profile = data.profile || {};
      const map = {'first-name':profile.first_name || '', 'last-name':profile.last_name || '', email:u.email || '', phone:profile.phone || ''};
      Object.entries(map).forEach(([name,value]) => {
        const el = form.elements.namedItem(name);
        if (el && !el.value.trim()) el.value = value;
      });
      (data.answers || []).forEach(row => {
        const input = form.elements.namedItem('q' + row.question_number);
        if (input && !input.value.trim()) input.value = row.answer || '';
      });
      if (data.progress?.status === 'completed') card?.classList.add('completed');
      renderCloudState(); updateProgress(); enable(true);
      if (saveStatus) saveStatus.textContent = 'Your private worksheet is ready';
      expiryTimer = setTimeout(() => restoreRemote(), Math.min(2147483647, session.expires_at * 1000 - Date.now()));
    } catch (_) {
      if (stamp === generation) invalidate();
    }
  }

  function qaText() {
    const profile = fieldsToObject();
    const lines = [
      'Getting a Grip on the Basics - Lesson ' + lesson,
      '',
      'Name: ' + ((profile['first-name'] || '') + ' ' + (profile['last-name'] || '')).trim(),
      'Email: ' + (profile.email || ''),
      'Phone: ' + (profile.phone || ''),
      ''
    ];
    document.querySelectorAll('.grip-question').forEach((q, idx) => {
      const label = q.querySelector('label');
      const input = q.querySelector('[data-grip-answer]');
      lines.push((idx + 1) + '. ' + (label ? label.dataset.questionText || label.textContent.trim() : ''));
      lines.push('Answer: ' + (input ? input.value.trim() : ''));
      lines.push('');
    });
    const notes = form.querySelector('[name="notes"]');
    if (notes && notes.value.trim()) {
      lines.push('Notes:');
      lines.push(notes.value.trim());
      lines.push('');
    }
    return lines.join('\n');
  }

  function downloadAnswers() {
    if (!cloudUser) return;
    const blob = new Blob([qaText()], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'getting-a-grip-lesson-' + lesson + '-answers.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function emailAnswers() {
    if (!cloudUser) return;
    const email = (form.querySelector('[name="email"]')?.value || '').trim();
    if (!email) {
      setMessage('error', 'Enter your email address first so we can prepare your email copy.');
      return;
    }
    const subject = encodeURIComponent('My Getting a Grip Lesson ' + lesson + ' Answers');
    const body = encodeURIComponent(qaText().slice(0, 6500));
    window.location.href = 'mailto:' + encodeURIComponent(email) + '?subject=' + subject + '&body=' + body;
  }

  form.addEventListener('input', scheduleSave);
  form.addEventListener('change', scheduleSave);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!cloudUser) return;
    const stamp = generation, id = cloudUser.id, signal = controller.signal;
    clearMessage();
    if (!form.reportValidity()) {
      setMessage('error', 'Please complete your contact information and all 20 lesson questions before submitting.');
      return;
    }

    saveDraft();
    const completedAt = form.querySelector('[name="completed-at"]');
    if (completedAt) completedAt.value = new Date().toISOString();

    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Submitting lesson...';
    }

    try {
      const verified = await auth.getVerifiedUser();
      if (!current(stamp,id) || verified?.id !== id) { if(stamp === generation) invalidate(); return; }
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', {
        method:'POST', signal,
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      });
      if (!res.ok) throw new Error('Submission failed');

      if (!current(stamp,id)) return;
      if (!await syncRemote(true) || !current(stamp,id)) return;
      updateCourseProgressLocal();
      saveDraft();
      if (card) card.classList.add('completed');

      const where = cloudUser ? 'Champion Life and your discipleship account' : 'Champion Life and this device';
      setMessage('success', 'Lesson ' + lesson + ' has been submitted and saved to ' + where + '.');
      document.querySelector('.grip-complete')?.scrollIntoView({behavior:'smooth', block:'center'});
    } catch (err) {
      if (!current(stamp,id)) return;
      setMessage('error', 'We could not submit the lesson right now. Your answers are still saved on this device. Please try again.');
    } finally {
      if (submit && current(stamp,id)) {
        submit.disabled = false;
        submit.textContent = original;
      }
    }
  });

  stickyBtn?.addEventListener('click', () => {
    videoPanel?.classList.toggle('not-sticky');
    const off = videoPanel?.classList.contains('not-sticky');
    stickyBtn.textContent = off ? 'Keep Video Visible' : 'Video Stays Visible';
  });

  miniBtn?.addEventListener('click', () => {
    videoPanel?.classList.toggle('is-mini');
    const mini = videoPanel?.classList.contains('is-mini');
    miniBtn.textContent = mini ? 'Expand Video' : 'Minimize Video';
  });

  fullscreenBtn?.addEventListener('click', async () => {
    try {
      if (videoShell?.requestFullscreen) await videoShell.requestFullscreen();
      else if (videoShell?.webkitRequestFullscreen) videoShell.webkitRequestFullscreen();
    } catch (e) {}
  });

  clearBtn?.addEventListener('click', () => {
    if (!confirm('Clear the saved answers for this lesson on this device? Cloud-saved answers will remain in your account.')) return;
    if (!cloudUser) return;
    clearTimeout(remoteSaveTimer);
    try { localStorage.removeItem(draftKey(cloudUser.id)); } catch (_) {}
    form.reset();
    if (learnerField) learnerField.value = cloudUser?.id;
    if (card) card.classList.remove('completed');
    clearMessage();
    if (saveStatus) saveStatus.textContent = cloudUser ? 'Cloud copy still available' : 'New draft';
    updateProgress();
  });

  printBtn?.addEventListener('click', () => { if(cloudUser) window.print(); });
  downloadBtn?.addEventListener('click', downloadAnswers);
  emailBtn?.addEventListener('click', emailAnswers);

  auth?.client?.auth.onAuthStateChange?.(() => {
    invalidate(); // Synchronous clear; never await Supabase inside its auth callback lock.
    setTimeout(restoreRemote, 0);
  });
  window.addEventListener('pagehide', () => { pageActive=false; invalidate(); });
  window.addEventListener('pageshow', () => { pageActive=true; restoreRemote(); });
  window.addEventListener('champion-auth-invalid', invalidate);
  window.addEventListener('storage', e => { if (e.key?.startsWith('sb-') || e.key === null) { invalidate(); setTimeout(restoreRemote, 0); } });
  document.addEventListener('visibilitychange', () => { pageActive=!document.hidden; if(!pageActive) invalidate(); else restoreRemote(); });
  restoreRemote();
})();
