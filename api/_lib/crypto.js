// Raqib · security primitives. Pure node:crypto, zero dependencies.
// Password KDF (scrypt), signed session tokens (HS256), RFC 6238 TOTP for MFA,
// AES-256-GCM for secret-at-rest, recovery codes. All unit-tested in test/crypto.test.mjs.
import crypto from "node:crypto";

const { scryptSync, randomBytes, timingSafeEqual, createHmac, createCipheriv, createDecipheriv } = crypto;

/* ── constant-time string compare (length-safe) ───────────────────────── */
function ctEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) { timingSafeEqual(ba, ba); return false; }
  return timingSafeEqual(ba, bb);
}

/* ── base64url ─────────────────────────────────────────────────────────── */
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlToBuf = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const b64urlJson = (o) => b64url(Buffer.from(JSON.stringify(o)));

/* ── passwords: scrypt (memory-hard, built-in) ────────────────────────── */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32, maxmem: 128 * 1024 * 1024 };

export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) throw new Error("weak password");
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB, hashB] = String(stored).split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB, "base64");
    const expected = Buffer.from(hashB, "base64");
    const dk = scryptSync(password, salt, expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch { return false; }
}

/* ── session / challenge tokens: minimal HS256 JWT ─────────────────────── */
export function signToken(payload, secret, ttlSeconds) {
  if (!secret) throw new Error("missing secret");
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson({ ...payload, iat: now, exp: now + ttlSeconds });
  const data = `${head}.${body}`;
  const sig = b64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !secret) return null;
  const [head, body, sig] = parts;
  const expected = b64url(createHmac("sha256", secret).update(`${head}.${body}`).digest());
  if (!ctEqual(sig, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlToBuf(body).toString("utf8")); } catch { return null; }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

/* ── base32 (RFC 4648) for TOTP secrets ────────────────────────────────── */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf) {
  let bits = 0, val = 0, out = "";
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, val = 0; const out = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/* ── HOTP / TOTP (RFC 4226 / 6238) ─────────────────────────────────────── */
export function hotp(secretBuf, counter, digits = 6, algo = "sha1") {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(algo, secretBuf).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totp(secretBase32, { time = Date.now(), step = 30, digits = 6, algo = "sha1" } = {}) {
  const counter = Math.floor(time / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits, algo);
}

// Accept a ±window step drift for clock skew.
export function verifyTotp(token, secretBase32, { window = 1, step = 30, digits = 6, algo = "sha1" } = {}) {
  const tok = String(token || "").replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(tok)) return false;
  const now = Date.now();
  for (let w = -window; w <= window; w++) {
    const code = totp(secretBase32, { time: now + w * step * 1000, step, digits, algo });
    if (ctEqual(tok, code)) return true;
  }
  return false;
}

export function newTotpSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes));
}

export function otpauthURI({ secret, account, issuer = "Raqib", digits = 6, period = 30 }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(digits), period: String(period) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/* ── recovery codes (store only hashes) ────────────────────────────────── */
export function genRecoveryCodes(n = 10) {
  return Array.from({ length: n }, () => {
    const hex = randomBytes(5).toString("hex"); // 10 hex chars
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}
export const hashRecoveryCode = (code) => hashPassword(String(code).replace(/[\s-]/g, "").toLowerCase() + "::recovery");
export const verifyRecoveryCode = (code, stored) => verifyPassword(String(code).replace(/[\s-]/g, "").toLowerCase() + "::recovery", stored);

/* ── AES-256-GCM for MFA secret at rest ────────────────────────────────── */
export function encryptSecret(plain, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("DATA_ENC_KEY must be 32 bytes hex (64 chars)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}
export function decryptSecret(blob, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const [ivB, tagB, encB] = String(blob).split(".");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64"));
  d.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([d.update(Buffer.from(encB, "base64")), d.final()]).toString("utf8");
}

export const randomId = (prefix) => `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
export const normEmail = (e) => String(e || "").trim().toLowerCase();
