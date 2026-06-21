// POST /api/catalogs?phase=meta|domain|save  — phased so each serverless call is short.
// Frontend orchestrates the pool (discover versions, then fetch domains in parallel, then save)
// AND owns retries: each invocation here makes exactly one model call and returns fast, so a
// slow attempt fails cleanly inside the function instead of being killed by the platform's hard
// wall-clock limit (10s on Vercel Hobby, regardless of vercel.json's maxDuration).
import { route, readJson, send, requireUser, httpError } from "./_lib/http.js";
import { callClaude } from "./_lib/anthropic.js";
import { parseLooseJSON, metaPrompt, catalogPrompt, normalizeMeta, normalizeDomain, FRAMEWORKS, can } from "./_lib/grc.js";
import { saveCatalog } from "./_lib/db.js";

async function requireScopeRole(req) {
  const user = await requireUser(req);
  if (!can(user.role, "manageScope") && !can(user.role, "refetch")) throw httpError(403, "Your role does not permit catalog changes");
  return user;
}

// Race the model call against a soft deadline so we always respond before Vercel's hard limit.
// Hobby's hard cap is 10s; sit just under it so a clean error beats a platform kill.
const SOFT_DEADLINE_MS = 9500;
// Web search is the dominant token cost here (it injects search results into the prompt) and the
// main source of 429s and timeouts. The NCA ECC / SAMA CSF control structures are stable and known
// to the model, so catalog building runs from model knowledge by default. Flip to true once your
// Anthropic account is on a higher rate tier if you want live version verification.
const CATALOG_SEARCH = false;
function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
      try {
        meta = normalizeMeta(parseLooseJSON(await withDeadline(callClaude({ search: CATALOG_SEARCH, maxTokens: 800, messages: [{ role: "user", content: metaPrompt(fw) }] }), SOFT_DEADLINE_MS)), fw);
      } catch { meta = null; }
      if (!meta) meta = { version: FRAMEWORKS[fw].fallbackVersion, domains: FRAMEWORKS[fw].fallbackDomains, source: "verified fallback" };
      return send(res, 200, { meta });
    }

    if (phase === "domain") {
      const { fw, domain, version, retry } = body;
      if (!FRAMEWORKS[fw] || !domain) throw httpError(400, "fw and domain required");
      let parsed = null, lastErr = null;
      try {
        // web search only on an explicit retry from the frontend (slower, used after a plain miss)
        // model knowledge only (web search disabled above); retry is a fresh attempt, not a search escalation
        parsed = parseLooseJSON(await withDeadline(callClaude({ search: CATALOG_SEARCH, maxTokens: 1500, messages: [{ role: "user", content: catalogPrompt(fw, domain, version) }] }), SOFT_DEADLINE_MS));
      } catch (e) { lastErr = e; }
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
