// GET /api/workspace — everything the app needs to render after auth.
import { route, send, requireUser } from "./_lib/http.js";
import { getSettings, getCatalogs, getAssessments, listEvidence, listAudit, listSnapshots } from "./_lib/db.js";

export default route({
  GET: async (req, res) => {
    await requireUser(req);
    const [settings, catalogs, assessments, evidence, audit, snapshots] = await Promise.all([
      getSettings(), getCatalogs(), getAssessments(), listEvidence(), listAudit(300), listSnapshots(60),
    ]);
    send(res, 200, {
      settings: settings ? { frameworks: settings.frameworks, org: settings.org_name, lang: settings.lang } : null,
      catalogs, assessments, evidence, audit, snapshots,
    });
  },
});
