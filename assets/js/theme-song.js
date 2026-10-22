import { PlaybackMeter } from './theme-song-meter.js';

const endpoint = '/.netlify/functions/theme-song';
const shareURL = 'https://championlifefwb.com/outreach/theme-song';
const time = n => Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '–:––';

for (const root of document.querySelectorAll('[data-theme-song]')) {
  const audio = root.querySelector('audio');
  const play = root.querySelector('[data-play]');
  const seek = root.querySelector('[data-seek]');
  const volume = root.querySelector('[data-volume]');
  const mute = root.querySelector('[data-mute]');
  const status = root.querySelector('[data-status]');
  const total = root.querySelector('[data-total]');
  const counter = root.querySelector('[data-counter]');
  const feedback = root.querySelector('.theme-song-feedback');
  const setStatus = (text, visible = false) => {
    status.textContent = text;
    feedback.classList.toggle('is-notice', visible || !root.querySelector('[data-copy-link]').hidden);
  };
  const unavailable = () => {
    total.textContent = 'Plays unavailable';
    counter.setAttribute('aria-label', 'Play count unavailable'); counter.title = 'Play count unavailable';
  };
  const meter = new PlaybackMeter();
  let session, counted = false, counting = false, disabled = false, retryAfter = 0;
  root.classList.add('is-ready');
  audio.controls = false;

  const request = async (kind) => {
    const response = await fetch(endpoint, {
      method: kind ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      ...(kind ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) } : {}),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) { const error = new Error('counter unavailable'); error.status = response.status; throw error; }
    return response.json();
  };
  const renderTotal = data => {
    if (!/^\d+$/.test(String(data.plays))) { unavailable(); return; }
    const plays = BigInt(data.plays), count = plays.toLocaleString('en-US');
    total.textContent = `${count} ${plays === 1n ? 'Play' : 'Plays'}`;
    const description = `${count} qualified ${plays === 1n ? 'play' : 'plays'}`;
    counter.setAttribute('aria-label', description); counter.title = description;
  };
  const ensureSession = () => session ||= request('start').catch(error => { session = null; throw error; });
  request().then(renderTotal).catch(unavailable);
  const track = async kind => {
    try { await ensureSession(); renderTotal(await request(kind)); } catch { /* Never block the song or navigation. */ }
  };
  play.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    setStatus('Loading the song…');
    try { await audio.play(); } catch { setStatus('Playback could not start. Try Play again or download the song.', true); }
  });
  mute.addEventListener('click', () => { audio.muted = !audio.muted; });
  audio.addEventListener('play', () => {
    play.setAttribute('aria-label', 'Pause theme song'); play.setAttribute('aria-pressed', 'true');
    play.classList.add('is-playing'); play.querySelector('span').textContent = 'Ⅱ';
    if (!disabled) ensureSession().catch(() => { disabled = true; unavailable(); });
  });
  audio.addEventListener('playing', () => { setStatus(''); meter.resetSample(); });
  audio.addEventListener('waiting', () => { setStatus('Buffering…'); meter.resetSample(); });
  for (const event of ['pause', 'ended']) audio.addEventListener(event, () => {
    play.setAttribute('aria-label', 'Play theme song'); play.setAttribute('aria-pressed', 'false');
    play.classList.remove('is-playing'); meter.resetSample();
    setStatus(event === 'ended' ? 'Thanks for listening.' : 'Paused');
  });
  for (const event of ['seeking', 'seeked', 'ratechange']) audio.addEventListener(event, () => meter.resetSample());
  audio.addEventListener('error', () => { setStatus('The song could not load. Check your connection, then try Play or Download Song.', true); });
  const update = () => {
    root.querySelector('[data-time]').textContent = `${time(audio.currentTime)} / ${time(audio.duration)}`;
    seek.disabled = !Number.isFinite(audio.duration);
    seek.max = Number.isFinite(audio.duration) ? audio.duration : 1;
    seek.value = audio.currentTime;
    seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} of ${time(audio.duration)}`);
  };
  audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', update);
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { meter.resetSample(); audio.currentTime = Number(seek.value); update(); } });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = audio.volume === 0; });
  audio.addEventListener('volumechange', () => {
    volume.value = audio.muted ? 0 : audio.volume;
    mute.classList.toggle('is-muted', audio.muted); mute.setAttribute('aria-pressed', String(audio.muted));
    mute.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
  });
  const tick = async () => {
    if (meter.sample(audio, performance.now()) < 5 || counted || counting || disabled || Date.now() < retryAfter) return;
    counting = true;
    try { await ensureSession(); renderTotal(await request('play')); counted = true; }
    catch (error) { if (error.status === 425) retryAfter = Date.now() + 2000; else { disabled = true; unavailable(); } }
    finally { counting = false; }
  };
  let timer = setInterval(tick, 250);
  window.addEventListener('pagehide', () => { clearInterval(timer); meter.resetSample(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { clearInterval(timer); meter.resetSample(); timer = setInterval(tick, 250); } });
  root.querySelector('[data-download]').addEventListener('click', () => { void track('download'); });
  for (const link of root.querySelectorAll('[data-give]')) link.addEventListener('click', () => { void track('giving'); });
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
