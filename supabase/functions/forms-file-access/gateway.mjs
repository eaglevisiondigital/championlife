export function createFileHandler(config, fetcher = fetch) {
  const origins = new Set(config.origins || []);
  return async (req) => {
    const origin = req.headers.get("origin"),
      headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
      reply = (status, data) =>
        new Response(JSON.stringify(data), { status, headers });
    if (!origins.has(origin)) return reply(403, { error: "File unavailable." });
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, apikey, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply(405, { error: "File unavailable." });
    try {
      if (
        !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url || "") ||
        !config.serviceKey ||
        !config.publicKey
      )
        throw Error("configuration");
      const bearer = req.headers.get("authorization");
      const body = await req.text();
      if (body.length > 2000) throw Error("body");
      const input = JSON.parse(body);
      if (
        !input ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (k) =>
            ![
              "organization",
              "form",
              "submission",
              "file",
              "public_slug",
            ].includes(k),
        ) ||
        Object.entries(input).some(
          ([k, v]) =>
            typeof v !== "string" ||
            !(
              k === "public_slug"
                ? /^[a-z0-9][a-z0-9-]{2,79}$/
                : /^[a-f0-9-]{36}$/
            ).test(v),
        )
      )
        throw Error("input");
      if (!input.public_slug && !/^Bearer [A-Za-z0-9_.-]+$/.test(bearer || ""))
        throw Error("identity");
      const args = input.public_slug
        ? {
            p_org: input.organization,
            p_slug: input.public_slug,
            p_file: input.file,
          }
        : {
            p_action: "file_authorize",
            p_org: input.organization,
            p_payload: {
              id: input.form,
              submission_id: input.submission,
              file_id: input.file,
            },
          };
      const read = await fetcher(
        config.url +
          "/rest/v1/rpc/" +
          (input.public_slug ? "forms_public_file" : "forms_workspace"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.publicKey,
            ...(input.public_slug ? {} : { Authorization: bearer }),
          },
          body: JSON.stringify(args),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!read.ok) throw Error("denied");
      const file = await read.json();
      if (
        file.bucket !== "platform-form-files" ||
        !new RegExp("^" + input.organization + "/[a-f0-9-]{36}$").test(
          file.path || "",
        )
      )
        throw Error("scope");
      const signed = await fetcher(
        config.url + "/storage/v1/object/sign/platform-form-files/" + file.path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.serviceKey,
            Authorization: "Bearer " + config.serviceKey,
          },
          body: JSON.stringify({ expiresIn: 60 }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!signed.ok) throw Error("storage");
      const data = await signed.json();
      if (!data.signedURL?.startsWith("/object/sign/platform-form-files/"))
        throw Error("sign");
      return reply(200, {
        url: config.url + "/storage/v1" + data.signedURL,
        filename: file.filename,
      });
    } catch {
      return reply(403, { error: "File unavailable." });
    }
  };
}
