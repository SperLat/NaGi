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
    updated_at       TEXT NOT NULL,
    kiosk_pin_hash   TEXT,
    kiosk_pin_salt   TEXT
  )
`;

// SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. The caller
// runs each statement in a try/catch so devices with the old elders
// table get the new columns added without erroring on a fresh install
// where they're already in CREATE_ELDERS.
export const ALTER_ELDERS_ADD_KIOSK_PIN_HASH =
  'ALTER TABLE elders ADD COLUMN kiosk_pin_hash TEXT';
export const ALTER_ELDERS_ADD_KIOSK_PIN_SALT =
  'ALTER TABLE elders ADD COLUMN kiosk_pin_salt TEXT';

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
    device_id        TEXT NOT NULL,
    is_private       INTEGER NOT NULL DEFAULT 0
  )
`;

// SQLite stores booleans as 0/1. Idempotent column add for older devices.
export const ALTER_ACTIVITY_LOG_ADD_IS_PRIVATE =
  'ALTER TABLE activity_log ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0';

// Sync bookkeeping
export const CREATE_SYNC_META = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  )
`;
