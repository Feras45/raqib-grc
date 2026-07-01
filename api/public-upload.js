// /api/public-upload — the ONLY unauthenticated endpoint. Scope is one
// evidence item, fixed by the token row; nothing else is readable/writable.
//   GET  ?token=…  : token check → target item TITLE + upload limits only
//   POST           : { token, name?, note?, files:[{name,size,data?|text?}] }
// Hardening: raw token never stored (SHA-256 hash lookup), atomic use-count
// consume, per-IP + per-token rate limits, server-side file validation,
// generic errors (no internal ids/stack traces/token echo), mandatory audit.
import { route, readJson, send, httpError } from "./_lib/http.js";
import { uploadTokenByHash, consumeUploadToken, evidenceById, insertEvidence, insertUploadAudit } from "./_lib/db.js";
import { analyzeEvidence } from "./_lib/anthropic.js";
import { loadContext } from "./_lib/context.js";
import { randomId } from "./_lib/crypto.js";
import {
  hashUploadToken, tokenState, validateUploadFiles, resolveUploadTarget, makeRateLimiter, fileExt,
  UPLOAD_ALLOWED_EXT, UPLOAD_MAX_BYTES, UPLOAD_MAX_FILES,
} from "./_lib/uploads.js";

const GENERIC = "This upload link is invalid, expired, or has been used.";
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
// Best-effort per-instance limits; the DB-side max_uses is the hard brake.
const ipLimit = makeRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });
const tokenLimit = makeRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const ipOf = (req) => (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown");

const KIND_BY_EXT = { pdf: "pdf", png: "image", jpg: "image", jpeg: "image", csv: "text", log: "text", txt: "text" }; // zip → metadata only

function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkedToken(rawToken, req) {
  if (!ipLimit(ipOf(req))) throw httpError(429, "Too many requests. Try again later.");
  const raw = String(rawToken || "");
  if (!TOKEN_RE.test(raw)) throw httpError(410, GENERIC);
  if (!tokenLimit(hashUploadToken(raw))) throw httpError(429, "Too many requests. Try again later.");
  const row = await uploadTokenByHash(hashUploadToken(raw));
  if (!tokenState(row).ok) throw httpError(410, GENERIC);
  return row;
}

export default route({
  GET: async (req, res) => {
    const row = await checkedToken(req.query?.token, req);
    const item = await evidenceById(row.evidence_item_id);
    if (!item) throw httpError(410, GENERIC);
    // Title only — no ids, controls, summaries, or other registry data.
    send(res, 200, {
      title: item.name,
      accept: UPLOAD_ALLOWED_EXT, maxBytes: UPLOAD_MAX_BYTES, maxFiles: UPLOAD_MAX_FILES,
    });
  },

  POST: async (req, res) => {
    const body = await readJson(req);
    const preRow = await checkedToken(body.token, req);

    // Validate BEFORE consuming a use so a rejected submit doesn't burn the link.
    const v = validateUploadFiles(body.files);
    if (!v.ok) throw httpError(400, v.error);

    const row = await consumeUploadToken(hashUploadToken(String(body.token)));
    if (!row) throw httpError(410, GENERIC); // raced expiry/revoke/max-uses
    const targetId = resolveUploadTarget(row, body.evidenceId); // body can never redirect the target
    const parent = targetId ? await evidenceById(targetId) : null;
    if (!parent) throw httpError(410, GENERIC);

    const uploaderName = String(body.name || "").trim().slice(0, 80);
    const note = String(body.note || "").trim().slice(0, 500);
    const byLabel = `${uploaderName || "External uploader"} (external)`;

    // Same storage path as internal evidence: AI analysis when the type
    // supports it, metadata-only fallback — the upload is never lost to an
    // analysis failure. Controls always include the target item's links.
    let ctx = null;
    try { ctx = await loadContext(); } catch { ctx = null; }

    const audits = [];
    let attached = 0;
    for (const f of body.files) {
      const name = String(f.name).slice(0, 120);
      const size = Number(f.size) || 0;
      const kind = KIND_BY_EXT[fileExt(name)] || null;
      let ev = null;
      if (kind && ctx && ctx.selected.length && (typeof f.data === "string" || typeof f.text === "string")) {
        try {
          ev = await withDeadline(analyzeEvidence({
            file: { name, kind, size, data: f.data, text: f.text, mime: f.mime },
            selected: ctx.selected, versions: ctx.versions, validKeysByFw: ctx.validKeysByFw, userName: byLabel,
          }), 15000);
        } catch { ev = null; }
      }
      if (!ev) {
        ev = {
          id: randomId("ev"), name, fileType: kind || fileExt(name), docType: "other",
          summary: note ? `External upload — note: ${note}` : "External upload (stored without AI analysis)",
          quality: null, controls: [], size, by: byLabel,
        };
      } else if (note) {
        ev.summary = `${ev.summary} — Uploader note: ${note}`.slice(0, 500);
      }
      ev.parentId = parent.id;
      ev.controls = [...new Set([...(parent.controls || []), ...(ev.controls || [])])];
      await insertEvidence(ev);
      audits.push({ tokenId: row.id, uploaderName: byLabel, ip: ipOf(req), filename: name, size });
      attached++;
    }
    await insertUploadAudit(audits); // mandatory audit trail
    send(res, 201, { ok: true, received: attached });
  },
});
