// Reviewed source pin only. No project has been created or selected by this package.
// Replace null/[] only in a reviewed follow-up after owner supplies the exact NEW target.
export const NMI_GIVING_ACCEPTANCE_PIN=Object.freeze({name:'champion-life-nmi-giving-acceptance',project:null,origins:Object.freeze([])});
export function dedicatedAcceptance(config){
 const p=config.acceptance_pin;
 return !!p&&p.name==='champion-life-nmi-giving-acceptance'&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(p.project||'')&&config.project===p.project&&
 !['https://exdocjbmylgxssanymjk.supabase.co','https://niyovbgoalulzkhbvebt.supabase.co','https://bkbmjisprwmkptywtmih.supabase.co'].includes(p.project);
}
