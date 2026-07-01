// /api/actions — Corrective Action Plan (POA&M).
//   GET    : actions + audit trail + minimal owner directory (any signed-in
//            role; Viewer is read-only because every write is gated below)
//   POST   : create (Admin/Manager/Assessor via "poam"; only Admin/Manager
//            may assign an owner other than themselves)
//   PATCH  : { id, patch } — role/ownership rules in _lib/poam.js; every
//            status/owner/due-date change writes an audit row
//   DELETE : { id } — soft-delete (archived=true), Admin/Manager only
// "Overdue" is derived client- and lib-side, never stored.
import { route, readJson, send, requireUser, requirePerm, httpError } from "./_lib/http.js";
import {
  listActions, actionById, insertAction, updateAction,
  listActionAudit, insertActionAudit, listUserDirectory, userById,
} from "./_lib/db.js";
import { randomId } from "./_lib/crypto.js";
import { validateActionInput, applyActionPatch, canAssignOwner, canArchiveAction, ACTION_PRIORITIES } from "./_lib/poam.js";

export default route({
  GET: async (req, res) => {
    await requireUser(req);
    const [actions, audit, owners] = await Promise.all([listActions(), listActionAudit(500), listUserDirectory()]);
    send(res, 200, { actions, audit, owners });
  },

  POST: async (req, res) => {
    const user = await requirePerm(req, "poam");
    const body = await readJson(req);
    const input = {
      title: String(body.title || "").trim().slice(0, 200),
      description: String(body.description || "").trim().slice(0, 2000),
      dueDate: String(body.dueDate || ""),
      priority: ACTION_PRIORITIES.includes(body.priority) ? body.priority : "Medium",
      linkedControlIds: Array.isArray(body.linkedControlIds) ? body.linkedControlIds.map(String).slice(0, 50) : [],
      linkedEvidenceIds: Array.isArray(body.linkedEvidenceIds) ? body.linkedEvidenceIds.map(String).slice(0, 50) : [],
    };
    const v = validateActionInput(input);
    if (!v.ok) throw httpError(400, v.error);

    // Owner: Admin/Manager may assign anyone; Assessor creations are owned by
    // the assessor (self-assign only — decision logged in BASELINE.md).
    let ownerUserId = user.id, ownerName = user.name;
    if (body.ownerUserId && String(body.ownerUserId) !== user.id) {
      if (!canAssignOwner(user.role)) throw httpError(403, "Only Admin/Manager can assign another owner");
      const owner = await userById(String(body.ownerUserId));
      if (!owner || !owner.active) throw httpError(400, "Owner must be an active user");
      ownerUserId = owner.id; ownerName = owner.name;
    }

    const action = await insertAction({
      id: randomId("ca"), ...input, ownerUserId, ownerName,
      createdBy: user.id, createdByName: user.name, status: "Open",
    });
    await insertActionAudit([
      { actionId: action.id, field: "status", from: null, to: "Open", byId: user.id, by: user.name },
      { actionId: action.id, field: "owner", from: null, to: ownerUserId, byId: user.id, by: user.name },
      { actionId: action.id, field: "due_date", from: null, to: input.dueDate, byId: user.id, by: user.name },
    ]);
    send(res, 201, { action });
  },

  PATCH: async (req, res) => {
    const user = await requireUser(req); // per-field rules below (owner may act without "poam")
    const { id, patch } = await readJson(req);
    const action = await actionById(String(id || ""));
    if (!action || action.archived) throw httpError(404, "Corrective action not found");

    // Owner reassignment needs the display name resolved server-side.
    const p = { ...(patch || {}) };
    if (p.ownerUserId !== undefined) {
      const owner = await userById(String(p.ownerUserId || ""));
      if (!owner || !owner.active) throw httpError(400, "Owner must be an active user");
      p.ownerName = owner.name;
    }

    const result = applyActionPatch(action, p, { id: user.id, name: user.name, role: user.role });
    if (result.error) throw httpError(result.status || 400, result.error);

    const saved = await updateAction(result.next);
    if (result.audit.length) await insertActionAudit(result.audit); // mandatory
    send(res, 200, { action: saved });
  },

  DELETE: async (req, res) => {
    const user = await requireUser(req);
    if (!canArchiveAction(user.role)) throw httpError(403, "Only Admin/Manager can archive");
    const { id } = await readJson(req);
    const action = await actionById(String(id || ""));
    if (!action) throw httpError(404, "Corrective action not found");
    await updateAction({ ...action, archived: true }); // soft-delete: audit survives
    await insertActionAudit([{ actionId: action.id, field: "archived", from: "false", to: "true", byId: user.id, by: user.name }]);
    send(res, 200, { ok: true });
  },
});
