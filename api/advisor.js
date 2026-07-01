// /api/advisor — chat proxy with per-conversation memory (Neon-backed).
//   GET    ?cid=…            : return stored turns + evidence refs for the chat
//   POST   { cid, content }  : rebuild context from stored turns + evidence refs,
//                              call the model, persist both turns
//   POST   { cid, regenerate }: drop trailing assistant turn(s), re-answer
//   POST   { messages }      : legacy stateless mode (used for one-shot guidance)
//   DELETE { cid }           : clear the conversation
// System prompt + posture built server-side. Single model call per request.
import { route, readJson, send, requirePerm, httpError } from "./_lib/http.js";
import { callClaude, advisorSystem } from "./_lib/anthropic.js";
import { loadContext } from "./_lib/context.js";
import {
  getAssessments, listAdvisorMessages, insertAdvisorTurn, insertAdvisorAssistant,
  deleteTrailingAssistant, deleteAdvisorConversation,
} from "./_lib/db.js";
import { buildPostureSummary } from "./_lib/grc.js";
import { buildAdvisorContext, turnsFromRows, OUTPUT_BUDGET_TOKENS } from "./_lib/advisor-context.js";

const SOFT_DEADLINE_MS = 45000; // well under Pro's 60s function limit
const ADVISOR_MODEL = "claude-sonnet-4-6"; // Pro plan: 60s limit affords Sonnet's richer reasoning
const CID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The advisor is taking too long. Try a shorter or more specific question.")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const publicTurn = (r) => ({
  role: r.role, content: r.content, t: new Date(r.created_at).getTime(),
  ...(r.role === "evidence" && r.evidence_id ? {
    ev: { id: r.evidence_id, name: r.ev_name || r.content, docType: r.ev_doc_type, summary: r.ev_summary, quality: r.ev_quality, controls: r.ev_controls || [] },
  } : {}),
});

export default route({
  GET: async (req, res) => {
    const user = await requirePerm(req, "advisor");
    const cid = String(req.query?.cid || "");
    if (!CID_RE.test(cid)) throw httpError(400, "cid required");
    const rows = await listAdvisorMessages(cid, user.id);
    send(res, 200, { messages: rows.map(publicTurn) });
  },

  POST: async (req, res) => {
    const user = await requirePerm(req, "advisor");
    const body = await readJson(req);
    const { cid, content, regenerate, ground, lang, messages } = body;

    /* Legacy stateless mode (per-control guidance uses this). */
    if (!cid) {
      if (!Array.isArray(messages) || !messages.length) return send(res, 400, { error: "messages required" });
      const [ctx, assess] = await Promise.all([loadContext(), ground ? getAssessments() : Promise.resolve(null)]);
      const posture = ground && assess ? buildPostureSummary(ctx.rows, assess, ctx.selected, ctx.versions) : "";
      const clean = messages.slice(-12)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
      const reply = await withDeadline(
        callClaude({ model: ADVISOR_MODEL, maxTokens: OUTPUT_BUDGET_TOKENS, system: advisorSystem({ org: ctx.org, selected: ctx.selected, versions: ctx.versions, userLang: lang, posture }), messages: clean }),
        SOFT_DEADLINE_MS,
      );
      return send(res, 200, { reply });
    }

    /* Conversation mode. */
    if (!CID_RE.test(String(cid))) throw httpError(400, "Invalid conversation id");
    const text = String(content || "").trim().slice(0, 8000);
    if (!regenerate && !text) throw httpError(400, "content required");
    if (regenerate) await deleteTrailingAssistant(cid, user.id);

    // One batched load: workspace context, (optional) posture, prior turns+evidence refs.
    const [ctx, assess, rows] = await Promise.all([
      loadContext(),
      ground ? getAssessments() : Promise.resolve(null),
      listAdvisorMessages(cid, user.id),
    ]);
    const posture = ground && assess ? buildPostureSummary(ctx.rows, assess, ctx.selected, ctx.versions) : "";

    const turns = turnsFromRows(rows);
    if (!regenerate) turns.push({ role: "user", content: text });
    const { messages: history, evidenceBlock } = buildAdvisorContext(turns);
    if (!history.length) throw httpError(400, "Nothing to answer — send a message first");

    const system = [
      advisorSystem({ org: ctx.org, selected: ctx.selected, versions: ctx.versions, userLang: lang, posture }),
      evidenceBlock,
    ].filter(Boolean).join("\n\n");

    const reply = await withDeadline(
      callClaude({ model: ADVISOR_MODEL, maxTokens: OUTPUT_BUDGET_TOKENS, system, messages: history }),
      SOFT_DEADLINE_MS,
    );

    if (regenerate) await insertAdvisorAssistant(cid, user.id, reply);
    else await insertAdvisorTurn(cid, user.id, text, reply);
    send(res, 200, { reply });
  },

  DELETE: async (req, res) => {
    const user = await requirePerm(req, "advisor");
    const { cid } = await readJson(req);
    if (!CID_RE.test(String(cid || ""))) throw httpError(400, "cid required");
    await deleteAdvisorConversation(cid, user.id);
    send(res, 200, { ok: true });
  },
});
