// POST /api/assessments — apply control changes (manual, bulk, or CSV import plan).
// Body: { items: [{ key, id, s?, owner?, due?, note?, m? }] }. RBAC + approval + audit + snapshot server-side.
import { route, readJson, send, requirePerm } from "./_lib/http.js";
import { applyAssessments } from "./_lib/context.js";

export default route({
  POST: async (req, res) => {
    const user = await requirePerm(req, "assess");
    const { items } = await readJson(req);
    if (!Array.isArray(items) || !items.length) return send(res, 400, { error: "items required" });
    if (items.length > 2000) return send(res, 413, { error: "Too many items" });
    const out = await applyAssessments(items, { id: user.id, name: user.name, role: user.role });
    send(res, 200, out);
  },
});
