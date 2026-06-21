// POST /api/catalogs?phase=meta|domain|save  — phased so each serverless call is short.
// Frontend orchestrates the pool (discover versions, then fetch domains in parallel, then save).
import { route, readJson, send, requireUser, httpError } from "./_lib/http.js";
import { callClaude } from "./_lib/anthropic.js";
import { parseLooseJSON, metaPrompt, catalogPrompt, normalizeMeta, normalizeDomain, FRAMEWORKS, can } from "./_lib/grc.js";
import { saveCatalog } from "./_lib/db.js";

async function requireScopeRole(req) {
  const user = await requireUser(req);
  if (!can(user.role, "manageScope") && !can(user.role, "refetch")) throw httpError(403, "Your role does not permit catalog changes");
  return user;
}

export default route({
  POST: async (req, res) => {
    await requireScopeRole(req);
    const phase = req.query?.phase;
    const body = await readJson(req);

    if (phase === "meta") {
      const fw = body.fw;
      if (!FRAMEWORKS[fw]) throw httpError(400, "Unknown framework");
      let meta = null;
      for (let a = 0; a < 2 && !meta; a++) {
        try { meta = normalizeMeta(parseLooseJSON(await callClaude({ search: true, messages: [{ role: "user", content: metaPrompt(fw) }] })), fw); } catch { meta = null; }
      }
      if (!meta) meta = { version: FRAMEWORKS[fw].fallbackVersion, domains: FRAMEWORKS[fw].fallbackDomains, source: "verified fallback" };
      return send(res, 200, { meta });
    }

    if (phase === "domain") {
      const { fw, domain, version } = body;
      if (!FRAMEWORKS[fw] || !domain) throw httpError(400, "fw and domain required");
      let parsed = null, lastErr = null;
      for (let a = 0; a < 2 && !parsed; a++) {
        try { parsed = parseLooseJSON(await callClaude({ search: a > 0, messages: [{ role: "user", content: catalogPrompt(fw, domain, version) }] })); } catch (e) { lastErr = e; }
      }
      if (!parsed || !Array.isArray(parsed.subdomains)) throw httpError(502, `${FRAMEWORKS[fw].short} D${domain.n}: ${(lastErr && lastErr.message) || "bad shape"}`);
      return send(res, 200, { domain: normalizeDomain(parsed, domain) });
    }

    if (phase === "save") {
      const { fw, catalog } = body;
      if (!FRAMEWORKS[fw] || !catalog?.version || !Array.isArray(catalog.domains)) throw httpError(400, "Invalid catalog");
      catalog.domains.sort((a, b) => a.n - b.n);
      await saveCatalog(fw, catalog);
      return send(res, 200, { ok: true });
    }

    throw httpError(400, "Unknown phase");
  },
});
