// POST /api/advisor — chat proxy. System prompt + posture built server-side.
// Single model call per request, capped just under Vercel Hobby's 10s hard limit.
import { route, readJson, send, requirePerm } from "./_lib/http.js";
import { callClaude, advisorSystem } from "./_lib/anthropic.js";
import { loadContext, postureSummaryNow } from "./_lib/context.js";

const SOFT_DEADLINE_MS = 9500; // just under Hobby's 10s wall
// Sonnet's slower token output can't finish a long answer (checklists, remediation plans)
// inside 10s, producing "taking too long" errors. Haiku generates 2-3x faster, so substantive
// answers complete in time, at lower cost. Set to "claude-sonnet-4-6" for richer reasoning if
// you move to Pro (longer function limit) or wire up response streaming.
const ADVISOR_MODEL = "claude-haiku-4-5-20251001";

function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The advisor is taking too long. Try a shorter or more specific question.")), ms); });
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
    const reply = await withDeadline(callClaude({ model: ADVISOR_MODEL, maxTokens: 1200, system: advisorSystem({ org, selected, versions, userLang: lang, posture }), messages: clean }), SOFT_DEADLINE_MS);
    send(res, 200, { reply });
  },
});
