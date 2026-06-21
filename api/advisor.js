// POST /api/advisor — chat proxy. System prompt + posture built server-side.
// Single model call per request, capped under Vercel Hobby's 10s hard limit so a
// slow response fails cleanly with a retryable error instead of a platform timeout.
import { route, readJson, send, requirePerm } from "./_lib/http.js";
import { callClaude, advisorSystem } from "./_lib/anthropic.js";
import { loadContext, postureSummaryNow } from "./_lib/context.js";

const SOFT_DEADLINE_MS = 8000;
function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The advisor is taking too long. Try again.")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default route({
  POST: async (req, res) => {
    await requirePerm(req, "advisor");
    const { messages, ground, lang } = await readJson(req);
    if (!Array.isArray(messages) || !messages.length) return send(res, 400, { error: "messages required" });
    const { selected, versions, org } = await loadContext();
    const posture = ground ? await postureSummaryNow() : "";
    const clean = messages.slice(-12)
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    const reply = await withDeadline(callClaude({ system: advisorSystem({ org, selected, versions, userLang: lang, posture }), messages: clean }), SOFT_DEADLINE_MS);
    send(res, 200, { reply });
  },
});
