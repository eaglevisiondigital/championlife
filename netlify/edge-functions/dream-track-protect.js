const COOKIE_NAME = "clc_dream_track";
const TOKEN_PAYLOAD = "champion-life-dream-track-v1";

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

async function sign(secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(TOKEN_PAYLOAD));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default async (request, context) => {
  const url = new URL(request.url);

  // The access page itself must remain public.
  if (url.pathname === "/dream-track-access" || url.pathname === "/dream-track-access/" || url.pathname === "/dream-track-access.html") {
    return context.next();
  }

  const secret = Netlify.env.get("DREAM_TRACK_ACCESS_CODE");
  if (!secret) {
    return new Response("Dream Track access is not configured yet.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const expected = await sign(secret);
  const actual = readCookie(request, COOKIE_NAME);
  if (actual === expected) return context.next();

  const returnTo = encodeURIComponent(url.pathname);
  return Response.redirect(new URL(`/dream-track-access.html?return=${returnTo}`, url.origin), 302);
};
