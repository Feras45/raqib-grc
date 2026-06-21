// node scripts/db-init.mjs — apply schema.sql to DATABASE_URL.
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = neon(url);
const ddl = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
for (const stmt of ddl.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}
console.log("schema applied");
