// Burhan · frontend API client. Same-origin; the session is an httpOnly cookie,
// so requests just need credentials:"include". No tokens touch JS.

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.detail = data && data.detail;
    throw err;
  }
  return data || {};
}

export const api = {
  // auth (all routed through one function: /api/auth?action=...)
  status: () => req("GET", "/api/auth?action=status"),
  me: () => req("GET", "/api/auth?action=me"),
  bootstrap: (p) => req("POST", "/api/auth?action=bootstrap", p),
  login: (email, password) => req("POST", "/api/auth?action=login", { email, password }),
  logout: () => req("POST", "/api/auth?action=logout"),
  // mfa
  mfaVerify: (challenge, code) => req("POST", "/api/auth?action=mfa-verify", { challenge, code }),
  mfaSetup: () => req("POST", "/api/auth?action=mfa-setup"),
  mfaEnable: (code) => req("POST", "/api/auth?action=mfa-enable", { code }),
  mfaDisable: (password) => req("POST", "/api/auth?action=mfa-disable", { password }),
  // workspace + data
  workspace: () => req("GET", "/api/workspace"),
  saveSettings: (frameworks, org, lang) => req("POST", "/api/settings", { frameworks, org, lang }),
  resetAll: () => req("DELETE", "/api/settings"),
  // catalogs (phased so each call is short)
  catalogMeta: (fw) => req("POST", "/api/catalogs?phase=meta", { fw }),
  catalogDomain: (fw, domain, version, retry) => req("POST", "/api/catalogs?phase=domain", { fw, domain, version, retry: !!retry }),
  catalogSave: (fw, catalog) => req("POST", "/api/catalogs?phase=save", { fw, catalog }),
  // assessments / approvals
  applyAssessments: (items) => req("POST", "/api/assessments", { items }),
  decide: (key, id, action) => req("POST", "/api/approvals", { key, id, action }),
  // evidence
  analyzeEvidence: (file, conversationId) => req("POST", "/api/evidence?action=analyze", { file, conversationId }),
  deleteEvidence: (id) => req("DELETE", "/api/evidence", { id }),
  // evidence upload links (share with external uploaders)
  createUploadLink: (evidenceId, expiresDays, maxUses) => req("POST", "/api/evidence?action=link-create", { evidenceId, expiresDays, maxUses }),
  listUploadLinks: (evidenceId) => req("GET", `/api/evidence?action=links${evidenceId ? `&evidenceId=${encodeURIComponent(evidenceId)}` : ""}`),
  revokeUploadLink: (id) => req("POST", "/api/evidence?action=link-revoke", { id }),
  // public upload page (no session)
  publicUploadInfo: (token) => req("GET", `/api/public-upload?token=${encodeURIComponent(token)}`),
  publicUpload: (token, payload) => req("POST", "/api/public-upload", { token, ...payload }),
  // advisor (stateless one-shot — control guidance)
  advisor: (messages, ground, lang) => req("POST", "/api/advisor", { messages, ground, lang }),
  // advisor conversation memory
  advisorHistory: (cid) => req("GET", `/api/advisor?cid=${encodeURIComponent(cid)}`),
  advisorSend: (cid, content, ground, lang) => req("POST", "/api/advisor", { cid, content, ground, lang }),
  advisorRegen: (cid, ground, lang) => req("POST", "/api/advisor", { cid, regenerate: true, ground, lang }),
  advisorClear: (cid) => req("DELETE", "/api/advisor", { cid }),
  // corrective actions (POA&M)
  listActions: () => req("GET", "/api/actions"),
  createAction: (p) => req("POST", "/api/actions", p),
  patchAction: (id, patch) => req("PATCH", "/api/actions", { id, patch }),
  archiveAction: (id) => req("DELETE", "/api/actions", { id }),
  // users
  listUsers: () => req("GET", "/api/users"),
  addUser: (p) => req("POST", "/api/users", p),
  patchUser: (p) => req("PATCH", "/api/users", p),
  removeUser: (id) => req("DELETE", "/api/users", { id }),
  changePassword: (currentPassword, newPassword) => req("POST", "/api/auth?action=change-password", { currentPassword, newPassword }),
};
