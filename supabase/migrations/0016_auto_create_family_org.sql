-- Auto-create the family organization when a user is provisioned.
--
-- The prior flow had the mobile client call create_family_org() RPC
-- immediately after auth.signUp(). That RPC reads auth.uid() — which
-- is NULL during the brief window between auth.users insert and the
-- client receiving its session JWT, especially when email confirmation
-- is enabled (the user has a row but no session yet, and any RPC they
-- can invoke runs as the anonymous role with auth.uid() = NULL).
--
-- The result: "null value in column created_by of relation organizations
-- violates not-null constraint" when signing up against a project with
-- email confirmation on.
--
-- Postgres trigger fixes the race entirely. It runs as the table owner
-- (auth.users insert handler), reads NEW.id directly, and never depends
-- on auth.uid() being populated. Works regardless of whether email
-- confirmation is on or off, web or native, fast or slow client.
--
-- Naming: the org's slug is derived from the email's local-part with a
-- short random suffix to avoid collisions. The display name defaults
-- to "<local>'s family" — caregivers can rename later via the
-- organization screen.

CREATE OR REPLACE FUNCTION auto_create_family_org_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  email_local text;
  base_slug   text;
  final_slug  text;
  new_org_id  uuid;
BEGIN
  -- Pull the local-part of the email for naming. Fallback for OAuth
  -- providers that don't surface email is the user's UUID prefix.
  email_local := split_part(NEW.email, '@', 1);
  IF email_local IS NULL OR email_local = '' THEN
    email_local := substr(NEW.id::text, 1, 8);
  END IF;

  -- Slug: lowercase, alphanumeric + hyphen, plus a 6-char random tail
  -- so two users named "carmen" don't collide. The slug is internal —
  -- the user-facing org name is the display name.
  base_slug := lower(regexp_replace(email_local, '[^a-zA-Z0-9]', '-', 'g'));
  final_slug := base_slug || '-' || substr(md5(NEW.id::text || clock_timestamp()::text), 1, 6);

  INSERT INTO public.organizations (slug, name, kind, created_by)
  VALUES (final_slug, email_local || '''s family', 'family', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- One trigger per inserted user. AFTER INSERT so the auth.users row is
-- committed before we reference its id. We don't fire on UPDATE — orgs
-- are created once and only once per user.
DROP TRIGGER IF EXISTS auto_create_family_org_trigger ON auth.users;
CREATE TRIGGER auto_create_family_org_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_family_org_on_signup();

-- ── One-time backfill ─────────────────────────────────────────────
-- Heals orphan auth.users rows from the broken signup window: users
-- who got an auth.users row but whose org never landed because the
-- pre-trigger flow tried to call create_family_org() with a null
-- auth.uid(). Creates an org per orphan exactly the way the trigger
-- would have. Idempotent: re-running the migration after orphans are
-- gone is a no-op.
DO $$
DECLARE
  orphan record;
  email_local text;
  base_slug   text;
  final_slug  text;
  new_org_id  uuid;
BEGIN
  FOR orphan IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.organization_members m ON m.user_id = u.id
    WHERE m.user_id IS NULL
  LOOP
    email_local := split_part(orphan.email, '@', 1);
    IF email_local IS NULL OR email_local = '' THEN
      email_local := substr(orphan.id::text, 1, 8);
    END IF;
    base_slug := lower(regexp_replace(email_local, '[^a-zA-Z0-9]', '-', 'g'));
    final_slug := base_slug || '-' || substr(md5(orphan.id::text || clock_timestamp()::text), 1, 6);

    INSERT INTO public.organizations (slug, name, kind, created_by)
    VALUES (final_slug, email_local || '''s family', 'family', orphan.id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, orphan.id, 'owner');
  END LOOP;
END $$;
