// /api/evidence
//   GET                       : list registry
//   GET  ?action=links        : list share links (Admin/Manager/Assessor)
//   POST ?action=analyze      : upload→AI→link→store (+optional advisor-chat ref)
//   POST ?action=link-create  : mint external upload link (Admin/Manager/Assessor)
//   POST ?action=link-revoke  : revoke a link (Admin/Manager/Assessor)
//   DELETE                    : remove an evidence item
import { route, readJson, send, requireUser, requirePerm, httpError } from "./_lib/http.js";
import {
  listEvidence, insertEvidence, deleteEvidence, evidenceById,
  insertAdvisorEvidenceRef, insertUploadToken, listUploadTokens, revokeUploadToken,
} from "./_lib/db.js";
import { analyzeEvidence } from "./_lib/anthropic.js";
import { loadContext } from "./_lib/context.js";
import { randomId } from "./_lib/crypto.js";
import { newUploadToken, hashUploadToken, normalizeLinkOptions, tokenState } from "./_lib/uploads.js";

const KINDS = { pdf: 1, image: 1, text: 1 };
const SOFT_DEADLINE_MS = 30000; // Pro: 60s function limit, generous headroom
const CID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Analysis is taking too long. Try again.")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Derived link view for the registry (raw token is never stored, so it can never leak here).
function publicLink(row, now = Date.now()) {
  const st = tokenState(row, now);
  return {
    id: row.id, evidenceId: row.evidence_item_id, createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(), expiresAt: new Date(row.expires_at).getTime(),
    maxUses: row.max_uses, usedCount: row.used_count,
    state: st.ok ? "active" : st.reason, // active | expired | revoked | used_up
  };
}

export default route({
  GET: async (req, res) => {
    if (req.query?.action === "links") {
      await requirePerm(req, "shareEvidence");
      const rows = await listUploadTokens(req.query?.evidenceId || null);
      return send(res, 200, { links: rows.map((r) => publicLink(r)) });
    }
    await requireUser(req);
    send(res, 200, { evidence: await listEvidence() });
  },

  POST: async (req, res) => {
    const action = req.query?.action;

    if (action === "analyze") {
      const user = await requirePerm(req, "evidence");
      const { file, conversationId } = await readJson(req);
      if (!file || !KINDS[file.kind]) throw httpError(400, "Unsupported file");
      if ((file.size || 0) > 4 * 1024 * 1024) throw httpError(413, "File too large (max 4 MB)");
      const { selected, versions, validKeysByFw } = await loadContext();
      if (!selected.length) throw httpError(400, "Load catalogs first");
      const ev = await withDeadline(analyzeEvidence({ file, selected, versions, validKeysByFw, userName: user.name }), SOFT_DEADLINE_MS);
      await insertEvidence(ev);
      // Tie the upload to its advisor chat so later turns can reference it.
      if (conversationId && CID_RE.test(String(conversationId))) {
        try { await insertAdvisorEvidenceRef(String(conversationId), user.id, ev.id, ev.name); }
        catch (e) { console.error("advisor evidence ref failed", e); } // non-fatal
      }
      return send(res, 201, { evidence: ev });
    }

    if (action === "link-create") {
      const user = await requirePerm(req, "shareEvidence");
      const { evidenceId, expiresDays, maxUses } = await readJson(req);
      const item = await evidenceById(String(evidenceId || ""));
      if (!item) throw httpError(404, "Evidence item not found");
      const opts = normalizeLinkOptions({ expiresDays, maxUses });
      const raw = newUploadToken();
      const id = randomId("lnk");
      const expiresAt = new Date(Date.now() + opts.expiresDays * 24 * 60 * 60 * 1000).toISOString();
      await insertUploadToken({ id, evidenceItemId: item.id, tokenHash: hashUploadToken(raw), createdBy: user.name, expiresAt, maxUses: opts.maxUses });
      // The raw token is returned exactly once; only its hash is persisted.
      return send(res, 201, { link: { id, token: raw, evidenceId: item.id, expiresAt: new Date(expiresAt).getTime(), maxUses: opts.maxUses, expiresDays: opts.expiresDays } });
    }

    if (action === "link-revoke") {
      await requirePerm(req, "shareEvidence");
      const { id } = await readJson(req);
      if (!id) throw httpError(400, "id required");
      const ok = await revokeUploadToken(String(id));
      if (!ok) throw httpError(404, "Link not found");
      return send(res, 200, { ok: true });
    }

    throw httpError(400, "Unknown action");
  },

  DELETE: async (req, res) => {
    await requirePerm(req, "evidence");
    const { id } = await readJson(req);
    if (!id) throw httpError(400, "id required");
    await deleteEvidence(id);
    send(res, 200, { ok: true });
  },
});
