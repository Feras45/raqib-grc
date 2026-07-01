// Run: node test/poam.test.mjs  (dependency-free)
// Item 7: transitions, closure guard, per-role authorization, overdue
// derivation, audit rows on status/owner/due-date change.
import {
  ACTION_STATUSES, ACTION_PRIORITIES, isLegalTransition, canTransition, closureGuard,
  isOverdue, isDueSoon, validateActionInput, buildActionAudit, applyActionPatch,
  actionEditScope, canCreateAction, canAssignOwner, canArchiveAction,
} from "../api/_lib/poam.js";
import { can } from "../api/_lib/grc.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };

const NOW = Date.UTC(2026, 6, 1); // 2026-07-01
const base = (over = {}) => ({
  id: "ca_1", title: "Fix backup gaps", description: "", status: "Open", priority: "High",
  dueDate: "2026-07-20", ownerUserId: "u_owner", ownerName: "Owner", createdBy: "u_mgr",
  linkedControlIds: ["ncaecc:3-2-1"], linkedEvidenceIds: [], closureNote: "", closureRequested: false,
  closedBy: null, closedAt: null, archived: false,
  ...over,
});
const MGR = { id: "u_mgr", name: "Manager M", role: "manager" };
const ADM = { id: "u_adm", name: "Admin A", role: "admin" };
const OWN = { id: "u_owner", name: "Owner O", role: "assessor" };
const ASR = { id: "u_asr", name: "Assessor S", role: "assessor" };
const VWR = { id: "u_vwr", name: "Viewer V", role: "viewer" };

/* ── transitions ── */
t("legal: Open→In Progress / In Progress→Blocked / Blocked→Closed", () =>
  isLegalTransition("Open", "In Progress") && isLegalTransition("In Progress", "Blocked") && isLegalTransition("Blocked", "Closed"));
t("illegal: same→same and Closed→Blocked rejected", () =>
  !isLegalTransition("Open", "Open") && !isLegalTransition("Closed", "Blocked"));
t("illegal: unknown status rejected", () => !isLegalTransition("Open", "Done") && !isLegalTransition("New", "Open"));
t("only admin/manager may reach Closed", () =>
  canTransition("manager", false, "In Progress", "Closed") && canTransition("admin", false, "Open", "Closed")
  && !canTransition("assessor", true, "In Progress", "Closed") && !canTransition("viewer", false, "Open", "Closed"));
t("owner can reach In Progress / Blocked, viewer cannot", () =>
  canTransition("assessor", true, "Open", "In Progress") && canTransition("assessor", true, "In Progress", "Blocked")
  && !canTransition("viewer", true, "Open", "In Progress"));
t("reopen from Closed is admin/manager only", () =>
  canTransition("admin", false, "Closed", "Open") && !canTransition("assessor", true, "Closed", "Open"));

/* ── closure guard ── */
t("closure needs evidence AND note", () => {
  if (closureGuard(base(), "done").ok) throw new Error("no evidence should fail");
  if (closureGuard(base({ linkedEvidenceIds: ["ev1"] }), "").ok) throw new Error("no note should fail");
  if (!closureGuard(base({ linkedEvidenceIds: ["ev1"] }), "fixed and verified").ok) throw new Error("both present should pass");
});

/* ── overdue derivation (never stored) ── */
t("past-due open → overdue", () => isOverdue(base({ dueDate: "2026-06-20" }), NOW) === true);
t("past-due CLOSED → not overdue", () => isOverdue(base({ dueDate: "2026-06-20", status: "Closed" }), NOW) === false);
t("future due → not overdue", () => isOverdue(base({ dueDate: "2026-07-20" }), NOW) === false);
t("due today → not overdue yet", () => isOverdue(base({ dueDate: "2026-07-01" }), NOW) === false);
t("archived → not overdue", () => isOverdue(base({ dueDate: "2020-01-01", archived: true }), NOW) === false);
t("due-soon window (7d): in / out / closed", () =>
  isDueSoon(base({ dueDate: "2026-07-05" }), NOW) === true
  && isDueSoon(base({ dueDate: "2026-07-20" }), NOW) === false
  && isDueSoon(base({ dueDate: "2026-07-05", status: "Closed" }), NOW) === false);

/* ── authorization per role ── */
t("create: admin/manager/assessor yes, viewer no (perm + helper agree)", () =>
  canCreateAction("admin") && canCreateAction("manager") && canCreateAction("assessor") && !canCreateAction("viewer")
  && can("manager", "poam") && !can("viewer", "poam"));
t("assign owner: admin/manager only", () => canAssignOwner("admin") && canAssignOwner("manager") && !canAssignOwner("assessor") && !canAssignOwner("viewer"));
t("archive: admin/manager only", () => canArchiveAction("manager") && !canArchiveAction("assessor"));
t("edit scope: owner=own, assessor-creator=own, stranger-assessor=none, viewer=none", () =>
  actionEditScope("assessor", true, false) === "own"
  && actionEditScope("assessor", false, true) === "own"
  && actionEditScope("assessor", false, false) === "none"
  && actionEditScope("viewer", true, true) === "none"
  && actionEditScope("manager", false, false) === "full");

/* ── applyActionPatch end-to-end rules ── */
t("owner moves to In Progress; audit row records old+new", () => {
  const r = applyActionPatch(base(), { status: "In Progress" }, OWN, NOW);
  if (r.error) throw new Error(r.error);
  if (r.next.status !== "In Progress") throw new Error("status");
  const a = r.audit.find((x) => x.field === "status");
  if (!a || a.from !== "Open" || a.to !== "In Progress" || a.by !== "Owner O") throw new Error("audit row wrong");
});
t("owner links evidence and requests closure but CANNOT close", () => {
  const r1 = applyActionPatch(base({ status: "In Progress" }), { linkedEvidenceIds: ["ev1"], closureNote: "fixed", closureRequested: true }, OWN, NOW);
  if (r1.error) throw new Error(r1.error);
  if (!r1.next.closureRequested) throw new Error("closure not requested");
  const r2 = applyActionPatch(r1.next, { status: "Closed" }, OWN, NOW);
  if (!r2.error) throw new Error("owner self-close must be rejected");
});
t("manager approves closure: closed_by/closed_at set, audit written", () => {
  const ready = base({ status: "In Progress", linkedEvidenceIds: ["ev1"], closureNote: "fixed & verified", closureRequested: true });
  const r = applyActionPatch(ready, { status: "Closed" }, MGR, NOW);
  if (r.error) throw new Error(r.error);
  if (r.next.closedBy !== "Manager M" || r.next.closedAt !== NOW) throw new Error("closed_by/closed_at");
  if (r.next.closureRequested) throw new Error("request flag should clear");
  if (!r.audit.some((a) => a.field === "status" && a.to === "Closed")) throw new Error("no audit");
});
t("closure without evidence rejected; without note rejected", () => {
  const r1 = applyActionPatch(base({ status: "In Progress", closureNote: "note" }), { status: "Closed" }, MGR, NOW);
  if (!r1.error) throw new Error("no evidence should reject");
  const r2 = applyActionPatch(base({ status: "In Progress", linkedEvidenceIds: ["ev1"] }), { status: "Closed" }, MGR, NOW);
  if (!r2.error) throw new Error("no note should reject");
});
t("single patch can link evidence + note + close (status applied last)", () => {
  const r = applyActionPatch(base({ status: "In Progress" }), { linkedEvidenceIds: ["ev9"], closureNote: "all done", status: "Closed" }, ADM, NOW);
  if (r.error) throw new Error(r.error);
  return r.next.status === "Closed";
});
t("viewer rejected on any patch", () => applyActionPatch(base(), { status: "In Progress" }, VWR, NOW).error !== undefined);
t("assessor cannot touch an action they neither own nor created", () =>
  applyActionPatch(base(), { description: "x" }, ASR, NOW).error !== undefined);
t("owner cannot reassign ownership; manager can (audited)", () => {
  const r1 = applyActionPatch(base(), { ownerUserId: "u_asr" }, OWN, NOW);
  if (!r1.error) throw new Error("owner reassign should reject");
  const r2 = applyActionPatch(base(), { ownerUserId: "u_asr", ownerName: "Assessor S" }, MGR, NOW);
  if (r2.error) throw new Error(r2.error);
  const a = r2.audit.find((x) => x.field === "owner");
  if (!a || a.from !== "u_owner" || a.to !== "u_asr") throw new Error("owner audit row wrong");
});
t("due-date change writes audit with old+new", () => {
  const r = applyActionPatch(base(), { dueDate: "2026-08-01" }, MGR, NOW);
  const a = r.audit.find((x) => x.field === "due_date");
  if (!a || a.from !== "2026-07-20" || a.to !== "2026-08-01") throw new Error("due audit wrong");
});
t("non-audited field change writes NO audit rows", () => {
  const r = applyActionPatch(base(), { description: "more detail" }, MGR, NOW);
  return r.audit.length === 0;
});
t("archive: manager only via patch too", () => {
  if (!applyActionPatch(base(), { archived: true }, OWN, NOW).error) throw new Error("owner archive should reject");
  return applyActionPatch(base(), { archived: true }, ADM, NOW).next.archived === true;
});
t("illegal transition via patch → 400-class error", () => {
  const r = applyActionPatch(base({ status: "Closed", linkedEvidenceIds: ["e"], closureNote: "n" }), { status: "Blocked" }, ADM, NOW);
  return r.error !== undefined && r.status === 400;
});
t("reopen clears closed_by/closed_at", () => {
  const closed = base({ status: "Closed", linkedEvidenceIds: ["e"], closureNote: "n", closedBy: "Manager M", closedAt: NOW - 1000 });
  const r = applyActionPatch(closed, { status: "Open" }, ADM, NOW);
  if (r.error) throw new Error(r.error);
  return r.next.closedBy === null && r.next.closedAt === null;
});

/* ── validation ── */
t("create validation: title + due date + priority", () => {
  if (validateActionInput({ title: "", dueDate: "2026-07-01", priority: "High" }).ok) throw new Error("empty title");
  if (validateActionInput({ title: "x", dueDate: "soon", priority: "High" }).ok) throw new Error("bad date");
  if (validateActionInput({ title: "x", dueDate: "2026-07-01", priority: "Urgent" }).ok) throw new Error("bad priority");
  return validateActionInput({ title: "x", dueDate: "2026-07-01", priority: "Critical" }).ok === true;
});
t("status and priority sets match the spec", () =>
  JSON.stringify(ACTION_STATUSES) === JSON.stringify(["Open", "In Progress", "Blocked", "Closed"])
  && JSON.stringify(ACTION_PRIORITIES) === JSON.stringify(["Low", "Medium", "High", "Critical"]));
t("buildActionAudit ignores unchanged fields", () => buildActionAudit(base(), base(), MGR).length === 0);

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
