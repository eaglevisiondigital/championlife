
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

  function learnerId() {
    let id = localStorage.getItem(learnerKey);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
        'grip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(learnerKey, id);
    }
    return id;
  }

  const learnerField = form.querySelector('[name="learner-id"]');
  if (learnerField) learnerField.value = learnerId();

  function fieldsToObject() {
    const data = {};
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (!el.name || el.name === 'bot-field' || el.name === 'form-name') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function saveDraft() {
    const payload = {
      lesson,
      savedAt: new Date().toISOString(),
      values: fieldsToObject()
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    if (saveStatus) {
      const time = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      saveStatus.textContent = 'Saved on this device · ' + time;
    }
    updateProgress();
  }

  let timer;
  function scheduleSave() {
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 350);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const values = payload.values || {};
      Object.entries(values).forEach(([name, value]) => {
        const el = form.elements.namedItem(name);
        if (!el) return;
        if (el instanceof RadioNodeList) return;
        el.value = value;
      });
      if (saveStatus && payload.savedAt) {
        const d = new Date(payload.savedAt);
        saveStatus.textContent = 'Draft restored · ' + d.toLocaleDateString() + ' ' +
          d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      }
    } catch (e) {}
  }

  function questionInputs() {
    return [...form.querySelectorAll('[data-grip-answer]')];
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

  function updateCourseProgress() {
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}
    progress[lesson] = {
      completed: true,
      completedAt: new Date().toISOString(),
      learnerId: learnerId()
    };
    localStorage.setItem(progressKey, JSON.stringify(progress));
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
      updateCourseProgress();
      saveDraft();
      if (card) card.classList.add('completed');
      setMessage('success', 'Lesson ' + lesson + ' has been submitted to Champion Life and marked complete on this device.');
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
    if (!confirm('Clear the saved answers for this lesson on this device?')) return;
    localStorage.removeItem(storageKey);
    form.reset();
    if (learnerField) learnerField.value = learnerId();
    if (card) card.classList.remove('completed');
    clearMessage();
    if (saveStatus) saveStatus.textContent = 'New draft';
    updateProgress();
  });

  printBtn?.addEventListener('click', () => window.print());
  downloadBtn?.addEventListener('click', downloadAnswers);
  emailBtn?.addEventListener('click', emailAnswers);

  restoreDraft();
  updateProgress();
})();
