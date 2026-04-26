-- Make "delete user" in the Supabase dashboard work without manual SQL.
--
-- Several FKs to auth.users were created without ON DELETE behavior,
-- so deleting a user fails with "Database error deleting user" because
-- Postgres refuses to drop a row another row depends on.
--
-- Decision per FK:
--
--   organizations.created_by              -> CASCADE
--     The single-user-per-org assumption (each user gets a family org
--     auto-created on signup, per migration 0016). Deleting a user
--     deletes their org and everything in it. Multi-member orgs would
--     want SET NULL instead, but that's not the current model.
--
--   help_requests.acknowledged_by         -> SET NULL
--     The column is already nullable (pending requests have no
--     acknowledger). Preserve the help_request as an audit record
--     after the acknowledger is gone — just drop the attribution.
--
--   elder_team_messages.author_id         -> CASCADE
--     Messages from a deleted user go with them. Audit trail of who
--     said what isn't useful when the "who" no longer exists.
--
--   elder_notes.author_id                 -> CASCADE
--     Same reasoning as elder_team_messages.
--
-- The two FKs that already CASCADE properly (organization_members.user_id,
-- elder_intermediaries.user_id) are left untouched.

ALTER TABLE organizations
  DROP CONSTRAINT organizations_created_by_fkey,
  ADD  CONSTRAINT organizations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE help_requests
  DROP CONSTRAINT help_requests_acknowledged_by_fkey,
  ADD  CONSTRAINT help_requests_acknowledged_by_fkey
    FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE elder_team_messages
  DROP CONSTRAINT elder_team_messages_author_id_fkey,
  ADD  CONSTRAINT elder_team_messages_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE elder_notes
  DROP CONSTRAINT elder_notes_author_id_fkey,
  ADD  CONSTRAINT elder_notes_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
