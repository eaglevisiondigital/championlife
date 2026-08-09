
const CHANNEL_ID = 'UCG7j8eiL-qW8nzr2Sg7o2oA';

function findLiveVideoId(text) {
  // Strongest signal: video ID adjacent to live-now metadata in the rendered page data.
  const patterns = [
    /"videoId":"([A-Za-z0-9_-]{11})"[^{}]{0,1200}"isLiveNow":true/,
    /"isLiveNow":true[^{}]{0,1200}"videoId":"([A-Za-z0-9_-]{11})"/,
    /"videoId":"([A-Za-z0-9_-]{11})"[^{}]{0,1200}"isLive":true/,
    /"isLive":true[^{}]{0,1200}"videoId":"([A-Za-z0-9_-]{11})"/,
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

exports.handler = async function() {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30, s-maxage=30',
    'access-control-allow-origin': '*'
  };

  try {
    const url = `https://www.youtube.com/channel/${CHANNEL_ID}/live`;
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ChampionLifeLiveStatus/1.0)',
        'accept-language': 'en-US,en;q=0.9'
      }
    });

    const location = response.headers.get('location') || '';
    const redirectMatch = location.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (redirectMatch) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ live: true, videoId: redirectMatch[1], source: 'redirect' })
      };
    }

    const text = await response.text();
    const videoId = findLiveVideoId(text);

    // Do not treat an arbitrary canonical video as live unless the response itself
    // contains current-live metadata.
    const hasLiveSignal = /"isLiveNow":true|"isLive":true|"LIVE"/.test(text);
    if (videoId && hasLiveSignal) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ live: true, videoId, source: 'page' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ live: false, videoId: null })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ live: false, videoId: null, error: 'status-check-failed' })
    };
  }
};
