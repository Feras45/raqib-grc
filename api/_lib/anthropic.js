// Raqib · server-side Anthropic proxy. The API key stays in env, never reaches the browser.
import { parseLooseJSON, metaPrompt, catalogPrompt, evidencePrompt, normalizeMeta, normalizeDomain, normalizeEvidence, runPool, FRAMEWORKS } from "./grc.js";
import { httpError } from "./http.js";

const MODEL = "claude-sonnet-4-6";
const KEY = () => { if (!process.env.ANTHROPIC_API_KEY) throw httpError(500, "ANTHROPIC_API_KEY not set"); return process.env.ANTHROPIC_API_KEY; };

export async function callClaude({ messages, system, maxTokens = 1000, search = false }) {
  const body = { model: MODEL, max_tokens: maxTokens, system: system || "", messages };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw httpError(res.status === 429 ? 429 : 502, `Anthropic API ${res.status}`, txt.slice(0, 300));
  }
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
}

/* Two-phase catalog build (official-source discovery → parallel domain fetch). */
export async function fetchCatalogs(frameworks, force, existing = {}) {
  const result = {};
  const targets = frameworks.filter((f) => FRAMEWORKS[f] && (force || !existing[f]));
  for (const f of frameworks) if (!targets.includes(f) && existing[f]) result[f] = existing[f];
  if (!targets.length) return result;

  const metas = {};
  await runPool(targets.map((f) => async () => {
    let meta = null;
    for (let a = 0; a < 2 && !meta; a++) {
      try { meta = normalizeMeta(parseLooseJSON(await callClaude({ search: true, messages: [{ role: "user", content: metaPrompt(f) }] })), f); } catch { meta = null; }
    }
    metas[f] = meta || { version: FRAMEWORKS[f].fallbackVersion, domains: FRAMEWORKS[f].fallbackDomains, source: "verified fallback" };
  }), 2);

  const jobs = [];
  for (const f of targets) { result[f] = { version: metas[f].version, source: metas[f].source, domains: [] }; for (const d of metas[f].domains) jobs.push({ f, d }); }
  const errors = [];
  await runPool(jobs.map(({ f, d }) => async () => {
    let parsed = null, lastErr = null;
    for (let a = 0; a < 2 && !parsed; a++) {
      try { parsed = parseLooseJSON(await callClaude({ search: a > 0, messages: [{ role: "user", content: catalogPrompt(f, d, metas[f].version) }] })); } catch (e) { lastErr = e; }
    }
    if (!parsed || !Array.isArray(parsed.subdomains)) errors.push(`${FRAMEWORKS[f].short} D${d.n}: ${(lastErr && lastErr.message) || "bad shape"}`);
    else result[f].domains.push(normalizeDomain(parsed, d));
  }), 3);

  if (errors.length) throw httpError(502, errors.join(" | "));
  for (const f of targets) result[f].domains.sort((a, b) => a.n - b.n);
  return result;
}

/* Analyze one uploaded file as compliance evidence. */
export async function analyzeEvidence({ file, selected, versions, validKeysByFw, userName }) {
  let block;
  if (file.kind === "pdf") block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } };
  else if (file.kind === "image") block = { type: "image", source: { type: "base64", media_type: file.mime || "image/png", data: file.data } };
  else block = { type: "text", text: `--- Attached file ${file.name} ---\n${String(file.text || "").slice(0, 24000)}\n--- end ---` };

  const raw = await callClaude({ messages: [{ role: "user", content: [block, { type: "text", text: evidencePrompt(selected, versions) }] }] });
  const parsed = parseLooseJSON(raw);
  return normalizeEvidence(parsed, validKeysByFw, { name: file.name, kind: file.kind, size: file.size }, userName);
}

export function advisorSystem({ org, selected, posture, userLang, versions }) {
  const scope = selected.map((f) => `${FRAMEWORKS[f].short} ${(versions && versions[f]) || ""}`.trim()).join(" and ");
  return [
    `You are Raqib (رقيب), a senior Saudi GRC advisor covering ${scope}${org ? ` for ${org}` : ""}.`,
    `LANGUAGE RULE: Reply entirely in the language of the user's LAST message. If Arabic, use formal MSA with correct Saudi regulatory terminology (الهيئة الوطنية للأمن السيبراني, الضوابط الأساسية للأمن السيبراني, البنك المركزي السعودي, إطار الأمن السيبراني), keeping control identifiers in official Latin form (e.g. ECC 2-3-1, SAMA 3.3.5).${userLang === "ar" ? " Interface language is Arabic; prefer Arabic when ambiguous." : ""}`,
    `STYLE: Regulator-grade precision. Cite control numbers. Name concrete evidence artifacts. Dense, brief, numbered steps. No filler.`,
    posture ? `LIVE ASSESSMENT CONTEXT:\n${posture}` : "",
  ].filter(Boolean).join("\n\n");
}
