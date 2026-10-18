(() => {
  'use strict';
  const host=typeof location==='undefined'?'':location.hostname;
  const allowed=new Set([
    'deploy-preview-29--championlifechurch.netlify.app',
    'codex-unified-staff-partner-pastoral-v1--championlifechurch.netlify.app',
    'codex-unified-staff-workspace-production--championlifechurch.netlify.app'
  ]);
  if(!allowed.has(host)) return;
  window.CHAMPION_LIFE_SUPABASE={
    url:'https://niyovbgoalulzkhbvebt.supabase.co',
    publishableKey:'sb_publishable_iLqCqzZuXRp5hoY777V-JQ_hCuorFHA'
  };
})();