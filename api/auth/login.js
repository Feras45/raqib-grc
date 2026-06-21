// POST /api/auth/login — password step. Returns an MFA challenge if MFA is enabled.
import { route, readJson, send, issueSession, issueChallenge, publicUser, httpError } from "../_lib/http.js";
import { normEmail } from "../_lib/crypto.js";
import { verifyPassword } from "../_lib/crypto.js";
import { userByEmail, isLocked, registerFailure, clearFailures } from "../_lib/db.js";

const GENERIC = "Invalid email or password";

export default route({
  POST: async (req, res) => {
    const { email, password } = await readJson(req);
    const user = await userByEmail(normEmail(email));
    // Uniform failure for unknown/inactive accounts (no user enumeration).
    if (!user || !user.active) throw httpError(401, GENERIC);
    if (isLocked(user)) throw httpError(423, "Account locked. Try again later.");
    if (!verifyPassword(String(password || ""), user.pw_hash)) {
      await registerFailure(user.id);
      throw httpError(401, GENERIC);
    }
    await clearFailures(user.id);
    if (user.mfa_enabled) return send(res, 200, { mfa: true, challenge: issueChallenge(user) });
    issueSession(res, user);
    send(res, 200, { ok: true, user: publicUser(user) });
  },
});
