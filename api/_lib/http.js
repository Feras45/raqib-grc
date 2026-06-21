// Raqib · HTTP/session/RBAC helpers for Vercel Node functions.
import { verifyToken, signToken } from "./crypto.js";
import { can } from "./grc.js";
import { userById, isLocked } from "./db.js";

export const SESSION_COOKIE = "raqib_session";
const SESSION_TTL = 60 * 60 * 12;            // 12h full session
export const CHALLENGE_TTL = 60 * 5;          // 5m MFA challenge

const SECRET = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw httpError(500, "SESSION_SECRET missing or too short (need ≥32 chars)");
  return s;
};

export function httpError(status, message, extra) { const e = new Error(message); e.status = status; if (extra) e.extra = extra; return e; }

/* ── cookies ───────────────────────────────────────────────────────────── */
export function parseCookies(req) {
  const out = {};
  const raw = req.headers?.cookie;
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function serializeCookie(name, value, maxAge) {
  const bits = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV !== "development") bits.push("Secure");
  return bits.join("; ");
}
export function setSessionCookie(res, token) { res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, token, SESSION_TTL)); }
export function clearSessionCookie(res) { res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }

export function issueSession(res, user) {
  const token = signToken({ uid: user.id, role: user.role, stage: "full" }, SECRET(), SESSION_TTL);
  setSessionCookie(res, token);
}
export function issueChallenge(user) {
  return signToken({ uid: user.id, stage: "mfa" }, SECRET(), CHALLENGE_TTL);
}
export function readChallenge(token) {
  const p = verifyToken(token, SECRET());
  return p && p.stage === "mfa" ? p : null;
}

/* ── auth guards ───────────────────────────────────────────────────────── */
// Returns the live DB user for a valid full session, else throws 401.
export async function requireUser(req) {
  const tok = parseCookies(req)[SESSION_COOKIE];
  const payload = verifyToken(tok, SECRET());
  if (!payload || payload.stage !== "full") throw httpError(401, "Not authenticated");
  const user = await userById(payload.uid);
  if (!user || !user.active) throw httpError(401, "Session invalid");
  if (isLocked(user)) throw httpError(423, "Account locked");
  return user;
}
export async function requirePerm(req, perm) {
  const user = await requireUser(req);
  if (!can(user.role, perm)) throw httpError(403, "Your role does not permit this action");
  return user;
}

/* ── body / response ───────────────────────────────────────────────────── */
const MAX_BODY = 6 * 1024 * 1024; // > 4MB evidence file as base64 padding headroom
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;            // Vercel pre-parses small JSON
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw httpError(413, "Payload too large"); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw httpError(400, "Invalid JSON body"); }
}
export const send = (res, status, obj) => { res.status(status).json(obj); };
export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, mfaEnabled: !!u.mfa_enabled });

/* ── method router + error wrapper ─────────────────────────────────────── */
export function route(handlers) {
  return async (req, res) => {
    const fn = handlers[req.method];
    if (!fn) { res.setHeader("Allow", Object.keys(handlers).join(", ")); return send(res, 405, { error: "Method not allowed" }); }
    try { await fn(req, res); }
    catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      send(res, status, { error: e.message || "Server error", ...(e.extra ? { detail: e.extra } : {}) });
    }
  };
}
