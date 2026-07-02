// Burhan · advisor conversation context builder. Pure, dependency-free,
// unit-tested in test/advisor-context.test.mjs.
//
// The model's OUTPUT budget is fixed at 2000 tokens (api/advisor.js). This
// module guards the INPUT side: it rebuilds per-conversation context from
// stored turns + evidence references and truncates the oldest turns when the
// history would blow the input budget — never silently unbounded.

export const OUTPUT_BUDGET_TOKENS = 2000;
export const INPUT_BUDGET_TOKENS = 6000;   // history share of the prompt
export const MAX_TURNS = 24;               // hard cap regardless of size
export const MAX_EVIDENCE_REFS = 12;       // newest refs win
export const EVIDENCE_SUMMARY_CHARS = 400;

// ~4 chars/token is a safe overestimate for mixed English/Arabic GRC text.
export const estimateTokens = (s) => Math.ceil(String(s || "").length / 4);

/* Reply-language rule: any Arabic in the question → answer in Arabic (this
   covers mixed Arabic/English questions); pure English → English. */
export const detectReplyLang = (text) => (/[؀-ۿ]/.test(String(text || "")) ? "ar" : "en");

/*
 * turns: chronological rows [{ role: 'user'|'assistant'|'evidence', content,
 *   evidence?: { name, docType, summary, controls } }]
 * Returns { messages, evidenceBlock, dropped }:
 *  - messages: ordered [{role:'user'|'assistant', content}] within budget,
 *    oldest dropped first, always starting with a 'user' turn (API contract).
 *  - evidenceBlock: compact text describing evidence uploaded IN THIS CHAT
 *    (references only — file bytes are never re-embedded into prompts).
 */
export function buildAdvisorContext(turns, { budgetTokens = INPUT_BUDGET_TOKENS, maxTurns = MAX_TURNS } = {}) {
  const all = Array.isArray(turns) ? turns : [];

  const evRefs = all.filter((t) => t.role === "evidence" && t.evidence).slice(-MAX_EVIDENCE_REFS);
  const evidenceBlock = evRefs.length
    ? "EVIDENCE UPLOADED IN THIS CONVERSATION (references, already stored in the registry):\n" +
      evRefs.map((t, i) => {
        const e = t.evidence;
        const controls = Array.isArray(e.controls) && e.controls.length
          ? ` · linked controls: ${e.controls.map((k) => String(k).split(":")[1] || k).join(", ")}`
          : " · no linked controls";
        return `${i + 1}. "${e.name}" (${e.docType || "file"})${controls}\n   Summary: ${String(e.summary || "").slice(0, EVIDENCE_SUMMARY_CHARS)}`;
      }).join("\n")
    : "";

  // Chat turns, newest first, accumulate until the budget or turn cap is hit.
  const chat = all.filter((t) => (t.role === "user" || t.role === "assistant") && String(t.content || "").trim());
  let budget = Math.max(0, budgetTokens - estimateTokens(evidenceBlock));
  const kept = [];
  for (let i = chat.length - 1; i >= 0; i--) {
    const content = String(chat[i].content).slice(0, 8000);
    const cost = estimateTokens(content);
    // Always keep the newest turn even if it alone exceeds the budget.
    if (kept.length && (kept.length >= maxTurns || cost > budget)) break;
    kept.unshift({ role: chat[i].role, content });
    budget -= cost;
  }
  // The Messages API requires the thread to open with a user turn.
  while (kept.length && kept[0].role !== "user") kept.shift();

  return { messages: kept, evidenceBlock, dropped: chat.length - kept.length };
}

/* Map DB rows (listAdvisorMessages join) to builder turns. */
export function turnsFromRows(rows) {
  return (rows || []).map((r) => r.role === "evidence"
    ? {
        role: "evidence", content: r.content || "",
        evidence: r.evidence_id
          ? { name: r.ev_name || r.content || "file", docType: r.ev_doc_type, summary: r.ev_summary, controls: r.ev_controls }
          : null,
      }
    : { role: r.role, content: r.content || "" });
}
