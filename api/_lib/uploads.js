// Burhan · external evidence-upload links. Token generation/hashing plus the
// pure guards for lifecycle, file validation, scope and rate limiting.
// Unit-tested in test/uploads.test.mjs.
import crypto from "node:crypto";

/* ── policy constants ──────────────────────────────────────────────────── */
export const UPLOAD_ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "zip", "csv", "log", "txt"];
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;   // per file (matches internal 4 MB cap)
export const UPLOAD_MAX_TOTAL = 4 * 1024 * 1024;   // per submit (body cap headroom)
export const UPLOAD_MAX_FILES = 3;                 // per submit
export const DEFAULT_EXPIRY_DAYS = 7;
export const MAX_EXPIRY_DAYS = 30;
export const MAX_USES_CAP = 100;

/* ── token: crypto-random raw value; only a SHA-256 hash is stored ─────── */
export const newUploadToken = () => crypto.randomBytes(32).toString("base64url");
export const hashUploadToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

export function normalizeLinkOptions({ expiresDays, maxUses } = {}) {
  let days = Number(expiresDays);
  if (!Number.isFinite(days)) days = DEFAULT_EXPIRY_DAYS;
  days = Math.min(Math.max(Math.round(days), 1), MAX_EXPIRY_DAYS);
  let uses = Number(maxUses);
  if (!Number.isFinite(uses)) uses = 1; // single-use by default
  uses = Math.min(Math.max(Math.round(uses), 1), MAX_USES_CAP);
  return { expiresDays: days, maxUses: uses };
}

/* ── lifecycle guard (pure; row shape = upload_tokens columns) ─────────── */
export function tokenState(row, now = Date.now()) {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "revoked") return { ok: false, reason: "revoked" };
  if (row.status !== "active") return { ok: false, reason: "inactive" };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return { ok: false, reason: "expired" };
  if (row.max_uses != null && Number(row.used_count) >= Number(row.max_uses)) return { ok: false, reason: "used_up" };
  return { ok: true };
}

/* ── file validation (server-side; never trust the client) ─────────────── */
export const fileExt = (name) => {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
};
export function validateUploadFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return { ok: false, error: "Attach at least one file" };
  if (files.length > UPLOAD_MAX_FILES) return { ok: false, error: `At most ${UPLOAD_MAX_FILES} files per submission` };
  let total = 0;
  for (const f of files) {
    const name = String(f?.name || "").trim();
    if (!name) return { ok: false, error: "Every file needs a name" };
    const ext = fileExt(name);
    if (!UPLOAD_ALLOWED_EXT.includes(ext)) return { ok: false, error: `File type not allowed. Accepted: ${UPLOAD_ALLOWED_EXT.join(", ")}` };
    const size = Number(f?.size);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "Invalid file size" };
    if (size > UPLOAD_MAX_BYTES) return { ok: false, error: `Each file must be under ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB` };
    total += size;
    // If bytes were transmitted, the declared size must be plausible for them.
    if (typeof f.data === "string" && f.data.length > Math.ceil((UPLOAD_MAX_BYTES * 4) / 3) + 4) {
      return { ok: false, error: `Each file must be under ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB` };
    }
  }
  if (total > UPLOAD_MAX_TOTAL) return { ok: false, error: `Total upload must be under ${Math.round(UPLOAD_MAX_TOTAL / 1024 / 1024)} MB` };
  return { ok: true };
}

/* ── evidence request placeholder ──────────────────────────────────────────
   A link can be generated BEFORE any evidence exists: it binds to a
   placeholder registry item (docType "request") that external uploads then
   attach to — the one-token-one-item scope guarantee is unchanged. */
export function makeRequestEvidence(title, byName) {
  const name = String(title || "").trim().slice(0, 120);
  if (!name) return null;
  return {
    id: `ev_req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    name, fileType: "request", docType: "request",
    summary: "Evidence request — awaiting external upload",
    quality: null, controls: [], size: 0, by: byName || null,
  };
}

/* ── scope: the token row alone decides the target item; request input
      can never redirect an upload to another evidence item ─────────────── */
export function resolveUploadTarget(tokenRow, requestedEvidenceId) {
  if (!tokenRow || !tokenRow.evidence_item_id) return null;
  if (requestedEvidenceId && String(requestedEvidenceId) !== String(tokenRow.evidence_item_id)) return null; // explicit mismatch → reject
  return tokenRow.evidence_item_id;
}

/* ── rate limiter: fixed-window in-memory counter per key. Serverless note:
      this is per-instance (best effort); the DB-side used_count/max_uses is
      the authoritative brake on token abuse ─────────────────────────────── */
export function makeRateLimiter({ limit, windowMs }) {
  const hits = new Map(); // key → { windowStart, count }
  return (key, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || now - h.windowStart >= windowMs) { hits.set(key, { windowStart: now, count: 1 }); return true; }
    h.count += 1;
    if (hits.size > 5000) { // bound memory on long-lived instances
      for (const [k, v] of hits) if (now - v.windowStart >= windowMs) hits.delete(k);
    }
    return h.count <= limit;
  };
}
