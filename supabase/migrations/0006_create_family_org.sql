-- Atomic org creation for sign-up flow.
-- SECURITY DEFINER bypasses the bootstrap RLS catch-22:
-- org_members INSERT policy requires caller to already be an owner.
CREATE OR REPLACE FUNCTION create_family_org(
  org_name text,
  org_slug text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO organizations (slug, name, kind, created_by)
  VALUES (org_slug, org_name, 'family', auth.uid())
  RETURNING id INTO new_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');

  RETURN new_org_id;
END;
$$;
