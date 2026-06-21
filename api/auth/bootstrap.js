// POST /api/auth/bootstrap — create the first administrator (only when no users exist).
import { route, readJson, send, issueSession, publicUser, httpError } from "../_lib/http.js";
import { hashPassword, normEmail, randomId } from "../_lib/crypto.js";
import { countUsers, insertUser } from "../_lib/db.js";

export default route({
  POST: async (req, res) => {
    if (await countUsers() > 0) throw httpError(409, "Already initialized");
    const { name, email, password } = await readJson(req);
    if (!String(name || "").trim()) throw httpError(400, "Name required");
    if (!normEmail(email)) throw httpError(400, "Valid email required");
    if (String(password || "").length < 8) throw httpError(400, "Password must be at least 8 characters");
    const user = await insertUser({ id: randomId("u"), email: normEmail(email), name: String(name).trim(), role: "admin", pwHash: hashPassword(password) });
    issueSession(res, user);
    send(res, 201, { ok: true, user: publicUser(user) });
  },
});
