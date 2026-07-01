// Burhan · data layer over Neon Postgres (serverless HTTP driver).
// Single org per deployment: ORG = 'default'. Multi-tenant = add org_id scoping.
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) console.warn("DATABASE_URL not set");
export const sql = neon(process.env.DATABASE_URL || "");
export const ORG = "default";

/* ── users ─────────────────────────────────────────────────────────────── */
export async function userByEmail(email) {
  const rows = await sql`SELECT * FROM users WHERE org_id=${ORG} AND email=${email} LIMIT 1`;
  return rows[0] || null;
}
export async function userById(id) {
  const rows = await sql`SELECT * FROM users WHERE id=${id} AND org_id=${ORG} LIMIT 1`;
  return rows[0] || null;
}
export async function listUsers() {
  return sql`SELECT id,email,name,role,active,mfa_enabled,created_at FROM users WHERE org_id=${ORG} ORDER BY created_at ASC`;
}
export async function countUsers() {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM users WHERE org_id=${ORG}`;
  return rows[0].n;
}
export async function insertUser(u) {
  await sql`INSERT INTO users (id,org_id,email,name,role,pw_hash,active,mfa_enabled,created_at)
    VALUES (${u.id},${ORG},${u.email},${u.name},${u.role},${u.pwHash},true,false,now())`;
  return userById(u.id);
}
export async function setUserRole(id, role) { await sql`UPDATE users SET role=${role} WHERE id=${id} AND org_id=${ORG}`; }
export async function setUserActive(id, active) { await sql`UPDATE users SET active=${active} WHERE id=${id} AND org_id=${ORG}`; }
export async function setUserPassword(id, pwHash) { await sql`UPDATE users SET pw_hash=${pwHash}, failed_attempts=0, locked_until=NULL WHERE id=${id} AND org_id=${ORG}`; }

/* login throttling (per-account, DB-backed so it works across serverless instances) */
export async function registerFailure(id, maxFail = 8, lockMinutes = 15) {
  const rows = await sql`
    UPDATE users SET failed_attempts = failed_attempts + 1,
      locked_until = CASE WHEN failed_attempts + 1 >= ${maxFail} THEN now() + (${lockMinutes} * interval '1 minute') ELSE locked_until END
    WHERE id=${id} RETURNING failed_attempts, locked_until`;
  return rows[0];
}
export async function clearFailures(id) { await sql`UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=${id}`; }
export function isLocked(user) { return user?.locked_until && new Date(user.locked_until) > new Date(); }

/* ── MFA ───────────────────────────────────────────────────────────────── */
export async function setMfaPending(id, encSecret) { await sql`UPDATE users SET mfa_pending=${encSecret} WHERE id=${id} AND org_id=${ORG}`; }
export async function enableMfa(id, encSecret) { await sql`UPDATE users SET mfa_enabled=true, mfa_secret=${encSecret}, mfa_pending=NULL WHERE id=${id} AND org_id=${ORG}`; }
export async function disableMfa(id) {
  await sql`UPDATE users SET mfa_enabled=false, mfa_secret=NULL, mfa_pending=NULL WHERE id=${id} AND org_id=${ORG}`;
  await sql`DELETE FROM recovery_codes WHERE user_id=${id}`;
}
export async function replaceRecoveryCodes(userId, hashes) {
  await sql`DELETE FROM recovery_codes WHERE user_id=${userId}`;
  for (const h of hashes) await sql`INSERT INTO recovery_codes (user_id, code_hash) VALUES (${userId}, ${h})`;
}
export async function unusedRecoveryCodes(userId) {
  return sql`SELECT id, code_hash FROM recovery_codes WHERE user_id=${userId} AND used_at IS NULL`;
}
export async function consumeRecoveryCode(id) { await sql`UPDATE recovery_codes SET used_at=now() WHERE id=${id}`; }

/* ── settings / catalogs ───────────────────────────────────────────────── */
export async function getSettings() {
  const rows = await sql`SELECT frameworks, org_name, lang FROM settings WHERE org_id=${ORG} LIMIT 1`;
  return rows[0] || null;
}
export async function saveSettings(frameworks, orgName, lang) {
  await sql`INSERT INTO settings (org_id, frameworks, org_name, lang) VALUES (${ORG}, ${JSON.stringify(frameworks)}, ${orgName || ""}, ${lang || "en"})
    ON CONFLICT (org_id) DO UPDATE SET frameworks=EXCLUDED.frameworks, org_name=EXCLUDED.org_name, lang=EXCLUDED.lang`;
}
export async function getCatalogs() {
  const rows = await sql`SELECT fw, version, source, data, fetched_at FROM catalogs WHERE org_id=${ORG}`;
  const out = {};
  for (const r of rows) out[r.fw] = { version: r.version, source: r.source, fetchedAt: new Date(r.fetched_at).getTime(), domains: r.data.domains };
  return out;
}
export async function saveCatalog(fw, cat) {
  await sql`INSERT INTO catalogs (org_id, fw, version, source, data, fetched_at) VALUES (${ORG}, ${fw}, ${cat.version}, ${cat.source}, ${JSON.stringify({ domains: cat.domains })}, now())
    ON CONFLICT (org_id, fw) DO UPDATE SET version=EXCLUDED.version, source=EXCLUDED.source, data=EXCLUDED.data, fetched_at=now()`;
}

/* ── assessments ───────────────────────────────────────────────────────── */
export async function getAssessments() {
  const rows = await sql`SELECT key, status, owner, due, note, maturity, review, prev_s, updated_by, updated_at FROM assessments WHERE org_id=${ORG}`;
  const out = {};
  for (const r of rows) {
    out[r.key] = { s: r.status, owner: r.owner || "", due: r.due || "", note: r.note || "", by: r.updated_by || "", t: r.updated_at ? new Date(r.updated_at).getTime() : 0 };
    if (r.maturity != null) out[r.key].m = r.maturity;
    if (r.review) out[r.key].review = r.review;
    if (r.prev_s) out[r.key].prevS = r.prev_s;
  }
  return out;
}
export async function upsertAssessment(key, rec) {
  await sql`INSERT INTO assessments (org_id, key, status, owner, due, note, maturity, review, prev_s, updated_by, updated_at)
    VALUES (${ORG}, ${key}, ${rec.s}, ${rec.owner || null}, ${rec.due || null}, ${rec.note || null}, ${Number.isFinite(rec.m) ? rec.m : null}, ${rec.review || null}, ${rec.prevS || null}, ${rec.by || null}, now())
    ON CONFLICT (org_id, key) DO UPDATE SET status=EXCLUDED.status, owner=EXCLUDED.owner, due=EXCLUDED.due, note=EXCLUDED.note,
      maturity=EXCLUDED.maturity, review=EXCLUDED.review, prev_s=EXCLUDED.prev_s, updated_by=EXCLUDED.updated_by, updated_at=now()`;
}

/* ── evidence ──────────────────────────────────────────────────────────── */
const evidenceRow = (r) => ({ id: r.id, name: r.name, fileType: r.file_type, docType: r.doc_type, summary: r.summary, quality: r.quality, controls: r.controls, size: r.size, by: r.by_name, parentId: r.parent_id || null, t: new Date(r.created_at).getTime() });
export async function listEvidence() {
  const rows = await sql`SELECT * FROM evidence WHERE org_id=${ORG} ORDER BY created_at DESC`;
  const out = {};
  for (const r of rows) out[r.id] = evidenceRow(r);
  return out;
}
export async function evidenceById(id) {
  const rows = await sql`SELECT * FROM evidence WHERE id=${id} AND org_id=${ORG} LIMIT 1`;
  return rows[0] ? evidenceRow(rows[0]) : null;
}
export async function insertEvidence(ev) {
  await sql`INSERT INTO evidence (id, org_id, name, file_type, doc_type, summary, quality, controls, size, by_name, parent_id, created_at)
    VALUES (${ev.id}, ${ORG}, ${ev.name}, ${ev.fileType}, ${ev.docType}, ${ev.summary}, ${ev.quality || null}, ${JSON.stringify(ev.controls)}, ${ev.size || 0}, ${ev.by || null}, ${ev.parentId || null}, now())`;
}
export async function deleteEvidence(id) { await sql`DELETE FROM evidence WHERE id=${id} AND org_id=${ORG}`; }

/* ── advisor conversation memory ───────────────────────────────────────── */
// One batched read: turns + evidence references for a conversation (joined),
// oldest→newest so the context builder can trim from the front.
export async function listAdvisorMessages(conversationId, userId, limit = 80) {
  return sql`SELECT m.id, m.role, m.content, m.evidence_id, m.created_at,
      e.name AS ev_name, e.doc_type AS ev_doc_type, e.summary AS ev_summary,
      e.quality AS ev_quality, e.controls AS ev_controls
    FROM advisor_messages m
    LEFT JOIN evidence e ON e.id = m.evidence_id AND e.org_id = m.org_id
    WHERE m.org_id=${ORG} AND m.conversation_id=${conversationId} AND m.user_id=${userId}
    ORDER BY m.id ASC LIMIT ${limit}`;
}
// Persist a user turn + the assistant reply as one statement (Neon: no per-row round trips).
export async function insertAdvisorTurn(conversationId, userId, userContent, assistantContent) {
  await sql`INSERT INTO advisor_messages (org_id, conversation_id, user_id, role, content)
    VALUES (${ORG}, ${conversationId}, ${userId}, 'user', ${userContent}),
           (${ORG}, ${conversationId}, ${userId}, 'assistant', ${assistantContent})`;
}
export async function insertAdvisorAssistant(conversationId, userId, content) {
  await sql`INSERT INTO advisor_messages (org_id, conversation_id, user_id, role, content)
    VALUES (${ORG}, ${conversationId}, ${userId}, 'assistant', ${content})`;
}
export async function insertAdvisorEvidenceRef(conversationId, userId, evidenceId, name) {
  await sql`INSERT INTO advisor_messages (org_id, conversation_id, user_id, role, content, evidence_id)
    VALUES (${ORG}, ${conversationId}, ${userId}, 'evidence', ${name || ""}, ${evidenceId})`;
}
// Regenerate support: drop assistant turns after the last user turn.
export async function deleteTrailingAssistant(conversationId, userId) {
  await sql`DELETE FROM advisor_messages
    WHERE org_id=${ORG} AND conversation_id=${conversationId} AND user_id=${userId} AND role='assistant'
      AND id > COALESCE((SELECT MAX(id) FROM advisor_messages
        WHERE org_id=${ORG} AND conversation_id=${conversationId} AND user_id=${userId} AND role='user'), 0)`;
}
export async function deleteAdvisorConversation(conversationId, userId) {
  await sql`DELETE FROM advisor_messages WHERE org_id=${ORG} AND conversation_id=${conversationId} AND user_id=${userId}`;
}

/* ── external upload links (token hash only; raw token never stored) ───── */
export async function insertUploadToken(t) {
  await sql`INSERT INTO upload_tokens (id, org_id, evidence_item_id, token_hash, created_by, created_at, expires_at, max_uses, used_count, status)
    VALUES (${t.id}, ${ORG}, ${t.evidenceItemId}, ${t.tokenHash}, ${t.createdBy || null}, now(), ${t.expiresAt}, ${t.maxUses}, 0, 'active')`;
}
export async function uploadTokenByHash(tokenHash) {
  const rows = await sql`SELECT * FROM upload_tokens WHERE org_id=${ORG} AND token_hash=${tokenHash} LIMIT 1`;
  return rows[0] || null;
}
export async function listUploadTokens(evidenceItemId) {
  if (evidenceItemId)
    return sql`SELECT id, evidence_item_id, created_by, created_at, expires_at, max_uses, used_count, status
      FROM upload_tokens WHERE org_id=${ORG} AND evidence_item_id=${evidenceItemId} ORDER BY created_at DESC`;
  return sql`SELECT id, evidence_item_id, created_by, created_at, expires_at, max_uses, used_count, status
    FROM upload_tokens WHERE org_id=${ORG} ORDER BY created_at DESC LIMIT 200`;
}
export async function revokeUploadToken(id) {
  const rows = await sql`UPDATE upload_tokens SET status='revoked' WHERE id=${id} AND org_id=${ORG} RETURNING id`;
  return rows.length > 0;
}
// Atomic consume: guards status/expiry/uses in one statement (race-safe).
export async function consumeUploadToken(tokenHash) {
  const rows = await sql`UPDATE upload_tokens SET used_count = used_count + 1
    WHERE org_id=${ORG} AND token_hash=${tokenHash} AND status='active'
      AND expires_at > now() AND used_count < max_uses
    RETURNING *`;
  return rows[0] || null;
}
export async function insertUploadAudit(entries) {
  for (const e of entries)
    await sql`INSERT INTO upload_audit (org_id, token_id, uploader_name, ip, filename, size, at)
      VALUES (${ORG}, ${e.tokenId}, ${e.uploaderName || null}, ${e.ip || null}, ${e.filename || null}, ${e.size || 0}, now())`;
}

/* ── corrective actions (POA&M) ────────────────────────────────────────── */
const actionRow = (r) => ({
  id: r.id, title: r.title, description: r.description,
  linkedControlIds: r.linked_control_ids || [], linkedEvidenceIds: r.linked_evidence_ids || [],
  ownerUserId: r.owner_user_id || null, ownerName: r.owner_name || "",
  createdBy: r.created_by || null, createdByName: r.created_by_name || "",
  createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  dueDate: r.due_date, priority: r.priority, status: r.status,
  closureRequested: !!r.closure_requested, closureNote: r.closure_note || "",
  closedBy: r.closed_by || null, closedAt: r.closed_at ? new Date(r.closed_at).getTime() : null,
  archived: !!r.archived,
});
export async function listActions() {
  const rows = await sql`SELECT * FROM corrective_actions WHERE org_id=${ORG} AND archived=false ORDER BY created_at DESC`;
  return rows.map(actionRow);
}
export async function actionById(id) {
  const rows = await sql`SELECT * FROM corrective_actions WHERE id=${id} AND org_id=${ORG} LIMIT 1`;
  return rows[0] ? actionRow(rows[0]) : null;
}
export async function insertAction(a) {
  await sql`INSERT INTO corrective_actions (id, org_id, title, description, linked_control_ids, linked_evidence_ids,
      owner_user_id, owner_name, created_by, created_by_name, created_at, updated_at, due_date, priority, status,
      closure_requested, closure_note, closed_by, closed_at, archived)
    VALUES (${a.id}, ${ORG}, ${a.title}, ${a.description || ""}, ${JSON.stringify(a.linkedControlIds || [])}, ${JSON.stringify(a.linkedEvidenceIds || [])},
      ${a.ownerUserId || null}, ${a.ownerName || ""}, ${a.createdBy || null}, ${a.createdByName || ""}, now(), now(),
      ${a.dueDate}, ${a.priority}, ${a.status || "Open"}, false, ${a.closureNote || null}, null, null, false)`;
  return actionById(a.id);
}
export async function updateAction(a) {
  await sql`UPDATE corrective_actions SET title=${a.title}, description=${a.description || ""},
      linked_control_ids=${JSON.stringify(a.linkedControlIds || [])}, linked_evidence_ids=${JSON.stringify(a.linkedEvidenceIds || [])},
      owner_user_id=${a.ownerUserId || null}, owner_name=${a.ownerName || ""}, due_date=${a.dueDate},
      priority=${a.priority}, status=${a.status}, closure_requested=${!!a.closureRequested},
      closure_note=${a.closureNote || null}, closed_by=${a.closedBy || null},
      closed_at=${a.closedAt ? new Date(a.closedAt).toISOString() : null}, archived=${!!a.archived}, updated_at=now()
    WHERE id=${a.id} AND org_id=${ORG}`;
  return actionById(a.id);
}
export async function listActionAudit(limit = 500) {
  const rows = await sql`SELECT action_id, field, old_v, new_v, by_id, by_name, at
    FROM corrective_action_audit WHERE org_id=${ORG} ORDER BY at DESC, id DESC LIMIT ${limit}`;
  return rows.map((r) => ({ actionId: r.action_id, field: r.field, from: r.old_v, to: r.new_v, byId: r.by_id, by: r.by_name, t: new Date(r.at).getTime() }));
}
export async function insertActionAudit(entries) {
  for (const e of entries)
    await sql`INSERT INTO corrective_action_audit (org_id, action_id, field, old_v, new_v, by_id, by_name, at)
      VALUES (${ORG}, ${e.actionId}, ${e.field}, ${e.from == null ? null : String(e.from)}, ${e.to == null ? null : String(e.to)}, ${e.byId || null}, ${e.by || null}, now())`;
}
// Minimal directory for owner assignment/display (no email/hash exposure).
export async function listUserDirectory() {
  return sql`SELECT id, name, role, active FROM users WHERE org_id=${ORG} ORDER BY name ASC`;
}

/* ── audit / snapshots ─────────────────────────────────────────────────── */
export async function listAudit(limit = 300) {
  const rows = await sql`SELECT key, control_id, from_s, to_s, by_name, at FROM audit WHERE org_id=${ORG} ORDER BY at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ key: r.key, id: r.control_id, from: r.from_s, to: r.to_s, by: r.by_name, t: new Date(r.at).getTime() }));
}
export async function insertAudit(entries) {
  for (const e of entries) await sql`INSERT INTO audit (org_id, key, control_id, from_s, to_s, by_name, at) VALUES (${ORG}, ${e.key}, ${e.id}, ${e.from}, ${e.to}, ${e.by || null}, now())`;
}
export async function listSnapshots(limit = 60) {
  const rows = await sql`SELECT pct, at FROM snapshots WHERE org_id=${ORG} ORDER BY at ASC LIMIT ${limit}`;
  return rows.map((r) => ({ pct: r.pct, t: new Date(r.at).getTime() }));
}
export async function insertSnapshot(pct) { await sql`INSERT INTO snapshots (org_id, pct, at) VALUES (${ORG}, ${pct}, now())`; }

export async function resetAll() {
  await sql`DELETE FROM corrective_action_audit WHERE org_id=${ORG}`;
  await sql`DELETE FROM corrective_actions WHERE org_id=${ORG}`;
  await sql`DELETE FROM upload_audit WHERE org_id=${ORG}`;
  await sql`DELETE FROM upload_tokens WHERE org_id=${ORG}`;
  await sql`DELETE FROM advisor_messages WHERE org_id=${ORG}`;
  await sql`DELETE FROM audit WHERE org_id=${ORG}`;
  await sql`DELETE FROM snapshots WHERE org_id=${ORG}`;
  await sql`DELETE FROM evidence WHERE org_id=${ORG}`;
  await sql`DELETE FROM assessments WHERE org_id=${ORG}`;
  await sql`DELETE FROM catalogs WHERE org_id=${ORG}`;
  await sql`DELETE FROM settings WHERE org_id=${ORG}`;
  await sql`DELETE FROM recovery_codes WHERE user_id IN (SELECT id FROM users WHERE org_id=${ORG})`;
  await sql`DELETE FROM users WHERE org_id=${ORG}`;
}
