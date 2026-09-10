(() => {
  const cfg = window.CHAMPION_LIVE_CONFIG || {};
  const player = document.getElementById('champion-live-player');
  const status = document.getElementById('champion-live-status');
  if (!player) return;
  const channelId = String(cfg.channelId || '').trim();
  const videoId = String(cfg.videoId || '').trim();
  const host = window.location.hostname || 'championlifefwb.com';
  if (videoId) {
    player.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
    if (status) status.textContent = 'Champion Life scheduled/live broadcast.';
    const actions = player.closest('.container')?.querySelector('.actions');
    if (actions && !document.getElementById('champion-live-chat-link')) {
      const chat = document.createElement('a');
      chat.id='champion-live-chat-link'; chat.className='btn outline'; chat.target='_blank'; chat.rel='noopener';
      chat.href=`https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&embed_domain=${encodeURIComponent(host)}`;
      chat.textContent='Open Live Chat'; actions.appendChild(chat);
    }
  } else if (channelId) {
    player.src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1&rel=0&modestbranding=1`;
    if (status) status.textContent = 'This player follows Champion Life’s current public YouTube live broadcast automatically.';
  } else if (status) status.textContent='The Champion Life YouTube channel has not been configured.';
})();
