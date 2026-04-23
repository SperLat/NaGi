// SQLite table definitions for the local device mirror.
// Matches the Supabase schema except JSON columns are stored as TEXT.

export const CREATE_ELDERS = `
  CREATE TABLE IF NOT EXISTS elders (
    id               TEXT PRIMARY KEY,
    organization_id  TEXT NOT NULL,
    display_name     TEXT NOT NULL,
    preferred_lang   TEXT NOT NULL DEFAULT 'es',
    profile          TEXT NOT NULL DEFAULT '{}',
    profile_version  INTEGER NOT NULL DEFAULT 1,
    ui_config        TEXT NOT NULL DEFAULT '{}',
    status           TEXT NOT NULL DEFAULT 'active',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  )
`;

export const CREATE_ORGANIZATION_MEMBERS = `
  CREATE TABLE IF NOT EXISTS organization_members (
    organization_id  TEXT NOT NULL,
    user_id          TEXT NOT NULL,
    role             TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    PRIMARY KEY (organization_id, user_id)
  )
`;

// Outbox table: device-only, never synced from server.
export const CREATE_OUTBOX = `
  CREATE TABLE IF NOT EXISTS outbox (
    id           TEXT PRIMARY KEY,
    table_name   TEXT NOT NULL,
    operation    TEXT NOT NULL,
    payload      TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    status       TEXT NOT NULL DEFAULT 'pending'
  )
`;

// Local mirror of append-only activity log (last 30 days)
export const CREATE_ACTIVITY_LOG = `
  CREATE TABLE IF NOT EXISTS activity_log (
    id               TEXT PRIMARY KEY,
    elder_id         TEXT NOT NULL,
    organization_id  TEXT NOT NULL,
    kind             TEXT NOT NULL,
    payload          TEXT NOT NULL,
    client_ts        TEXT NOT NULL,
    server_ts        TEXT,
    device_id        TEXT NOT NULL
  )
`;

// Sync bookkeeping
export const CREATE_SYNC_META = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  )
`;
