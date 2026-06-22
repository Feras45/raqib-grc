// Run: node test/crypto.test.mjs  (no deps; uses node:crypto)
import * as C from "../api/_lib/crypto.js";
let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };
const eq = (a, b) => { if (a !== b) throw new Error(`got ${a} want ${b}`); };

/* ── passwords ── */
t("scrypt: verify ok / wrong fails", () => {
  const h = C.hashPassword("Str0ng-Pass!");
  if (!C.verifyPassword("Str0ng-Pass!", h)) throw new Error("should verify");
  if (C.verifyPassword("wrong", h)) throw new Error("should reject");
});
t("scrypt: distinct salts per hash", () => { if (C.hashPassword("samepass1") === C.hashPassword("samepass1")) throw new Error("salt reuse"); });
t("scrypt: rejects <8 chars", () => { try { C.hashPassword("short"); return false; } catch { return true; } });
t("scrypt: malformed stored → false", () => eq(C.verifyPassword("x", "garbage"), false));

/* ── session tokens ── */
t("token: sign/verify payload", () => {
  const tok = C.signToken({ uid: "u1", role: "admin" }, "secret", 60);
  const p = C.verifyToken(tok, "secret");
  eq(p.uid, "u1"); eq(p.role, "admin");
});
t("token: wrong secret → null", () => eq(C.verifyToken(C.signToken({ a: 1 }, "s1", 60), "s2"), null));
t("token: tampered payload → null", () => {
  const tok = C.signToken({ role: "viewer" }, "s", 60).split(".");
  tok[1] = C.signToken({ role: "admin" }, "x", 60).split(".")[1];
  eq(C.verifyToken(tok.join("."), "s"), null);
});
t("token: expired → null", () => eq(C.verifyToken(C.signToken({ a: 1 }, "s", -1), "s"), null));
t("token: malformed → null", () => eq(C.verifyToken("not.a.jwt.x", "s"), null));

/* ── base32 ── */
t("base32: round-trip", () => {
  const buf = Buffer.from("12345678901234567890");
  eq(C.base32Decode(C.base32Encode(buf)).toString(), buf.toString());
});
t("base32: ascii secret → known encoding", () => eq(C.base32Encode(Buffer.from("12345678901234567890")), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"));

/* ── RFC 6238 TOTP test vectors (SHA1, 8 digits, secret '12345678901234567890') ── */
const SEC = C.base32Encode(Buffer.from("12345678901234567890"));
const vec = [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]];
for (const [time, code] of vec) {
  t(`totp RFC6238 t=${time}`, () => eq(C.totp(SEC, { time: time * 1000, digits: 8 }), code));
}
t("hotp RFC4226 counter=1 (8-digit)", () => eq(C.hotp(Buffer.from("12345678901234567890"), 1, 8), "94287082"));

/* ── TOTP verify with skew window ── */
t("verifyTotp: current code passes", () => {
  const now = Date.now();
  const code = C.totp(SEC, { time: now });
  if (!C.verifyTotp(code, SEC)) throw new Error("current should pass");
});
t("verifyTotp: prev-window code passes (skew)", () => {
  const code = C.totp(SEC, { time: Date.now() - 30000 });
  if (!C.verifyTotp(code, SEC, { window: 1 })) throw new Error("skew should pass");
});
t("verifyTotp: far code fails", () => { if (C.verifyTotp(C.totp(SEC, { time: Date.now() - 600000 }), SEC)) throw new Error("should fail"); });
t("verifyTotp: non-numeric rejected", () => eq(C.verifyTotp("abcdef", SEC), false));
t("newTotpSecret: base32, decodes to 20 bytes", () => eq(C.base32Decode(C.newTotpSecret()).length, 20));
t("otpauthURI: well-formed", () => { const u = C.otpauthURI({ secret: "ABC", account: "a@b.com" }); if (!u.startsWith("otpauth://totp/") || !u.includes("secret=ABC") || !u.includes("issuer=Burhan")) throw new Error(u); });

/* ── recovery codes ── */
t("recovery: format + hash/verify", () => {
  const codes = C.genRecoveryCodes(10);
  eq(codes.length, 10);
  if (!/^[0-9a-f]{5}-[0-9a-f]{5}$/.test(codes[0])) throw new Error(codes[0]);
  const h = C.hashRecoveryCode(codes[0]);
  if (!C.verifyRecoveryCode(codes[0], h)) throw new Error("should verify");
  if (!C.verifyRecoveryCode(codes[0].toUpperCase().replace("-", ""), h)) throw new Error("normalize");
  if (C.verifyRecoveryCode(codes[1], h)) throw new Error("wrong code matched");
});

/* ── AES-256-GCM ── */
const KEY = "0".repeat(64);
t("aesgcm: round-trip (Arabic)", () => eq(C.decryptSecret(C.encryptSecret("سر TOTP secret", KEY), KEY), "سر TOTP secret"));
t("aesgcm: tampered ciphertext throws", () => {
  const blob = C.encryptSecret("data", KEY).split(".");
  blob[2] = Buffer.from("tampered").toString("base64");
  try { C.decryptSecret(blob.join("."), KEY); return false; } catch { return true; }
});
t("aesgcm: bad key length rejected", () => { try { C.encryptSecret("x", "abcd"); return false; } catch { return true; } });

console.log(`\n${pass} passed, ${fail} failed`);
if (fails.length) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
