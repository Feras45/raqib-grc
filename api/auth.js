// /api/auth?action=...  — all auth in one function (Hobby plan caps deployments at 12).
//   GET  : me, status
//   POST : bootstrap, login, logout, mfa-setup, mfa-enable, mfa-verify, mfa-disable
import { route, readJson, send, requireUser, issueSession, issueChallenge, readChallenge, clearSessionCookie, publicUser, httpError } from "./_lib/http.js";
import {
  hashPassword, verifyPassword, normEmail, randomId,
  newTotpSecret, otpauthURI, verifyTotp, encryptSecret, decryptSecret,
  genRecoveryCodes, hashRecoveryCode, verifyRecoveryCode,
} from "./_lib/crypto.js";
import {
  countUsers, insertUser, userByEmail, userById, isLocked, registerFailure, clearFailures,
  setUserPassword, setMfaPending, enableMfa, disableMfa, replaceRecoveryCodes, unusedRecoveryCodes, consumeRecoveryCode,
} from "./_lib/db.js";

const GENERIC = "Invalid email or password";
const ENC = () => { const k = process.env.DATA_ENC_KEY; if (!k || k.length !== 64) throw httpError(500, "DATA_ENC_KEY must be 64 hex chars (32 bytes)"); return k; };

/* ── GET actions ───────────────────────────────────────────────────────── */
async function me(req, res) { send(res, 200, { user: publicUser(await requireUser(req)) }); }
async function status(_req, res) { send(res, 200, { initialized: (await countUsers()) > 0 }); }

/* ── POST actions ──────────────────────────────────────────────────────── */
async function bootstrap(req, res) {
  if (await countUsers() > 0) throw httpError(409, "Already initialized");
  const { name, email, password } = await readJson(req);
  if (!String(name || "").trim()) throw httpError(400, "Name required");
  if (!normEmail(email)) throw httpError(400, "Valid email required");
  if (String(password || "").length < 8) throw httpError(400, "Password must be at least 8 characters");
  const user = await insertUser({ id: randomId("u"), email: normEmail(email), name: String(name).trim(), role: "admin", pwHash: hashPassword(password) });
  issueSession(res, user);
  send(res, 201, { ok: true, user: publicUser(user) });
}

async function login(req, res) {
  const { email, password } = await readJson(req);
  const user = await userByEmail(normEmail(email));
  if (!user || !user.active) throw httpError(401, GENERIC);          // no user enumeration
  if (isLocked(user)) throw httpError(423, "Account locked. Try again later.");
  if (!verifyPassword(String(password || ""), user.pw_hash)) { await registerFailure(user.id); throw httpError(401, GENERIC); }
  await clearFailures(user.id);
  if (user.mfa_enabled) return send(res, 200, { mfa: true, challenge: issueChallenge(user) });
  issueSession(res, user);
  send(res, 200, { ok: true, user: publicUser(user) });
}

async function logout(_req, res) { clearSessionCookie(res); send(res, 200, { ok: true }); }

async function mfaSetup(req, res) {
  const user = await requireUser(req);
  const secret = newTotpSecret();
  await setMfaPending(user.id, encryptSecret(secret, ENC()));
  send(res, 200, { secret, otpauth: otpauthURI({ secret, account: user.email }) });
}

async function mfaEnable(req, res) {
  const user = await requireUser(req);
  if (!user.mfa_pending) throw httpError(400, "Start setup first");
  const { code } = await readJson(req);
  if (!verifyTotp(code, decryptSecret(user.mfa_pending, ENC()))) throw httpError(401, "Code did not verify. Check your authenticator clock.");
  await enableMfa(user.id, user.mfa_pending);
  const codes = genRecoveryCodes(10);
  await replaceRecoveryCodes(user.id, codes.map(hashRecoveryCode));
  send(res, 200, { ok: true, recoveryCodes: codes }); // shown once
}

async function mfaVerify(req, res) {
  const { challenge, code } = await readJson(req);
  const ch = readChallenge(challenge);
  if (!ch) throw httpError(401, "Challenge expired. Sign in again.");
  const user = await userById(ch.uid);
  if (!user || !user.active || !user.mfa_enabled) throw httpError(401, "MFA not available");
  if (isLocked(user)) throw httpError(423, "Account locked. Try again later.");
  let ok = user.mfa_secret && verifyTotp(code, decryptSecret(user.mfa_secret, ENC()));
  if (!ok) {
    for (const rc of await unusedRecoveryCodes(user.id)) {
      if (verifyRecoveryCode(code, rc.code_hash)) { await consumeRecoveryCode(rc.id); ok = true; break; }
    }
  }
  if (!ok) { await registerFailure(user.id); throw httpError(401, "Invalid authentication code"); }
  await clearFailures(user.id);
  issueSession(res, user);
  send(res, 200, { ok: true, user: publicUser(user) });
}

/* Self-service password change. The current password is REQUIRED (no email
   infrastructure exists in this deployment, so an email-token path is not
   offered). Hashing stays on the repo's single scheme: scrypt via crypto.js.
   Plaintext is never stored or logged. */
async function changePassword(req, res) {
  const user = await requireUser(req);
  const { currentPassword, newPassword } = await readJson(req);
  if (String(newPassword || "").length < 8) throw httpError(400, "Password must be at least 8 characters");
  if (!verifyPassword(String(currentPassword || ""), user.pw_hash)) throw httpError(401, "Current password incorrect");
  if (String(currentPassword) === String(newPassword)) throw httpError(400, "New password must be different");
  await setUserPassword(user.id, hashPassword(String(newPassword)));
  send(res, 200, { ok: true });
}

async function mfaDisable(req, res) {
  const user = await requireUser(req);
  const { password } = await readJson(req);
  if (!verifyPassword(String(password || ""), user.pw_hash)) throw httpError(401, "Password incorrect");
  await disableMfa(user.id);
  send(res, 200, { ok: true });
}

const GETS = { me, status };
const POSTS = { bootstrap, login, logout, "change-password": changePassword, "mfa-setup": mfaSetup, "mfa-enable": mfaEnable, "mfa-verify": mfaVerify, "mfa-disable": mfaDisable };

export default route({
  GET: async (req, res) => { const fn = GETS[req.query?.action]; if (!fn) throw httpError(400, "Unknown action"); await fn(req, res); },
  POST: async (req, res) => { const fn = POSTS[req.query?.action]; if (!fn) throw httpError(400, "Unknown action"); await fn(req, res); },
});
