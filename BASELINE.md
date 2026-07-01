# BASELINE — Burhan feature batch (Advisor, Users, Evidence Registry, POA&M)

Repo layout: Vite/React SPA in `src/` (single `App.jsx`, ~3.4k lines), Vercel
Node functions in `api/`, shared server libs in `api/_lib/`, Neon Postgres via
`@neondatabase/serverless` (`api/_lib/db.js`, single `sql` client at module
scope — reused across requests). Schema in `schema.sql`, applied by
`scripts/db-init.mjs`. Dependency-free unit tests in `test/*.test.mjs`
(`npm test`).

## Confirmed role strings (do not invent)

`users.role` CHECK constraint and `ROLE_MATRIX` (both `api/_lib/grc.js` and
the duplicated copy in `src/App.jsx`) use exactly, lowercase:
**`admin`, `manager`, `assessor`, `viewer`**.
Permissions are checked server-side via `requirePerm(req, perm)`
(`api/_lib/http.js`) → `can(role, perm)` against `ROLE_MATRIX`. Viewer has
every write perm = 0 (only `advisor` = 1, chat is read-only-safe).
NOTE: `api/_lib/grc.js` is the server copy; `src/App.jsx` contains a
duplicated client copy of the same matrix/i18n/helpers (pre-existing pattern —
both copies must be edited in sync).

## How controls and evidence are stored/linked (baseline)

- Catalogs: `catalogs` table, JSONB `{domains:[{n,en,ar,subdomains:[{id,en,ar,controls:[{id,t}]}]}]}`
  per framework (`ncaecc`, `samacsf`). `flattenControls()` yields rows with
  `key = "<fw>:<control_id>"` (e.g. `ncaecc:3-2-1`).
- Evidence: `evidence` table — metadata only (name, file_type, doc_type,
  summary, quality, `controls` JSONB array of `"<fw>:<cid>"` keys, size,
  by_name, created_at). **Original file bytes are never retained**; a file is
  uploaded (base64, ≤4 MB) to `/api/evidence?action=analyze`, analyzed by
  claude-sonnet-4-6, and only the AI summary/quality/control links are stored
  (`insertEvidence`). The UI states this explicitly ("notRetained" string).
- Audit: `audit` table used only for control status transitions.

---

## 1. Advisor — conversation memory

**Before**
- `POST /api/advisor` (`api/advisor.js`) is stateless: the *client* sends the
  last 12 messages from React state (`advisorMsgs` in `App.jsx`); nothing is
  persisted. Reload/logout loses the thread (`setAdvisorMsgsRaw([])`).
- Evidence uploaded in the chat goes to `/api/evidence?action=analyze`; the
  resulting record is shown as a card in the thread but is **not** tied to any
  conversation and is never re-sent to the model — a later question like
  "what did that policy I uploaded cover?" gets no context.
- Model: `claude-sonnet-4-6`, `maxTokens: 2000` (output budget), soft deadline
  45 s. History trimming is a blunt `slice(-12)` + 8000-char cap per message.
- No conversation tables exist in `schema.sql`.

**After** — see "After" notes at the end of this section (filled in below).

## 2. Advisor — markdown rendering

**Before**
- No `react-markdown`/`remark-gfm` anywhere (`package.json` deps: react,
  react-dom, recharts, lucide-react, qrcode, neon). Rendering is a custom
  React-element renderer in `App.jsx`: `RichText` (line-by-line) + `RichLine`
  (bold `**…**` + control-ID chips). **No table support at all** — a GFM table
  in a reply renders as raw `| … | … |` pipe lines.
- Because output is built from React elements (no dangerouslySetInnerHTML),
  there is no crash risk, but tables are unreadable.

## 3. Users — admin can remove a user

**Before**
- `/api/users` (GET/POST/PATCH) is admin-only via `requirePerm(req,
  "manageUsers")` (only `admin` has it). PATCH supports `active: false`
  (deactivate) — already a soft-delete: `users.active=false`, login rejects
  inactive (`auth.js login`: `!user.active → 401`), sessions die
  (`requireUser`: `!user.active → 401`), historical records survive (evidence/
  audit store `by_name` strings, not FKs).
- Self-guard exists: admin cannot deactivate self or change own role.
- **No explicit "Remove" action and no confirm step** — the Users view toggle
  ("Deactivate") fires immediately on click. No DELETE method on the route.
- No hard-delete exists (only the global `resetAll`). → Soft-delete is the
  repo's existing convention; kept. **Flag: hard-delete NOT implemented** —
  if true row deletion is wanted, say so (it would orphan nothing, but audit
  reconstruction of "who did what" would lose the account row).

## 4. Users — user resets own password

**Before**
- **No self-service path.** Only an admin can set another user's password via
  PATCH `/api/users` (`password` field). A logged-in non-admin cannot change
  their own password at all; an admin can't change their own either (PATCH is
  aimed at other users, and no UI offers it for self).
- Hashing scheme (server, the only one in use): **scrypt** via
  `api/_lib/crypto.js` `hashPassword` (N=16384, r=8, p=1, random 16-byte
  salt, format `scrypt$N$r$p$salt$dk`), verified with `verifyPassword`
  (timing-safe). Minimum strength rule used everywhere: **≥ 8 chars**
  (`hashPassword` itself throws under 8). Plaintext is never stored/logged.
  (`src/App.jsx` also carries a legacy salted-SHA-256 pair used only by old
  client-side tests — not used for real auth.)
- No email infrastructure exists in the repo (no mailer, no SMTP config).

## 5. Evidence Registry — clickable control codes

**Before**
- `EvidenceView` renders each linked control as a plain `<Mono>` chip showing
  `key.split(":")[1]` (e.g. `3-2-1`) with only a `title=` tooltip of the
  control title. **Not clickable**; no description, no framework/source info,
  no no-mapping state (a key absent from `allRowsByKey` shows an empty
  tooltip).
- All data needed for a popover already exists client-side: `allRowsByKey`
  (control title, subdomain, domain) and `FRAMEWORKS[fw]` (regulator,
  officialSource, version via `catalogs[fw].version`).

## 6. Evidence Registry — shareable external upload link

**Before**
- **Feature absent entirely.** No token tables, no public endpoint, every
  `/api/*` route requires a session cookie. The only upload path is the
  authenticated Advisor attach (base64 → analyze → metadata row). No rate
  limiting exists anywhere (only per-account login lockout).
- `vercel.json` rewrites all non-`/api` paths to `index.html`, so a public
  SPA route like `/u/<token>` is servable without config changes.

## 7. Corrective Action Plan / POA&M

**Before**
- **Feature absent.** Remediation is only implied: an assessment row can carry
  `owner` (free text), `due` (date) and `note`; the Dashboard derives
  "overdue remediations" as non-compliant + past-due. There is no task
  entity, no owner accountability (owner is a free-text string, not a user),
  no closure workflow, no priority, no POA&M audit trail, no view.
- Reusable pieces: `audit`-style tables, recharts Bar/Pie components on the
  Dashboard, `Card`/drawer UI patterns, `requirePerm`, `randomId`.

## Test harness (baseline)

- `npm test` runs `test/crypto.test.mjs` (28 pass) and `test/grc.test.mjs`.
- **`test/grc.test.mjs` was broken**: line 1 imported the absolute path
  `/home/claude/raqib-saas/api/_lib/grc.js` (leftover from another machine),
  so `npm test` failed with ERR_MODULE_NOT_FOUND. Fixed to a relative import
  as part of this batch.

---

# AFTER — per item (before → after, tests, manual steps)

Verification environment note: the sandbox verifier is offline and no network-
dependent tests were run. Everything below was verified with `node --check`
on every server file, a full `vite build`, and dependency-free unit tests
(`npm test`, 198 assertions, 0 failures). Manual steps are scripted
(expected vs. actual to be confirmed on a deployed instance with a live Neon
DB + ANTHROPIC_API_KEY).

## 1. Advisor — conversation memory

**Before:** stateless proxy; client re-sent its in-memory last-12 messages;
thread lost on reload; uploaded evidence never re-entered the prompt.
**After:**
- New `advisor_messages` table (conversation_id, user_id, role
  user/assistant/evidence, content, evidence_id, created_at). Conversations
  are scoped to the user id — one user cannot read another's chat even with
  a guessed conversation id.
- `POST /api/advisor { cid, content }` rebuilds context server-side from
  stored turns + evidence REFERENCES (name/type/summary/linked controls —
  file bytes are never re-embedded), calls claude-sonnet-4-6 with
  `maxTokens: 2000` (unchanged output budget), then persists the user turn +
  reply in ONE multi-row INSERT. History + evidence refs load in ONE batched
  query (`listAdvisorMessages`: LEFT JOIN evidence). `GET ?cid=` restores the
  thread after reload; `DELETE {cid}` clears it ("Clear thread" now starts a
  fresh conversation id). Regenerate deletes trailing assistant turns
  server-side and re-answers.
- Input-side budget: `api/_lib/advisor-context.js` truncates oldest turns
  first (~6000-token input budget, 24-turn cap, ≤12 newest evidence refs,
  thread always reopens on a user turn) — never silently unbounded.
- Evidence uploaded in a chat: `/api/evidence?action=analyze` now takes
  `conversationId` and writes an `evidence` reference row into the thread.
**Tests:** `test/advisor-context.test.mjs` — 10 pass (ordering, budget
truncation oldest-first, newest-turn always kept, evidence block content,
turn cap, role normalization, DB-row mapping, garbage input).
**Manual script:** sign in → Advisor → upload backup-policy.pdf (expect
evidence card) → send 3 messages → ask "what did the file I uploaded
evidence, and which controls?" (expect answer referencing the upload) →
reload the page → open Advisor (expect the full thread restored).

## 2. Advisor — markdown rendering (tables)

**Before:** custom React renderer, no react-markdown anywhere; GFM tables
rendered as raw pipe characters.
**After:** kept the repo's dependency-free renderer (adding
react-markdown/remark-gfm would have introduced the repo's first rendering
dependency and an HTML-injection surface; the offline sandbox also forbids
new deps) and added GFM-table support: `src/markdown.js` parses replies into
line/table blocks (header + `---` separator detection, alignment `:---:`,
escaped `\|`, tables without outer pipes) and `App.jsx` renders table blocks
as real `<table>` elements — emerald `#168F5B` header, white/off-white zebra
rows, horizontal scroll wrapper for narrow widths. Control-ID chips and
**bold** still work inside cells. Partial/streaming input is safe: a header
whose separator hasn't arrived renders as plain text; a table cut mid-row
keeps its complete rows; nothing throws.
**Tests:** `test/markdown.test.mjs` — 12 pass, incl. the required
markdown-to-HTML assertion (`<table>/<th>/<td>` from a fixed table string),
partial-input no-crash, escaping (no HTML injection), Arabic cells.
**Manual script:** ask the advisor for "a table mapping ECC 2-9 controls to
SAMA CSF equivalents" (expect a real styled table, not pipes; narrow the
window — expect horizontal scroll inside the bubble, not overflow).

## 3. Users — admin removes a user

**Before:** deactivation existed (PATCH `active:false`, admin-only) but fired
instantly with no confirm; no explicit remove endpoint.
**After:** `DELETE /api/users {id}` = soft-delete (sets `active=false`),
`requirePerm("manageUsers")` (admin only) + self-guard (400 on own id).
Login (`!user.active → 401`) and live sessions (`requireUser`) are blocked
immediately; evidence/audit/POA&M records survive (they reference names/ids,
nothing is deleted). The Users view now shows an inline confirm step
("Deactivate {name}? Sign-in is blocked immediately; historical records
remain." Confirm/Cancel) before calling it; reactivation stays one click.
**Flagged:** hard-delete NOT implemented (GRC default is deactivate — say so
if a true row delete is wanted).
**Tests:** `test/users-auth.test.mjs` — authorization guard: admin allowed,
manager/assessor/viewer/unknown rejected; role strings locked.
**Manual script:** as Admin, Users → Deactivate on user X → confirm (expect
"Deactivated" badge). As X: login (expect 401 "Invalid email or password").
As Admin: X's evidence rows and audit entries still listed.

## 4. Users — self password reset

**Before:** no self-service path at all (only admin PATCH on others).
**After:** `POST /api/auth?action=change-password { currentPassword,
newPassword }` for any signed-in user. Requires the correct current password
(verified against the stored scrypt hash) — chosen over an email token
because the repo has zero email infrastructure; adding a mailer was out of
scope for "touch only files needed". Same single hashing scheme
(`crypto.js` scrypt, salted); ≥8-char minimum consistent with every other
password path in the app; plaintext never stored or logged. New "Change
password" card in Settings (current + new + confirm).
**Tests:** `test/users-auth.test.mjs` — reset rejected on wrong/empty
current password, short new password, same-as-old; valid reset: old hash no
longer verifies, new one does, stored value is `scrypt$…` (no plaintext),
salted.
**Manual script:** Settings → Change password with wrong current (expect
"Current password incorrect") → with correct current (expect toast) → sign
out → old password fails, new password signs in.

## 5. Evidence Registry — clickable control codes

**Before:** codes were inert `<Mono>` chips with only a title tooltip; no
description/source; unmapped keys showed an empty tooltip.
**After:** every code chip in the registry is a button; clicking opens a
popover (modal card, no navigation) showing the control title, its catalog
context (domain · subdomain, bilingual), and the source (framework short
name + discovered version + regulator + link to the official source
`nca.gov.sa` / `rulebook.sama.gov.sa`). A code with no entry in the loaded
catalogs shows an explicit amber "no mapping" state. Lookup logic is the
pure `lookupControl(key, rows)` in `api/_lib/grc.js`.
**Tests:** `test/lookup.test.mjs` — 4 pass ("3-2-1" → title/description/
source; SAMA dotted ids; no-match → null; empty rows safe).
**Manual script:** Evidence → click "3-2-1" chip (expect popover with title,
domain·subdomain, "NCA ECC ECC-2:2024 · National Cybersecurity Authority",
nca.gov.sa link) → click a chip for an unmapped code (expect "no mapping"
notice, nothing broken).

## 6. Evidence Registry — shareable external upload link

**Before:** feature absent; every endpoint required a session; no rate
limiting anywhere.
**After:**
- Tables `upload_tokens` (evidence_item_id, token_hash UNIQUE, created_by,
  created_at, expires_at, max_uses, used_count, status active/revoked) and
  `upload_audit` (token_id, uploader_name, ip, filename, size, at).
- Token: `randomBytes(32)` base64url; only its SHA-256 hash is stored; the
  raw value exists only in the URL (`/u/<token>`) and is shown once in the
  UI with a copy button.
- Generate/revoke/list: `/api/evidence?action=link-create|link-revoke|links`,
  all behind the new `shareEvidence` perm (admin/manager/assessor = 1,
  viewer = 0 — server-enforced; buttons hidden in UI). Expiry required,
  default 7 days, clamp 1–30; use limit default single-use, clamp 1–100.
- Public endpoint `/api/public-upload` (the only unauthenticated route):
  GET returns the target item's TITLE + limits only; POST validates files
  server-side (allow-list pdf/png/jpg/jpeg/zip/csv/log/txt; 4 MB/file and
  /submit; ≤3 files), then atomically consumes a use
  (`UPDATE … WHERE active AND expires_at>now() AND used_count<max_uses
  RETURNING` — race-safe), stores through the SAME path real evidence uses
  (AI analyze → `insertEvidence`; metadata-only fallback if analysis is
  unavailable so an upload is never lost), attaches to that exact item
  (`parent_id` + inherits its control links; request input can never
  redirect the target), and writes the mandatory `upload_audit` row. Errors
  are generic ("invalid, expired, or has been used") — no token echo, no
  internal ids, no stack traces. Per-IP (30/10 min) and per-token (10/h)
  in-memory rate limits (per serverless instance — best effort; the DB
  `used_count`/`max_uses` is the authoritative brake; noted here as the
  serverless trade-off).
- Public page `/u/<token>`: minimal, no login/registration/app shell —
  item title, optional name + note, file picker, submit; invalid/expired/
  used links get a clear red state. Registry panel lists links with
  status/expiry/uses-left/Revoke (emerald active; amber expired/used-up;
  red revoked — amber/red only as status).
**Tests:** `test/uploads.test.mjs` — 31 pass: hash-not-raw + tamper;
lifecycle (expired/revoked/used-up/single-use); scope guard (token for item
A rejected for B); file validation (bad type, double extension, oversize,
too many, size-vs-payload mismatch, allowed accepted); authorization
(admin/manager/assessor allowed, viewer denied); rate limiter; a
mock-storage end-to-end submit flow.
**Manual script:** as Assessor open Evidence → item "3-2-1 policy" → link
icon → Generate (expect one-time link + copy + expiry/uses) → open the link
in a logged-out/incognito window (expect title-only upload page) → upload a
PDF (expect success; item appears attached in registry with "External
upload" badge; `upload_audit` row exists) → open the same single-use link
again (expect invalid state) → Revoke another link and try it (expect
invalid) → tamper one character of a token (expect invalid) → as Viewer:
no link buttons, and direct POSTs to link-create/link-revoke return 403.

## 7. Corrective Action Plan / POA&M

**Before:** feature absent (only free-text owner/due on assessments).
**After:**
- Tables `corrective_actions` (exact spec model + `closure_requested`,
  `owner_name`/`created_by_name` denormalized for display, `archived`) and
  `corrective_action_audit` (action_id, field, old_v, new_v, by, at).
  "Overdue" derived (`due_date < now AND status != 'Closed'`), never stored.
- Domain rules in `api/_lib/poam.js` (pure, shared by the server route AND
  the React UI so buttons match server behavior): legal transition graph;
  Closed enter/leave = admin/manager only; closure requires ≥1 linked
  evidence AND a note; owner (any non-viewer) updates status/progress/
  evidence/closure-request on their own action but cannot close; assessor
  creates + updates own; viewer read-only; owner reassignment + archive =
  admin/manager. Every status/owner/due-date change emits audit rows with
  old + new (mandatory, tested).
- `/api/actions`: GET (actions + audit + minimal owner directory, one
  `Promise.all`), POST create (`poam` perm; assessor creations self-owned),
  PATCH (rules above), DELETE = archive (soft). No hard-delete —
  **flagged**: say so if wanted.
- UI: new "Corrective actions" nav for all roles; rollup (open count,
  overdue count, by-owner and by-framework bars reusing recharts); table
  filterable by owner/status/framework/overdue with amber due-soon/blocked,
  red overdue, emerald closed; detail drawer with role-gated fields,
  evidence link/unlink checklist, closure workflow (request → approve) and
  a timeline from audit rows; "Create corrective action" on gap/partial
  controls in the Control drawer, pre-linking that control.
**Tests:** `test/poam.test.mjs` — 33 pass: legal/illegal transitions;
closure guard (evidence AND note); per-role authorization for create/
assign/edit/close/archive; owner request-but-not-close; manager approval
sets closed_by/closed_at + audit; overdue derivation (past-due open →
overdue, past-due closed → not, archived → not, due-today → not);
due-soon window; audit rows carry old+new for status/owner/due-date and
nothing else; reopen clears closure fields.
**Manual script:** as Manager, open a gap control → "Create corrective
action" (expect control pre-linked) → assign owner + due date → as the
owner: move to In progress, tick an evidence item, write a note, "Request
closure" (expect no close button) → as Manager: "Approve & close" (expect
closed badge with closed_by/closed_at and timeline rows) → try closing
another action without evidence/note (expect rejection message) → set a due
date in the past on an open action (expect red Overdue) → as Viewer: page
renders, all controls read-only.

---

# Test results (full suite, `npm test`)

| File | Result |
|---|---|
| test/crypto.test.mjs (pre-existing) | 28 passed, 0 failed |
| test/grc.test.mjs (pre-existing; import path fixed) | 68 passed, 0 failed |
| test/markdown.test.mjs (new) | 12 passed, 0 failed |
| test/advisor-context.test.mjs (new) | 10 passed, 0 failed |
| test/users-auth.test.mjs (new) | 12 passed, 0 failed |
| test/lookup.test.mjs (new) | 4 passed, 0 failed |
| test/uploads.test.mjs (new) | 31 passed, 0 failed |
| test/poam.test.mjs (new) | 33 passed, 0 failed |
| **Total** | **198 passed, 0 failed** |

`node --check` clean on every file under `api/` and `scripts/`;
`vite build` succeeds; `schema.sql` verified against the db-init splitter
(23 statements, all CREATE/ALTER). Deploy note: run `npm run db:init` (or
apply `schema.sql`) before using the new features.

# Decisions defaulted (flag if you want them changed)

1. **Users hard vs soft delete:** soft (deactivate). Hard-delete not built.
2. **POA&M hard vs soft delete:** soft (`archived` flag). Hard-delete not built.
3. **Password reset method:** current-password required. Email-token path not
   built — the repo has no mail infrastructure.
4. **Upload link expiry default:** 7 days, settable 1–30 at generation.
5. **File-type allow-list:** pdf, png, jpg, jpeg, zip, csv, log, txt.
6. **Max file size:** 4 MB per file AND per submission (matches the app's
   existing 4 MB evidence cap and the 6 MB JSON body ceiling); max 3 files
   per submit.
7. **Single vs multi-use links:** default single-use; settable up to 100 uses.
8. **Revoking links created by others:** allowed for any Admin/Manager/
   Assessor (revocation is fail-safe; restricting it seemed wrong for an
   audit tool).
9. **POA&M priority set:** Low / Medium / High / Critical.
10. **Assessor as POA&M owner:** an assessor's creations are self-assigned
    (assessors cannot assign others; Admin/Manager can assign anyone,
    including assessors).
11. **Due-soon threshold:** fixed 7 days (`DUE_SOON_DAYS` in
    `api/_lib/poam.js`), not user-configurable.
12. **External uploads & file retention:** the platform never retains file
    bytes (pre-existing design). External uploads go through the same
    analyze-then-store-metadata path; if AI analysis is unavailable the
    upload is stored as a metadata row with the uploader's note, attached to
    the target item — it is never dropped.
13. **Rate limiting:** in-memory fixed-window per serverless instance
    (per-IP 30/10 min, per-token 10/h) + the DB-enforced use counter. A
    shared store (e.g. Upstash) was not added to avoid new dependencies.
14. **Advisor "Clear thread":** deletes that conversation's rows and starts
    a new conversation id (kept per user per device in localStorage).
15. **Palette:** new UI uses emerald `#168F5B` on white/off-white with
    amber/red strictly for status. Pre-existing screens keep the repo's
    original deep-green/brass theme — repainting them would have violated
    "touch only files needed for these seven items."
