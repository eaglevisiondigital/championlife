// Add the owner-approved public partner site only on the canonical shared project.
// Existing environment values are retained; other intake functions are unchanged.
export function partnerSitePolicy({url,origins=[],hostnames=[]}) {
 const production=url==='https://exdocjbmylgxssanymjk.supabase.co';
 return {
  origins:[...new Set([...origins,...(production?['https://sowgo.org']:[])])],
  hostnames:[...new Set([...hostnames,...(production?['sowgo.org']:[])])]
 };
}
