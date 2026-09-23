
(() => {
  const form = document.querySelector('.grip-course-form');
  if (!form) return;

  const lesson = form.dataset.lesson || '1';
  const storageKey = 'championlife-grip-lesson-' + lesson + '-draft-v1';
  const progressKey = 'championlife-grip-progress-v1';
  const learnerKey = 'championlife-grip-learner-id-v1';

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

  let cloudUser = null;
  let remoteSaveTimer = null;

  function localLearnerId() {
    let id = localStorage.getItem(learnerKey);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
        'grip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(learnerKey, id);
    }
    return id;
  }

  const learnerField = form.querySelector('[name="learner-id"]');
  if (learnerField) learnerField.value = localLearnerId();

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
    const payload = {
      lesson,
      savedAt: new Date().toISOString(),
      values: fieldsToObject()
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    localSaveLabel(cloudUser ? 'Saved locally' : 'Saved on this device');
    updateProgress();
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const values = payload.values || {};
      Object.entries(values).forEach(([name, value]) => {
        const el = form.elements.namedItem(name);
        if (!el || el instanceof RadioNodeList) return;
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
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}
    progress[lesson] = {
      completed: true,
      completedAt: new Date().toISOString(),
      learnerId: cloudUser?.id || localLearnerId()
    };
    localStorage.setItem(progressKey, JSON.stringify(progress));
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
        '<div><strong>Want your progress on every device?</strong><span>Your work is safe on this device now. Sign in to also save it to your Champion Life account.</span></div>' +
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
    try {
      if (learnerField) learnerField.value = cloudUser.id;
      await auth.saveLesson({
        lessonNumber:Number(lesson),
        answers:answerObject(),
        status: completed ? 'completed' : 'in_progress',
        completed,
        profile:profileObject()
      });
      if (saveStatus) {
        const time = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
        saveStatus.textContent = completed ? 'Submitted & synced · ' + time : 'Cloud saved · ' + time;
      }
    } catch (e) {
      if (saveStatus) saveStatus.textContent = 'Saved locally · cloud retry needed';
    }
  }

  function scheduleRemoteSave() {
    if (!cloudUser) return;
    clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(() => syncRemote(false), 1000);
  }

  let localTimer;
  function scheduleSave() {
    clearTimeout(localTimer);
    localTimer = setTimeout(() => {
      saveDraft();
      scheduleRemoteSave();
    }, 350);
  }

  async function restoreRemote() {
    if (!auth) {
      renderCloudState();
      return;
    }
    try {
      cloudUser = await auth.getUser();
      renderCloudState();
      if (!cloudUser) return;

      if (learnerField) learnerField.value = cloudUser.id;
      const data = await auth.loadLesson(Number(lesson));
      if (!data) return;

      const profile = data.profile || {};
      const map = {
        'first-name': profile.first_name || '',
        'last-name': profile.last_name || '',
        'email': profile.email || data.user.email || '',
        'phone': profile.phone || ''
      };
      Object.entries(map).forEach(([name,value]) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (el && !el.value.trim() && value) el.value = value;
      });

      (data.answers || []).forEach(row => {
        const input = form.querySelector('[name="q' + row.question_number + '"]');
        if (input && !input.value.trim()) input.value = row.answer || '';
      });

      if (data.progress?.status === 'completed' && card) {
        card.classList.add('completed');
      }

      saveDraft();
      updateProgress();
      if (saveStatus) saveStatus.textContent = 'Cloud progress loaded';
    } catch (e) {
      renderCloudState();
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
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      });
      if (!res.ok) throw new Error('Submission failed');

      if (cloudUser) await syncRemote(true);
      updateCourseProgressLocal();
      saveDraft();
      if (card) card.classList.add('completed');

      const where = cloudUser ? 'Champion Life and your discipleship account' : 'Champion Life and this device';
      setMessage('success', 'Lesson ' + lesson + ' has been submitted and saved to ' + where + '.');
      document.querySelector('.grip-complete')?.scrollIntoView({behavior:'smooth', block:'center'});
    } catch (err) {
      setMessage('error', 'We could not submit the lesson right now. Your answers are still saved on this device. Please try again.');
    } finally {
      if (submit) {
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
    localStorage.removeItem(storageKey);
    form.reset();
    if (learnerField) learnerField.value = cloudUser?.id || localLearnerId();
    if (card) card.classList.remove('completed');
    clearMessage();
    if (saveStatus) saveStatus.textContent = cloudUser ? 'Cloud copy still available' : 'New draft';
    updateProgress();
  });

  printBtn?.addEventListener('click', () => window.print());
  downloadBtn?.addEventListener('click', downloadAnswers);
  emailBtn?.addEventListener('click', emailAnswers);

  restoreDraft();
  updateProgress();
  restoreRemote();
})();
