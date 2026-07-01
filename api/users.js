// GET list · POST add · PATCH update (role/active/password) · DELETE remove.
// Admin only (requirePerm "manageUsers"). Self-guarded.
// "Remove" is a soft-delete (deactivate): the row survives so audit trails,
// evidence attribution, and POA&M ownership history stay intact. Login and
// live sessions are blocked for inactive users (auth.js / http.js).
import { route, readJson, send, requirePerm, publicUser, httpError } from "./_lib/http.js";
import { hashPassword, normEmail, randomId } from "./_lib/crypto.js";
import { listUsers, userByEmail, userById, insertUser, setUserRole, setUserActive, setUserPassword } from "./_lib/db.js";
import { ROLES } from "./_lib/grc.js";

export default route({
  GET: async (req, res) => { await requirePerm(req, "manageUsers"); send(res, 200, { users: await listUsers() }); },
  POST: async (req, res) => {
    await requirePerm(req, "manageUsers");
    const { name, email, role, password } = await readJson(req);
    if (!String(name || "").trim() || !normEmail(email)) throw httpError(400, "Name and valid email required");
    if (!ROLES.includes(role)) throw httpError(400, "Invalid role");
    if (String(password || "").length < 8) throw httpError(400, "Password must be at least 8 characters");
    if (await userByEmail(normEmail(email))) throw httpError(409, "Email already in use");
    const u = await insertUser({ id: randomId("u"), email: normEmail(email), name: String(name).trim(), role, pwHash: hashPassword(password) });
    send(res, 201, { user: publicUser(u) });
  },
  PATCH: async (req, res) => {
    const admin = await requirePerm(req, "manageUsers");
    const { id, role, active, password } = await readJson(req);
    const target = await userById(id);
    if (!target) throw httpError(404, "User not found");
    if (id === admin.id && (role !== undefined || active === false)) throw httpError(400, "You cannot change your own role or deactivate yourself");
    if (role !== undefined) { if (!ROLES.includes(role)) throw httpError(400, "Invalid role"); await setUserRole(id, role); }
    if (active !== undefined) await setUserActive(id, !!active);
    if (password !== undefined) { if (String(password).length < 8) throw httpError(400, "Password too short"); await setUserPassword(id, hashPassword(password)); }
    send(res, 200, { user: publicUser(await userById(id)) });
  },
  DELETE: async (req, res) => {
    const admin = await requirePerm(req, "manageUsers");
    const { id } = await readJson(req);
    const target = await userById(id);
    if (!target) throw httpError(404, "User not found");
    if (id === admin.id) throw httpError(400, "You cannot remove yourself");
    await setUserActive(id, false); // soft-delete: block login, keep records
    send(res, 200, { user: publicUser(await userById(id)) });
  },
});
