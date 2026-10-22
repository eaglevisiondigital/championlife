const shareURL = 'https://championlifefwb.com/outreach/theme-song';
const time = n => Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '–:––';

for (const root of document.querySelectorAll('[data-theme-song]')) {
  const audio = root.querySelector('audio');
  const play = root.querySelector('[data-play]');
  const seek = root.querySelector('[data-seek]');
  const volume = root.querySelector('[data-volume]');
  const mute = root.querySelector('[data-mute]');
  const status = root.querySelector('[data-status]');
  const feedback = root.querySelector('.theme-song-feedback');
  const setStatus = (text, visible = false) => {
    status.textContent = text;
    feedback.classList.toggle('is-notice', visible || !root.querySelector('[data-copy-link]').hidden);
  };
  root.classList.add('is-ready');
  audio.controls = false;

  play.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    setStatus('Loading the song…');
    try { await audio.play(); } catch { setStatus('Playback could not start. Try Play again or download the song.', true); }
  });
  mute.addEventListener('click', () => { audio.muted = !audio.muted; });
  audio.addEventListener('play', () => {
    play.setAttribute('aria-label', 'Pause theme song'); play.setAttribute('aria-pressed', 'true');
    play.classList.add('is-playing'); play.querySelector('span').textContent = 'Ⅱ';
  });
  audio.addEventListener('playing', () => { setStatus(''); });
  audio.addEventListener('waiting', () => { setStatus('Buffering…'); });
  for (const event of ['pause', 'ended']) audio.addEventListener(event, () => {
    play.setAttribute('aria-label', 'Play theme song'); play.setAttribute('aria-pressed', 'false');
    play.classList.remove('is-playing');
    setStatus(event === 'ended' ? 'Thanks for listening.' : 'Paused');
  });
  audio.addEventListener('error', () => { setStatus('The song could not load. Check your connection, then try Play or Download Song.', true); });
  const update = () => {
    root.querySelector('[data-time]').textContent = `${time(audio.currentTime)} / ${time(audio.duration)}`;
    seek.disabled = !Number.isFinite(audio.duration);
    seek.max = Number.isFinite(audio.duration) ? audio.duration : 1;
    seek.value = audio.currentTime;
    seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} of ${time(audio.duration)}`);
  };
  audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', update);
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(seek.value); update(); } });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = audio.volume === 0; });
  audio.addEventListener('volumechange', () => {
    volume.value = audio.muted ? 0 : audio.volume;
    mute.classList.toggle('is-muted', audio.muted); mute.setAttribute('aria-pressed', String(audio.muted));
    mute.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
  });
  root.querySelector('[data-share]').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Champion Life — Gospel in the Streets', text: 'A sound of hope in the streets.', url: shareURL });
      else { await navigator.clipboard.writeText(shareURL); setStatus('Song link copied.', true); }
    } catch (error) {
      if (error.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(shareURL); setStatus('Song link copied.', true); }
      catch { const field = root.querySelector('[data-copy-link]'); field.hidden = false; field.value = shareURL; field.focus(); field.select(); setStatus('Copy this song link to share.', true); }
    }
  });
  update();
}
