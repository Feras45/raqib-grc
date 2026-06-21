// GET list · POST ?action=analyze (upload→AI→link→store) · DELETE remove
import { route, readJson, send, requireUser, requirePerm, httpError } from "./_lib/http.js";
import { listEvidence, insertEvidence, deleteEvidence } from "./_lib/db.js";
import { analyzeEvidence } from "./_lib/anthropic.js";
import { loadContext } from "./_lib/context.js";

const KINDS = { pdf: 1, image: 1, text: 1 };

export default route({
  GET: async (req, res) => { await requireUser(req); send(res, 200, { evidence: await listEvidence() }); },
  POST: async (req, res) => {
    const user = await requirePerm(req, "evidence");
    if (req.query?.action !== "analyze") throw httpError(400, "Unknown action");
    const { file } = await readJson(req);
    if (!file || !KINDS[file.kind]) throw httpError(400, "Unsupported file");
    if ((file.size || 0) > 4 * 1024 * 1024) throw httpError(413, "File too large (max 4 MB)");
    const { selected, versions, validKeysByFw } = await loadContext();
    if (!selected.length) throw httpError(400, "Load catalogs first");
    const ev = await analyzeEvidence({ file, selected, versions, validKeysByFw, userName: user.name });
    await insertEvidence(ev);
    send(res, 201, { evidence: ev });
  },
  DELETE: async (req, res) => {
    await requirePerm(req, "evidence");
    const { id } = await readJson(req);
    if (!id) throw httpError(400, "id required");
    await deleteEvidence(id);
    send(res, 200, { ok: true });
  },
});
