// Run: node test/lookup.test.mjs  (dependency-free)
// Item 5: control-code → framework entry lookup, including the no-match path.
import { lookupControl, flattenControls } from "../api/_lib/grc.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };

const catalogs = {
  ncaecc: {
    version: "ECC-2:2024",
    domains: [{
      n: 3, en: "Cybersecurity Resilience", ar: "صمود الأمن السيبراني",
      subdomains: [{
        id: "3-2", en: "Backup Management", ar: "إدارة النسخ الاحتياطية",
        controls: [{ id: "3-2-1", t: "Define and apply backup policy" }],
      }],
    }],
  },
  samacsf: {
    version: "v1.0 (May 2017)",
    domains: [{
      n: 3, en: "Cyber Security Operations & Technology", ar: "",
      subdomains: [{ id: "3.3.5", en: "Identity & Access", ar: "", controls: [{ id: "3.3.5.a", t: "Access recertification" }] }],
    }],
  },
};
const rows = flattenControls(catalogs, ["ncaecc", "samacsf"]);

t('lookup "3-2-1" → title, description context, source', () => {
  const hit = lookupControl("ncaecc:3-2-1", rows);
  if (!hit) throw new Error("no hit");
  if (hit.title !== "Define and apply backup policy") throw new Error(`title: ${hit.title}`);
  if (hit.subdomain !== "Backup Management") throw new Error("subdomain");
  if (hit.domain !== "Cybersecurity Resilience") throw new Error("domain");
  if (hit.framework !== "NCA ECC") throw new Error(`framework: ${hit.framework}`);
  if (hit.source !== "nca.gov.sa") throw new Error(`source: ${hit.source}`);
  if (!hit.regulator.includes("National Cybersecurity Authority")) throw new Error("regulator");
});

t("SAMA-style dotted code resolves with SAMA source", () => {
  const hit = lookupControl("samacsf:3.3.5.a", rows);
  if (!hit) throw new Error("no hit");
  if (hit.source !== "rulebook.sama.gov.sa") throw new Error(hit.source);
  if (hit.framework !== "SAMA CSF") throw new Error(hit.framework);
});

t("no-match path → null (registry shows a no-mapping state, not a broken link)", () => {
  if (lookupControl("ncaecc:9-9-9", rows) !== null) throw new Error("expected null");
  if (lookupControl("unknownfw:1-1-1", rows) !== null) throw new Error("expected null");
  if (lookupControl("", rows) !== null) throw new Error("expected null");
});

t("empty rows / null rows never throw", () => {
  if (lookupControl("ncaecc:3-2-1", []) !== null) throw new Error("expected null");
  if (lookupControl("ncaecc:3-2-1", null) !== null) throw new Error("expected null");
});

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
