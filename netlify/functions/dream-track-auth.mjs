// Retire the legacy shared-code cookie endpoint; enrollment now belongs to an authenticated account.
export default async (request) => new Response(null, { status: 303, headers: { Location: new URL("/dream-track-access.html", request.url).href, "Cache-Control": "no-store" } });
export const config = { path: "/.netlify/functions/dream-track-auth" };
