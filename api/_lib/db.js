// Raqib · data layer over Neon Postgres (serverless HTTP driver).
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
export async function listEvidence() {
  const rows = await sql`SELECT * FROM evidence WHERE org_id=${ORG} ORDER BY created_at DESC`;
  const out = {};
  for (const r of rows) out[r.id] = { id: r.id, name: r.name, fileType: r.file_type, docType: r.doc_type, summary: r.summary, quality: r.quality, controls: r.controls, size: r.size, by: r.by_name, t: new Date(r.created_at).getTime() };
  return out;
}
export async function insertEvidence(ev) {
  await sql`INSERT INTO evidence (id, org_id, name, file_type, doc_type, summary, quality, controls, size, by_name, created_at)
    VALUES (${ev.id}, ${ORG}, ${ev.name}, ${ev.fileType}, ${ev.docType}, ${ev.summary}, ${ev.quality}, ${JSON.stringify(ev.controls)}, ${ev.size || 0}, ${ev.by || null}, now())`;
}
export async function deleteEvidence(id) { await sql`DELETE FROM evidence WHERE id=${id} AND org_id=${ORG}`; }

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
  await sql`DELETE FROM audit WHERE org_id=${ORG}`;
  await sql`DELETE FROM snapshots WHERE org_id=${ORG}`;
  await sql`DELETE FROM evidence WHERE org_id=${ORG}`;
  await sql`DELETE FROM assessments WHERE org_id=${ORG}`;
  await sql`DELETE FROM catalogs WHERE org_id=${ORG}`;
  await sql`DELETE FROM settings WHERE org_id=${ORG}`;
  await sql`DELETE FROM recovery_codes WHERE user_id IN (SELECT id FROM users WHERE org_id=${ORG})`;
  await sql`DELETE FROM users WHERE org_id=${ORG}`;
}
