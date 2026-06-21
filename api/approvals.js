// POST /api/approvals — approve or reject (and revert) a pending change. Approver roles only.
import { route, readJson, send, requirePerm } from "./_lib/http.js";
import { getAssessments, upsertAssessment, insertAudit } from "./_lib/db.js";
import { approveRecord, rejectRecord } from "./_lib/grc.js";

export default route({
  POST: async (req, res) => {
    const user = await requirePerm(req, "approve");
    const { key, id, action } = await readJson(req);
    const rec = (await getAssessments())[key];
    if (!rec || rec.review !== "pending") return send(res, 409, { error: "Nothing pending for this control" });
    const approver = { id: user.id, name: user.name, role: user.role };
    let next;
    if (action === "approve") next = approveRecord(rec, approver);
    else if (action === "reject") {
      next = rejectRecord(rec, approver);
      await insertAudit([{ key, id: id || key.split(":")[1], from: rec.s, to: next.s, by: user.name }]);
    } else return send(res, 400, { error: "action must be approve or reject" });
    await upsertAssessment(key, next);
    send(res, 200, { ok: true, key, record: next });
  },
});
