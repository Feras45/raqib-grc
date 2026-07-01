-- Raqib · Postgres schema (single org per deployment: org_id = 'default').
-- Apply: psql "$DATABASE_URL" -f schema.sql   (or: npm run db:init)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL DEFAULT 'default',
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','manager','assessor','viewer')),
  pw_hash       TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled   BOOLEAN NOT NULL DEFAULT false,
  mfa_secret    TEXT,            -- AES-256-GCM encrypted TOTP secret (enabled)
  mfa_pending   TEXT,            -- AES-256-GCM encrypted TOTP secret (enrolling)
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id        BIGSERIAL PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS settings (
  org_id    TEXT PRIMARY KEY DEFAULT 'default',
  frameworks JSONB NOT NULL DEFAULT '[]',
  org_name  TEXT DEFAULT '',
  lang      TEXT DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS catalogs (
  org_id    TEXT NOT NULL DEFAULT 'default',
  fw        TEXT NOT NULL,
  version   TEXT NOT NULL,
  source    TEXT,
  data      JSONB NOT NULL,        -- { domains: [...] }
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, fw)
);

CREATE TABLE IF NOT EXISTS assessments (
  org_id     TEXT NOT NULL DEFAULT 'default',
  key        TEXT NOT NULL,         -- "<fw>:<control_id>"
  status     TEXT NOT NULL DEFAULT 'unassessed',
  owner      TEXT,
  due        DATE,
  note       TEXT,
  maturity   INT,                   -- SAMA 0–5
  review     TEXT,                  -- pending | approved | rejected
  prev_s     TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

CREATE TABLE IF NOT EXISTS evidence (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL DEFAULT 'default',
  name       TEXT NOT NULL,
  file_type  TEXT,
  doc_type   TEXT,
  summary    TEXT,
  quality    TEXT,
  controls   JSONB NOT NULL DEFAULT '[]',
  size       INT DEFAULT 0,
  by_name    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON evidence(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit (
  id         BIGSERIAL PRIMARY KEY,
  org_id     TEXT NOT NULL DEFAULT 'default',
  key        TEXT,
  control_id TEXT,
  from_s     TEXT,
  to_s       TEXT,
  by_name    TEXT,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit(org_id, at DESC);

-- Advisor conversation memory: one row per turn; evidence uploaded in a chat
-- is stored as a reference row (role='evidence', evidence_id), never re-embedded.
CREATE TABLE IF NOT EXISTS advisor_messages (
  id              BIGSERIAL PRIMARY KEY,
  org_id          TEXT NOT NULL DEFAULT 'default',
  conversation_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','evidence')),
  content         TEXT NOT NULL DEFAULT '',
  evidence_id     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advmsg_conv ON advisor_messages(org_id, conversation_id, id);

-- External-upload share links: only a SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS upload_tokens (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL DEFAULT 'default',
  evidence_item_id TEXT NOT NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  max_uses         INT NOT NULL DEFAULT 1,
  used_count       INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked'))
);
CREATE INDEX IF NOT EXISTS idx_uptok_ev ON upload_tokens(org_id, evidence_item_id, created_at DESC);

-- Mandatory audit trail for external uploads.
CREATE TABLE IF NOT EXISTS upload_audit (
  id            BIGSERIAL PRIMARY KEY,
  org_id        TEXT NOT NULL DEFAULT 'default',
  token_id      TEXT NOT NULL,
  uploader_name TEXT,
  ip            TEXT,
  filename      TEXT,
  size          INT DEFAULT 0,
  at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_upaudit_org ON upload_audit(org_id, at DESC);

-- External uploads attach as evidence rows pointing at the target item.
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- Corrective actions (POA&M). "Overdue" is DERIVED (due_date < now AND
-- status != 'Closed'), never stored. No hard-delete: archived flag only.
CREATE TABLE IF NOT EXISTS corrective_actions (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL DEFAULT 'default',
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  linked_control_ids  JSONB NOT NULL DEFAULT '[]',
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]',
  owner_user_id       TEXT,
  owner_name          TEXT,
  created_by          TEXT,
  created_by_name     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date            DATE NOT NULL,
  priority            TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
  status              TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Blocked','Closed')),
  closure_requested   BOOLEAN NOT NULL DEFAULT false,
  closure_note        TEXT,
  closed_by           TEXT,
  closed_at           TIMESTAMPTZ,
  archived            BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ca_org ON corrective_actions(org_id, created_at DESC);

-- Mandatory POA&M audit: every status/owner/due-date change (who, old, new, when).
CREATE TABLE IF NOT EXISTS corrective_action_audit (
  id        BIGSERIAL PRIMARY KEY,
  org_id    TEXT NOT NULL DEFAULT 'default',
  action_id TEXT NOT NULL,
  field     TEXT NOT NULL,
  old_v     TEXT,
  new_v     TEXT,
  by_id     TEXT,
  by_name   TEXT,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_audit ON corrective_action_audit(org_id, action_id, at DESC);

CREATE TABLE IF NOT EXISTS snapshots (
  id     BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  pct    INT NOT NULL,
  at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snap_org ON snapshots(org_id, at ASC);
