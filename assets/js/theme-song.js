import { PlaybackMeter } from './theme-song-meter.js';

const endpoint = '/.netlify/functions/theme-song';
const shareURL = 'https://championlifefwb.com/outreach/theme-song';
const time = n => Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '–:––';

for (const root of document.querySelectorAll('[data-theme-song]')) {
  const audio = root.querySelector('audio');
  const play = root.querySelector('[data-play]');
  const seek = root.querySelector('[data-seek]');
  const volume = root.querySelector('[data-volume]');
  const artPlay = root.querySelector('[data-art-play]');
  const artSeek = root.querySelector('[data-art-seek]');
  const artVolume = root.querySelector('[data-art-volume]');
  const artMute = root.querySelector('[data-art-mute]');
  const status = root.querySelector('[data-status]');
  const total = root.querySelector('[data-total]');
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
    if (/^\d+$/.test(String(data.plays))) total.textContent = `${BigInt(data.plays).toLocaleString()} qualified plays`;
  };
  const ensureSession = () => session ||= request('start').catch(error => { session = null; throw error; });
  request().then(renderTotal).catch(() => { total.textContent = 'Play count unavailable'; });
  const track = async kind => {
    try { await ensureSession(); renderTotal(await request(kind)); } catch { /* Never block the song or navigation. */ }
  };
  play.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    status.textContent = 'Loading the song…';
    try { await audio.play(); } catch { status.textContent = 'Playback could not start. Try Play again or download the song.'; }
  });
  // The approved image contains illustrated controls. Its small-screen hit areas
  // operate the same audio element; accessible full-size controls remain below.
  artPlay.addEventListener('click', () => play.click());
  artMute.addEventListener('click', () => { audio.muted = !audio.muted; });
  audio.addEventListener('play', () => {
    play.setAttribute('aria-label', 'Pause theme song'); play.setAttribute('aria-pressed', 'true');
    play.querySelector('span').textContent = 'Ⅱ';
    artPlay.setAttribute('aria-label', 'Pause theme song'); artPlay.setAttribute('aria-pressed', 'true'); artPlay.classList.add('is-playing'); artPlay.querySelector('span').textContent = 'Ⅱ';
    if (!disabled) ensureSession().catch(() => { disabled = true; total.textContent = 'Play count unavailable'; });
  });
  audio.addEventListener('playing', () => { status.textContent = ''; meter.resetSample(); });
  audio.addEventListener('waiting', () => { status.textContent = 'Buffering…'; meter.resetSample(); });
  for (const event of ['pause', 'ended']) audio.addEventListener(event, () => {
    play.setAttribute('aria-label', 'Play theme song'); play.setAttribute('aria-pressed', 'false');
    play.querySelector('span').textContent = '▶'; meter.resetSample();
    artPlay.setAttribute('aria-label', 'Play theme song'); artPlay.setAttribute('aria-pressed', 'false'); artPlay.classList.remove('is-playing');
    status.textContent = event === 'ended' ? 'Thanks for listening.' : 'Paused';
  });
  for (const event of ['seeking', 'seeked', 'ratechange']) audio.addEventListener(event, () => meter.resetSample());
  audio.addEventListener('error', () => { status.textContent = 'The song could not load. Check your connection, then try Play or Download Song.'; });
  const update = () => {
    root.querySelector('[data-time]').textContent = `${time(audio.currentTime)} / ${time(audio.duration)}`;
    seek.disabled = !Number.isFinite(audio.duration);
    seek.max = Number.isFinite(audio.duration) ? audio.duration : 1;
    seek.value = audio.currentTime;
    seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} of ${time(audio.duration)}`);
    artSeek.disabled = seek.disabled; artSeek.max = seek.max; artSeek.value = seek.value; artSeek.setAttribute('aria-valuetext', seek.getAttribute('aria-valuetext'));
    root.querySelector('[data-art-time]').textContent = root.querySelector('[data-time]').textContent;
  };
  audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', update);
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { meter.resetSample(); audio.currentTime = Number(seek.value); update(); } });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = audio.volume === 0; });
  artSeek.addEventListener('input', () => { seek.value = artSeek.value; seek.dispatchEvent(new Event('input')); });
  artVolume.addEventListener('input', () => { volume.value = artVolume.value; volume.dispatchEvent(new Event('input')); });
  audio.addEventListener('volumechange', () => { volume.value = audio.muted ? 0 : audio.volume; artVolume.value = volume.value; artMute.classList.toggle('is-muted', audio.muted); artMute.setAttribute('aria-pressed', String(audio.muted)); artMute.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio'); });
  const tick = async () => {
    if (meter.sample(audio, performance.now()) < 5 || counted || counting || disabled || Date.now() < retryAfter) return;
    counting = true;
    try { await ensureSession(); renderTotal(await request('play')); counted = true; }
    catch (error) { if (error.status === 425) retryAfter = Date.now() + 2000; else { disabled = true; total.textContent = 'Play count unavailable'; } }
    finally { counting = false; }
  };
  let timer = setInterval(tick, 250);
  window.addEventListener('pagehide', () => { clearInterval(timer); meter.resetSample(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { clearInterval(timer); meter.resetSample(); timer = setInterval(tick, 250); } });
  root.querySelector('[data-download]').addEventListener('click', () => { void track('download'); });
  root.querySelector('[data-art-download]').addEventListener('click', () => { void track('download'); });
  root.querySelector('[data-art-give]').addEventListener('click', () => { void track('giving'); });
  for (const link of root.querySelectorAll('[data-give]')) link.addEventListener('click', () => { void track('giving'); });
  root.querySelector('[data-share]').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Champion Life — Gospel in the Streets', text: 'A sound of hope in the streets.', url: shareURL });
      else { await navigator.clipboard.writeText(shareURL); status.textContent = 'Song link copied.'; }
    } catch (error) {
      if (error.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(shareURL); status.textContent = 'Song link copied.'; }
      catch { const field = root.querySelector('[data-copy-link]'); field.hidden = false; field.value = shareURL; field.focus(); field.select(); status.textContent = 'Copy this song link to share.'; }
    }
  });
  root.querySelector('[data-art-share]').addEventListener('click', () => root.querySelector('[data-share]').click());
  update();
}
