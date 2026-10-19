// Staff preview guard. The build supplies the approved isolated configuration.
// This file never embeds credentials or replaces a blocked preview with a backend.
(() => {
 'use strict';
 if(location.hostname.endsWith('--championlifechurch.netlify.app')){
  const cfg=window.CHAMPION_LIFE_SUPABASE;
  if(!cfg||!['https://bkbmjisprwmkptywtmih.supabase.co','https://niyovbgoalulzkhbvebt.supabase.co'].includes(cfg.url)){
   window.CHAMPION_LIFE_SUPABASE=null;
   window.CHAMPION_LIFE_CONFIG_ERROR='Isolated acceptance configuration is required.';
  }
 }
})();
