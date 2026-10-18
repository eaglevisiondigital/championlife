// Champion Life Supabase public browser configuration
// The publishable key is intentionally public and protected by Supabase Row Level Security.
const unifiedStaffAcceptance = typeof location !== 'undefined' && location.hostname.startsWith('codex-unified-staff-workspace-production--championlifechurch.netlify.app');
window.CHAMPION_LIFE_SUPABASE = unifiedStaffAcceptance ? {
  url: "https://niyovbgoalulzkhbvebt.supabase.co",
  publishableKey: "sb_publishable_iLqCqzZuXRp5hoY777V-JQ_hCuorFHA"
} : {
  url: "https://exdocjbmylgxssanymjk.supabase.co",
  publishableKey: "sb_publishable_h2U_5DLZ0dtRi2QwwD_8Kw_nJ-qhYhu"
};