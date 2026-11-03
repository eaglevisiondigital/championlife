import crypto from "node:crypto";

const COOKIE_NAME = "clc_dream_track";
const TOKEN_PAYLOAD = "champion-life-dream-track-v1";
const DEFAULT_ACCESS_CODE = "DT26CL";

function sign(secret) {
  return crypto.createHmac("sha256", secret).update(TOKEN_PAYLOAD).digest("hex");
}

function safeReturn(value) {
  // Only existing course routes; normalize clean links without decoding caller input.
  const match = /^\/dream-track(-[1-7])?(?:\.html|\/)?$/.exec(value);
  return match && match[0] === value ? `/dream-track${match[1] || ""}.html` : "/dream-track.html";
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const secret = process.env.DREAM_TRACK_ACCESS_CODE || DEFAULT_ACCESS_CODE;

  const form = await req.formData();
  const code = String(form.get("access_code") || "").trim();
  const returnTo = safeReturn(String(form.get("return_to") || ""));

  const supplied = Buffer.from(code);
  const expected = Buffer.from(secret);
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

  if (!matches) {
    const location = `/dream-track-access.html?error=1&return=${encodeURIComponent(returnTo)}`;
    return new Response(null, { status: 303, headers: { Location: location } });
  }

  const token = sign(secret);
  return new Response(null, {
    status: 303,
    headers: {
      Location: returnTo,
      "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
    }
  });
};

export const config = { path: "/.netlify/functions/dream-track-auth" };
