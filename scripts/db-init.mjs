// node scripts/db-init.mjs — apply schema.sql to DATABASE_URL.
// Uses the neon() HTTP driver. It is a tagged-template function and runs ONE
// statement per call, so we split schema.sql and invoke it per statement via a
// synthesized template-strings array (works across driver versions; no .query()).
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = neon(url);
const tsa = (s) => Object.assign([s], { raw: [s] }); // looks like a tagged-template call

const ddl = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const statements = ddl
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim()) // drop full-line comments
  .filter(Boolean);

let n = 0;
for (const stmt of statements) {
  try { await sql(tsa(stmt)); n++; }
  catch (e) { console.error(`\nFailed on statement #${n + 1}:\n${stmt.slice(0, 120)}...\n${e.message}`); process.exit(1); }
}
console.log(`schema applied (${n} statements)`);
