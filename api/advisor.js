// POST /api/advisor — chat proxy. System prompt + posture built server-side.
// Single model call per request, capped just under Vercel Hobby's 10s hard limit.
import { route, readJson, send, requirePerm } from "./_lib/http.js";
import { callClaude, advisorSystem } from "./_lib/anthropic.js";
import { loadContext } from "./_lib/context.js";
import { getAssessments } from "./_lib/db.js";
import { buildPostureSummary } from "./_lib/grc.js";

const SOFT_DEADLINE_MS = 45000; // well under Pro's 60s function limit
const ADVISOR_MODEL = "claude-sonnet-4-6"; // Pro plan: 60s limit affords Sonnet's richer reasoning

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

    // Single context load + (optional) assessments, fetched in parallel — was previously
    // loading context twice (once here, once inside postureSummaryNow) = wasted round trips.
    const [ctx, assess] = await Promise.all([loadContext(), ground ? getAssessments() : Promise.resolve(null)]);
    const posture = ground && assess ? buildPostureSummary(ctx.rows, assess, ctx.selected, ctx.versions) : "";

    const clean = messages.slice(-12)
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    const reply = await withDeadline(
      callClaude({ model: ADVISOR_MODEL, maxTokens: 2000, system: advisorSystem({ org: ctx.org, selected: ctx.selected, versions: ctx.versions, userLang: lang, posture }), messages: clean }),
      SOFT_DEADLINE_MS,
    );
    send(res, 200, { reply });
  },
});
