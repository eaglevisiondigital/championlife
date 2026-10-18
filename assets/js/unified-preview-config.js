(() => {
  'use strict';
  const host=typeof location==='undefined'?'':location.hostname;
  if(!host.startsWith('codex-unified-staff-workspace-production--championlifechurch.netlify.app')) return;
  window.CHAMPION_LIFE_SUPABASE={
    url:'https://niyovbgoalulzkhbvebt.supabase.co',
    publishableKey:'sb_publishable_iLqCqzZuXRp5hoY777V-JQ_hCuorFHA'
  };
})();