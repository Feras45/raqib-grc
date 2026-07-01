// Burhan · Corrective Action Plan (POA&M) domain rules. Pure and browser-safe
// (imported by both api/actions.js and the React UI). Unit-tested in
// test/poam.test.mjs.
//
// Roles (exact repo strings: admin / manager / assessor / viewer):
//  - admin/manager  : create, assign, edit, close/approve, reopen, archive
//  - assessor       : create, update actions they own/created; NEVER close
//  - assigned owner : (any non-viewer) update progress/status on their own
//                     action up to — not including — approved closure
//  - viewer         : read-only

export const ACTION_STATUSES = ["Open", "In Progress", "Blocked", "Closed"];
export const ACTION_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const DUE_SOON_DAYS = 7; // fixed threshold (decision logged in BASELINE.md)

export const isManagerial = (role) => role === "admin" || role === "manager";

/* ── edit scope ─────────────────────────────────────────────────────────── */
// "full"  : any field including closure/reopen/owner/archive (admin/manager)
// "own"   : status (not Closed), progress fields, evidence links, closure
//           request — for the assigned owner or an assessor's own creation
// "none"  : read-only
export function actionEditScope(role, isOwner, isCreator) {
  if (isManagerial(role)) return "full";
  if (role === "viewer") return "none";
  if (isOwner || (role === "assessor" && isCreator)) return "own";
  return "none";
}

export const OWN_FIELDS = ["title", "description", "status", "priority", "dueDate", "linkedControlIds", "linkedEvidenceIds", "closureNote", "closureRequested"];
export function canEditField(scope, field) {
  if (scope === "full") return true;
  if (scope === "own") return OWN_FIELDS.includes(field);
  return false;
}

export const canCreateAction = (role) => isManagerial(role) || role === "assessor";
export const canAssignOwner = (role) => isManagerial(role); // assessor creations default to self
export const canArchiveAction = (role) => isManagerial(role);

/* ── status transitions ─────────────────────────────────────────────────── */
const LEGAL = {
  "Open":        ["In Progress", "Blocked", "Closed"],
  "In Progress": ["Open", "Blocked", "Closed"],
  "Blocked":     ["Open", "In Progress", "Closed"],
  "Closed":      ["Open", "In Progress"], // reopen
};
export function isLegalTransition(from, to) {
  return from !== to && Array.isArray(LEGAL[from]) && LEGAL[from].includes(to);
}
// Role-aware: only admin/manager may enter or leave Closed.
export function canTransition(role, isOwner, from, to) {
  if (!isLegalTransition(from, to)) return false;
  if (role === "viewer") return false;
  if (to === "Closed" || from === "Closed") return isManagerial(role);
  return isManagerial(role) || isOwner || role === "assessor";
}

/* ── closure guard: ≥1 linked evidence item AND a closure note ──────────── */
export function closureGuard(action, note) {
  const evs = Array.isArray(action?.linkedEvidenceIds) ? action.linkedEvidenceIds : [];
  if (!evs.length) return { ok: false, error: "Closing requires at least one linked evidence item" };
  if (!String(note ?? action?.closureNote ?? "").trim()) return { ok: false, error: "Closing requires a closure note" };
  return { ok: true };
}

/* ── "Overdue" is DERIVED, never stored ─────────────────────────────────── */
export function isOverdue(action, now = Date.now()) {
  if (!action || action.archived || action.status === "Closed" || !action.dueDate) return false;
  // due_date is a DATE: overdue starts the day after the due date ends (UTC).
  const due = new Date(`${String(action.dueDate).slice(0, 10)}T23:59:59.999Z`).getTime();
  return Number.isFinite(due) && due < now;
}
export function isDueSoon(action, now = Date.now(), days = DUE_SOON_DAYS) {
  if (!action || action.archived || action.status === "Closed" || !action.dueDate) return false;
  const due = new Date(`${String(action.dueDate).slice(0, 10)}T23:59:59.999Z`).getTime();
  return Number.isFinite(due) && due >= now && due <= now + days * 86400e3;
}

/* ── create validation ──────────────────────────────────────────────────── */
export function validateActionInput({ title, dueDate, priority }) {
  if (!String(title || "").trim()) return { ok: false, error: "Title required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return { ok: false, error: "Due date required (YYYY-MM-DD)" };
  if (!ACTION_PRIORITIES.includes(priority)) return { ok: false, error: "Invalid priority" };
  return { ok: true };
}

/* ── audit diff: every status/owner/due-date change writes who/old/new ──── */
const AUDITED = [["status", "status"], ["ownerUserId", "owner"], ["dueDate", "due_date"]];
export function buildActionAudit(prev, next, actor) {
  const rows = [];
  for (const [field, label] of AUDITED) {
    const a = prev?.[field] ?? null, b = next?.[field] ?? null;
    if (String(a ?? "") !== String(b ?? "")) rows.push({ actionId: next.id, field: label, from: a, to: b, byId: actor.id, by: actor.name });
  }
  return rows;
}

/* ── apply a patch under role rules; returns { next, audit } or { error } ─ */
export function applyActionPatch(action, patch, actor, now = Date.now()) {
  const isOwner = !!actor.id && action.ownerUserId === actor.id;
  const isCreator = !!actor.id && action.createdBy === actor.id;
  const scope = actionEditScope(actor.role, isOwner, isCreator);
  if (scope === "none") return { error: "Your role does not permit this action", status: 403 };

  const next = { ...action };
  // Status is applied LAST so a single patch can link evidence + add the
  // closure note + close in one request and still satisfy the closure guard.
  const { status: statusPatch, ...rest } = patch || {};
  for (const [field, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    if (field === "archived") {
      if (!canArchiveAction(actor.role)) return { error: "Only Admin/Manager can archive", status: 403 };
      next.archived = !!value;
      continue;
    }
    if (field === "ownerUserId" || field === "ownerName") {
      if (!canAssignOwner(actor.role)) return { error: "Only Admin/Manager can reassign the owner", status: 403 };
      next[field] = value || null;
      continue;
    }
    if (field === "priority") {
      if (!ACTION_PRIORITIES.includes(value)) return { error: "Invalid priority", status: 400 };
      if (!canEditField(scope, "priority")) return { error: "Not permitted", status: 403 };
      next.priority = value;
      continue;
    }
    if (["title", "description", "dueDate", "linkedControlIds", "linkedEvidenceIds", "closureNote", "closureRequested"].includes(field)) {
      if (!canEditField(scope, field)) return { error: "Not permitted", status: 403 };
      if (field === "title" && !String(value || "").trim()) return { error: "Title required", status: 400 };
      if (field === "dueDate" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return { error: "Invalid due date", status: 400 };
      if ((field === "linkedControlIds" || field === "linkedEvidenceIds") && !Array.isArray(value)) return { error: "Invalid links", status: 400 };
      next[field] = field === "closureRequested" ? !!value : value;
      continue;
    }
    // unknown fields are ignored (id/created*/closed* are server-owned)
  }
  if (statusPatch !== undefined) {
    if (!ACTION_STATUSES.includes(statusPatch)) return { error: "Invalid status", status: 400 };
    if (!isLegalTransition(action.status, statusPatch)) return { error: "Illegal status transition", status: 400 };
    if (!canTransition(actor.role, isOwner, action.status, statusPatch)) return { error: "Status change not permitted for your role", status: 403 };
    if (statusPatch === "Closed") {
      const g = closureGuard(next, next.closureNote);
      if (!g.ok) return { error: g.error, status: 400 };
      next.closedBy = actor.name;
      next.closedAt = now;
      next.closureRequested = false;
    }
    if (action.status === "Closed" && statusPatch !== "Closed") { next.closedBy = null; next.closedAt = null; }
    next.status = statusPatch;
  }
  return { next, audit: buildActionAudit(action, next, actor) };
}
