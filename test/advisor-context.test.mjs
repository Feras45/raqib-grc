// Run: node test/advisor-context.test.mjs  (dependency-free)
import { buildAdvisorContext, turnsFromRows, estimateTokens, INPUT_BUDGET_TOKENS } from "../api/_lib/advisor-context.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

const U = (c) => ({ role: "user", content: c });
const A = (c) => ({ role: "assistant", content: c });
const E = (name, summary, controls) => ({ role: "evidence", content: name, evidence: { name, docType: "policy", summary, controls } });

t("orders turns oldest→newest and keeps roles", () => {
  const { messages } = buildAdvisorContext([U("q1"), A("a1"), U("q2"), A("a2"), U("q3")]);
  eq(messages.map((m) => m.content), ["q1", "a1", "q2", "a2", "q3"]);
  eq(messages.map((m) => m.role), ["user", "assistant", "user", "assistant", "user"]);
});

t("evidence refs become a compact block, not chat turns", () => {
  const { messages, evidenceBlock } = buildAdvisorContext([
    U("hello"), E("backup-policy.pdf", "Backup policy covering ECC 2-9", ["ncaecc:2-9-1"]), U("what did I upload?"),
  ]);
  if (messages.some((m) => m.role === "evidence")) throw new Error("evidence leaked into turns");
  if (!evidenceBlock.includes("backup-policy.pdf")) throw new Error("missing name");
  if (!evidenceBlock.includes("2-9-1")) throw new Error("missing control ref");
  if (!evidenceBlock.includes("Backup policy covering")) throw new Error("missing summary");
});

t("truncates oldest first under a small budget, never the newest", () => {
  const long = "x".repeat(2000); // ~500 tokens each
  const turns = [U(long + "1"), A(long + "2"), U(long + "3"), A(long + "4"), U("final question")];
  const { messages, dropped } = buildAdvisorContext(turns, { budgetTokens: 1100 });
  if (dropped < 1) throw new Error("nothing dropped");
  eq(messages[messages.length - 1].content, "final question");
  // oldest survivor must still be a user turn (API contract)
  eq(messages[0].role, "user");
});

t("keeps the newest turn even if it alone exceeds budget", () => {
  const { messages } = buildAdvisorContext([U("y".repeat(9000))], { budgetTokens: 10 });
  eq(messages.length, 1);
  eq(messages[0].role, "user");
});

t("total kept size stays within budget when multiple turns fit", () => {
  const turns = Array.from({ length: 20 }, (_, i) => (i % 2 ? A(`answer ${i} ${"z".repeat(400)}`) : U(`question ${i} ${"z".repeat(400)}`)));
  const budget = 800;
  const { messages } = buildAdvisorContext(turns, { budgetTokens: budget });
  const used = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
  if (messages.length > 1 && used > budget) throw new Error(`over budget: ${used} > ${budget}`);
});

t("respects maxTurns cap", () => {
  const turns = Array.from({ length: 60 }, (_, i) => (i % 2 ? A(`a${i}`) : U(`q${i}`)));
  const { messages } = buildAdvisorContext(turns, { budgetTokens: INPUT_BUDGET_TOKENS, maxTurns: 6 });
  if (messages.length > 6) throw new Error(`kept ${messages.length}`);
  eq(messages[messages.length - 1].content, "a59");
});

t("first message is always a user turn after truncation", () => {
  const { messages } = buildAdvisorContext([A("orphan assistant"), U("q"), A("a")]);
  eq(messages[0].role, "user");
});

t("empty / garbage input → empty context, no crash", () => {
  eq(buildAdvisorContext([]).messages, []);
  eq(buildAdvisorContext(null).messages, []);
  eq(buildAdvisorContext([{ role: "weird", content: "?" }, U("  ")]).messages, []);
});

t("caps evidence refs at newest 12", () => {
  const turns = Array.from({ length: 15 }, (_, i) => E(`f${i}.pdf`, `sum ${i}`, []));
  turns.push(U("q"));
  const { evidenceBlock } = buildAdvisorContext(turns);
  if (evidenceBlock.includes("f0.pdf") || evidenceBlock.includes("f2.pdf")) throw new Error("oldest refs not dropped");
  if (!evidenceBlock.includes("f14.pdf")) throw new Error("newest ref missing");
});

t("turnsFromRows maps DB rows (join shape) to builder turns", () => {
  const rows = [
    { role: "user", content: "hi" },
    { role: "evidence", content: "pol.pdf", evidence_id: "ev1", ev_name: "pol.pdf", ev_doc_type: "policy", ev_summary: "s", ev_controls: ["ncaecc:1-1-1"] },
    { role: "assistant", content: "hello" },
  ];
  const turns = turnsFromRows(rows);
  eq(turns[0], { role: "user", content: "hi" });
  eq(turns[1].role, "evidence");
  eq(turns[1].evidence.controls, ["ncaecc:1-1-1"]);
  eq(turns[2], { role: "assistant", content: "hello" });
});

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
