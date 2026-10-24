// Temporary activation assets are published only by an explicit production build.
// Keep this boundary separate from ordinary staff pages and preview configuration.
export const productionOnlyFiles = Object.freeze([
  'staff-huntsville-activation.html',
  'assets/js/staff-huntsville-activation.js',
]);

export const activationHeaders = "/staff-huntsville-activation.html\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2; style-src 'self'; img-src 'self'; connect-src https://exdocjbmylgxssanymjk.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\n/staff-huntsville-activation\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2; style-src 'self'; img-src 'self'; connect-src https://exdocjbmylgxssanymjk.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\n/assets/js/staff-huntsville-activation.js\n  Cache-Control: no-store\n";
