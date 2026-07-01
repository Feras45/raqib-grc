// Run: node test/uploads.test.mjs  (dependency-free; node:crypto only)
// Item 6: token hashing, lifecycle, scope guard, file validation, RBAC, rate limit.
import {
  newUploadToken, hashUploadToken, normalizeLinkOptions, tokenState, resolveUploadTarget,
  validateUploadFiles, makeRateLimiter, fileExt, UPLOAD_ALLOWED_EXT, UPLOAD_MAX_BYTES, UPLOAD_MAX_FILES,
} from "../api/_lib/uploads.js";
import { can } from "../api/_lib/grc.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };

const NOW = Date.now();
const activeRow = (over = {}) => ({
  id: "lnk_1", evidence_item_id: "ev_A", token_hash: "h", status: "active",
  expires_at: new Date(NOW + 86400e3).toISOString(), max_uses: 3, used_count: 0, ...over,
});

/* ── token: crypto-random, hash-not-raw ── */
t("tokens are unique, long and URL-safe", () => {
  const a = newUploadToken(), b = newUploadToken();
  if (a === b) throw new Error("collision");
  if (a.length < 32) throw new Error("too short");
  if (!/^[A-Za-z0-9_-]+$/.test(a)) throw new Error("not url-safe");
});
t("stored value is a SHA-256 hash, not the raw token", () => {
  const raw = newUploadToken();
  const h = hashUploadToken(raw);
  if (h === raw) throw new Error("hash equals raw");
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error("not sha256 hex");
  if (h.includes(raw) || raw.includes(h)) throw new Error("raw derivable");
  if (hashUploadToken(raw) !== h) throw new Error("hash not deterministic (lookup would fail)");
});
t("tampered token hashes to a different value (lookup misses)", () => {
  const raw = newUploadToken();
  return hashUploadToken(raw) !== hashUploadToken(raw.slice(0, -1) + (raw.endsWith("A") ? "B" : "A"));
});

/* ── lifecycle ── */
t("active token accepted", () => tokenState(activeRow(), NOW).ok === true);
t("expired token rejected", () => {
  const r = tokenState(activeRow({ expires_at: new Date(NOW - 1000).toISOString() }), NOW);
  return r.ok === false && r.reason === "expired";
});
t("revoked token rejected immediately", () => {
  const r = tokenState(activeRow({ status: "revoked" }), NOW);
  return r.ok === false && r.reason === "revoked";
});
t("used-up token rejected (used_count >= max_uses)", () => {
  const r = tokenState(activeRow({ used_count: 3, max_uses: 3 }), NOW);
  return r.ok === false && r.reason === "used_up";
});
t("single-use: second use rejected", () => tokenState(activeRow({ max_uses: 1, used_count: 1 }), NOW).ok === false);
t("missing row rejected", () => tokenState(null, NOW).ok === false);

/* ── scope: one token = one evidence item ── */
t("token resolves only to its own item", () => resolveUploadTarget(activeRow()) === "ev_A");
t("scope guard: token for item A rejected when request names item B", () => resolveUploadTarget(activeRow(), "ev_B") === null);
t("scope guard: matching explicit id passes", () => resolveUploadTarget(activeRow(), "ev_A") === "ev_A");
t("scope guard: no token row → null", () => resolveUploadTarget(null) === null);

/* ── link options ── */
t("expiry defaults to 7 days; clamped to 1..30", () => {
  if (normalizeLinkOptions({}).expiresDays !== 7) throw new Error("default");
  if (normalizeLinkOptions({ expiresDays: 0 }).expiresDays !== 1) throw new Error("floor");
  if (normalizeLinkOptions({ expiresDays: 999 }).expiresDays !== 30) throw new Error("ceil");
});
t("uses default single-use; clamped to 1..100", () => {
  if (normalizeLinkOptions({}).maxUses !== 1) throw new Error("default");
  if (normalizeLinkOptions({ maxUses: -5 }).maxUses !== 1) throw new Error("floor");
  if (normalizeLinkOptions({ maxUses: 1e6 }).maxUses !== 100) throw new Error("ceil");
});

/* ── file validation (server-side allow-list) ── */
t("allowed types accepted", () => validateUploadFiles([{ name: "report.pdf", size: 1000 }, { name: "shot.PNG", size: 2000 }]).ok === true);
t("disallowed type rejected (exe)", () => validateUploadFiles([{ name: "malware.exe", size: 10 }]).ok === false);
t("disallowed type rejected (html)", () => validateUploadFiles([{ name: "page.html", size: 10 }]).ok === false);
t("double extension judged by final ext", () => validateUploadFiles([{ name: "x.pdf.exe", size: 10 }]).ok === false);
t("oversize file rejected", () => validateUploadFiles([{ name: "big.pdf", size: UPLOAD_MAX_BYTES + 1 }]).ok === false);
t("too many files rejected", () => {
  const files = Array.from({ length: UPLOAD_MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.csv`, size: 10 }));
  return validateUploadFiles(files).ok === false;
});
t("empty list / missing name / zero size rejected", () => {
  if (validateUploadFiles([]).ok) throw new Error("empty");
  if (validateUploadFiles([{ name: "", size: 5 }]).ok) throw new Error("no name");
  if (validateUploadFiles([{ name: "a.csv", size: 0 }]).ok) throw new Error("zero size");
});
t("declared small size with huge base64 payload rejected", () => {
  const f = { name: "a.pdf", size: 100, data: "A".repeat(Math.ceil((UPLOAD_MAX_BYTES * 4) / 3) + 100) };
  return validateUploadFiles([f]).ok === false;
});
t("allow-list matches the spec set", () => {
  for (const e of ["pdf", "png", "jpg", "zip", "csv", "log"]) if (!UPLOAD_ALLOWED_EXT.includes(e)) throw new Error(`missing ${e}`);
});
t("fileExt is case-insensitive and suffix-only", () => fileExt("A.b.PDF") === "pdf" && fileExt("noext") === "");

/* ── authorization: generate/revoke = Admin/Manager/Assessor; Viewer denied ── */
t("shareEvidence: admin allowed", () => can("admin", "shareEvidence") === true);
t("shareEvidence: manager allowed", () => can("manager", "shareEvidence") === true);
t("shareEvidence: assessor allowed", () => can("assessor", "shareEvidence") === true);
t("shareEvidence: viewer denied (both generate and revoke use this perm)", () => can("viewer", "shareEvidence") === false);

/* ── rate limiter ── */
t("rate limiter rejects past the window limit and recovers", () => {
  const lim = makeRateLimiter({ limit: 3, windowMs: 1000 });
  const t0 = 1_000_000;
  if (!lim("ip1", t0) || !lim("ip1", t0 + 1) || !lim("ip1", t0 + 2)) throw new Error("early reject");
  if (lim("ip1", t0 + 3)) throw new Error("4th should reject");
  if (!lim("ip2", t0 + 3)) throw new Error("keys independent");
  if (!lim("ip1", t0 + 1500)) throw new Error("window should reset");
});

/* ── mock-storage upload flow: valid submit attaches to token's item ── */
t("mock flow: consume gates on lifecycle, rows bind to token's item", () => {
  // emulate the atomic UPDATE guard
  const consume = (row) => (tokenState(row).ok ? { ...row, used_count: row.used_count + 1 } : null);
  const store = [];
  const submit = (row, files, requestedId) => {
    const v = validateUploadFiles(files);
    if (!v.ok) return { error: v.error };
    const used = consume(row);
    if (!used) return { error: "gone" };
    const target = resolveUploadTarget(used, requestedId);
    if (!target) return { error: "gone" };
    for (const f of files) store.push({ parentId: target, name: f.name });
    return { ok: true, row: used };
  };
  let row = activeRow({ max_uses: 1 });
  const r1 = submit(row, [{ name: "ok.csv", size: 5 }], undefined);
  if (!r1.ok) throw new Error("first submit should pass");
  if (store[0].parentId !== "ev_A") throw new Error("wrong target");
  row = r1.row;
  if (!submit(row, [{ name: "ok2.csv", size: 5 }]).error) throw new Error("second use should fail (single-use)");
  if (!submit(activeRow(), [{ name: "bad.exe", size: 5 }]).error) throw new Error("bad type should fail");
  if (!submit(activeRow(), [{ name: "ok.csv", size: 5 }], "ev_B").error) throw new Error("cross-item should fail");
});

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
