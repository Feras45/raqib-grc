// /api/auth/mfa?action=setup|enable|verify|disable  — TOTP enrollment, login verification, teardown.
import { route, readJson, send, requireUser, issueSession, readChallenge, publicUser, httpError } from "../_lib/http.js";
import { newTotpSecret, otpauthURI, verifyTotp, encryptSecret, decryptSecret, genRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, verifyPassword } from "../_lib/crypto.js";
import { userById, setMfaPending, enableMfa, disableMfa, replaceRecoveryCodes, unusedRecoveryCodes, consumeRecoveryCode, registerFailure, clearFailures, isLocked } from "../_lib/db.js";

const ENC = () => { const k = process.env.DATA_ENC_KEY; if (!k || k.length !== 64) throw httpError(500, "DATA_ENC_KEY must be 64 hex chars (32 bytes)"); return k; };

async function setup(req, res) {
  const user = await requireUser(req);
  const secret = newTotpSecret();
  await setMfaPending(user.id, encryptSecret(secret, ENC()));
  send(res, 200, { secret, otpauth: otpauthURI({ secret, account: user.email }) });
}

async function enable(req, res) {
  const user = await requireUser(req);
  if (!user.mfa_pending) throw httpError(400, "Start setup first");
  const { code } = await readJson(req);
  const secret = decryptSecret(user.mfa_pending, ENC());
  if (!verifyTotp(code, secret)) throw httpError(401, "Code did not verify. Check your authenticator clock.");
  await enableMfa(user.id, user.mfa_pending);
  const codes = genRecoveryCodes(10);
  await replaceRecoveryCodes(user.id, codes.map(hashRecoveryCode));
  send(res, 200, { ok: true, recoveryCodes: codes }); // shown once
}

async function verify(req, res) {
  const { challenge, code } = await readJson(req);
  const ch = readChallenge(challenge);
  if (!ch) throw httpError(401, "Challenge expired. Sign in again.");
  const user = await userById(ch.uid);
  if (!user || !user.active || !user.mfa_enabled) throw httpError(401, "MFA not available");
  if (isLocked(user)) throw httpError(423, "Account locked. Try again later.");

  let ok = false;
  if (user.mfa_secret && verifyTotp(code, decryptSecret(user.mfa_secret, ENC()))) ok = true;
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

async function disable(req, res) {
  const user = await requireUser(req);
  const { password } = await readJson(req);
  if (!verifyPassword(String(password || ""), user.pw_hash)) throw httpError(401, "Password incorrect");
  await disableMfa(user.id);
  send(res, 200, { ok: true });
}

const ACTIONS = { setup, enable, verify, disable };

export default route({
  POST: async (req, res) => {
    const fn = ACTIONS[req.query?.action];
    if (!fn) throw httpError(400, "Unknown action");
    await fn(req, res);
  },
});
