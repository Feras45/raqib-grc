// Burhan · shared server-side context + assessment-apply logic.
import { getSettings, getCatalogs, getAssessments, upsertAssessment, insertAudit, insertSnapshot } from "./db.js";
import { flattenControls, scoreOf, makeRecord, buildPostureSummary, FRAMEWORKS } from "./grc.js";

// settings + catalogs + everything derived the AI/proxy/snapshot code needs.
export async function loadContext() {
  const [settings, catalogs] = await Promise.all([getSettings(), getCatalogs()]);
  const frameworks = settings?.frameworks || [];
  const selected = frameworks.filter((f) => catalogs[f] && FRAMEWORKS[f]);
  const rows = flattenControls(catalogs, selected);
  const validKeysByFw = {};
  for (const f of selected) validKeysByFw[f] = new Set(rows.filter((r) => r.fw === f).map((r) => r.key));
  const versions = {};
  for (const f of selected) versions[f] = catalogs[f]?.version || "";
  return { settings, catalogs, selected, rows, validKeysByFw, versions, org: settings?.org_name || "" };
}

// Apply a batch of control changes under one actor: makeRecord → upsert → audit → snapshot.
// items: [{ key, id, s?, owner?, due?, note?, m? }]. Returns { applied, pending, changed }.
export async function applyAssessments(items, actor) {
  const current = await getAssessments();
  const auditAdds = [];
  let applied = 0, anyPending = false;
  const changedKeys = [];
  for (const it of items) {
    const prev = current[it.key];
    const patch = {};
    for (const k of ["s", "owner", "due", "note", "m"]) if (it[k] !== undefined) patch[k] = it[k];
    if (!Object.keys(patch).length) continue;
    const rec = makeRecord(prev, patch, actor);
    current[it.key] = rec;
    await upsertAssessment(it.key, rec);
    applied++; changedKeys.push(it.key);
    if (rec.review === "pending") anyPending = true;
    const from = prev?.s || "unassessed";
    if (from !== rec.s) auditAdds.push({ key: it.key, id: it.id || it.key.split(":")[1], from, to: rec.s, by: actor.name });
  }
  if (auditAdds.length) {
    await insertAudit(auditAdds.reverse());
    const { catalogs, selected } = await loadContext();
    await insertSnapshot(scoreOf(flattenControls(catalogs, selected), current).pct);
  }
  const changed = {};
  for (const k of changedKeys) changed[k] = current[k];
  return { applied, pending: anyPending, changed };
}

export async function postureSummaryNow() {
  const { rows, selected, versions } = await loadContext();
  const assess = await getAssessments();
  return buildPostureSummary(rows, assess, selected, versions);
}
