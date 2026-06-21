// Raqib · frontend API client. Same-origin; the session is an httpOnly cookie,
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
  analyzeEvidence: (file) => req("POST", "/api/evidence?action=analyze", { file }),
  deleteEvidence: (id) => req("DELETE", "/api/evidence", { id }),
  // advisor
  advisor: (messages, ground, lang) => req("POST", "/api/advisor", { messages, ground, lang }),
  // users
  listUsers: () => req("GET", "/api/users"),
  addUser: (p) => req("POST", "/api/users", p),
  patchUser: (p) => req("PATCH", "/api/users", p),
};
