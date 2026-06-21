// GET settings · POST scope (manageScope) · DELETE reset all (resetData)
import { route, readJson, send, requireUser, requirePerm } from "./_lib/http.js";
import { getSettings, saveSettings, resetAll } from "./_lib/db.js";

export default route({
  GET: async (req, res) => {
    await requireUser(req);
    const s = await getSettings();
    send(res, 200, { settings: s ? { frameworks: s.frameworks, org: s.org_name, lang: s.lang } : null });
  },
  POST: async (req, res) => {
    await requirePerm(req, "manageScope");
    const { frameworks, org, lang } = await readJson(req);
    const valid = (frameworks || []).filter((f) => f === "ncaecc" || f === "samacsf");
    if (!valid.length) return send(res, 400, { error: "Select at least one framework" });
    await saveSettings(valid, org, lang);
    send(res, 200, { ok: true });
  },
  DELETE: async (req, res) => {
    await requirePerm(req, "resetData");
    await resetAll();
    send(res, 200, { ok: true });
  },
});
