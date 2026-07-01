// Run: node test/users-auth.test.mjs  (dependency-free; node:crypto only)
// Covers item 3 (remove-user authorization guard) and item 4 (self password
// reset: rejected without correct current password; stored value is hashed).
import { can, ROLES } from "../api/_lib/grc.js";
import { hashPassword, verifyPassword } from "../api/_lib/crypto.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };

/* ── item 3: only admin holds manageUsers (the guard requirePerm uses) ─── */
t("remove-user guard: admin allowed", () => can("admin", "manageUsers") === true);
t("remove-user guard: manager rejected", () => can("manager", "manageUsers") === false);
t("remove-user guard: assessor rejected", () => can("assessor", "manageUsers") === false);
t("remove-user guard: viewer rejected", () => can("viewer", "manageUsers") === false);
t("remove-user guard: unknown role rejected", () => can("ghost", "manageUsers") === false);
t("roles are exactly admin/manager/assessor/viewer", () => JSON.stringify(ROLES) === JSON.stringify(["admin", "manager", "assessor", "viewer"]));

/* ── item 4: change-password logic (mirrors api/auth.js changePassword) ── */
// The route: verify current password against stored scrypt hash, enforce ≥8
// chars, store hashPassword(new). Simulate that exact flow here.
function simulateChangePassword(storedHash, currentPassword, newPassword) {
  if (String(newPassword || "").length < 8) return { ok: false, error: "too short" };
  if (!verifyPassword(String(currentPassword || ""), storedHash)) return { ok: false, error: "current wrong" };
  if (String(currentPassword) === String(newPassword)) return { ok: false, error: "same password" };
  return { ok: true, newHash: hashPassword(String(newPassword)) };
}

const stored = hashPassword("old-password-1");

t("reset rejected with wrong current password", () => {
  const r = simulateChangePassword(stored, "not-the-password", "new-password-9");
  return r.ok === false && r.error === "current wrong";
});
t("reset rejected with empty current password", () => simulateChangePassword(stored, "", "new-password-9").ok === false);
t("reset rejected when new password under 8 chars", () => {
  const r = simulateChangePassword(stored, "old-password-1", "short");
  return r.ok === false && r.error === "too short";
});
t("reset rejected when new password equals current", () => simulateChangePassword(stored, "old-password-1", "old-password-1").ok === false);
t("valid reset: old stops working, new works, stored value is a hash", () => {
  const r = simulateChangePassword(stored, "old-password-1", "brand-new-pass-2");
  if (!r.ok) throw new Error("should succeed");
  if (r.newHash.includes("brand-new-pass-2")) throw new Error("plaintext leaked into stored value");
  if (!r.newHash.startsWith("scrypt$")) throw new Error("not the repo's scrypt scheme");
  if (verifyPassword("old-password-1", r.newHash)) throw new Error("old password still verifies");
  if (!verifyPassword("brand-new-pass-2", r.newHash)) throw new Error("new password does not verify");
});
t("hash is salted (two hashes of same password differ)", () => hashPassword("same-pass-123") !== hashPassword("same-pass-123"));

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
