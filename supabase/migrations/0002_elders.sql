-- Elder = beneficiary profile, configured by intermediaries
CREATE TABLE elders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name    text        NOT NULL,
  preferred_lang  text        NOT NULL DEFAULT 'es',
  profile         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  profile_version int         NOT NULL DEFAULT 1,
  ui_config       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Caregiving assignment: many intermediaries per elder
CREATE TABLE elder_intermediaries (
  elder_id   uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relation   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (elder_id, user_id)
);

-- Auto-bump updated_at on profile or ui_config changes
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER elders_updated_at
  BEFORE UPDATE ON elders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
