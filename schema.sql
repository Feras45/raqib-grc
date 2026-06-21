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

CREATE TABLE IF NOT EXISTS snapshots (
  id     BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  pct    INT NOT NULL,
  at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snap_org ON snapshots(org_id, at ASC);
