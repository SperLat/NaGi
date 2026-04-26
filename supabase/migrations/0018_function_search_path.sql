-- Pin search_path on every SECURITY DEFINER function.
--
-- Supabase's database linter flags any function without an explicit
-- search_path as `function_search_path_mutable`. The hardening reason:
-- a SECURITY DEFINER function runs as the owner (typically postgres),
-- and if its search_path is dynamic, an attacker who can create
-- objects in a writable schema (commonly pg_temp) could shadow the
-- public schema and trick the function into calling their malicious
-- shadow function instead of the legitimate one.
--
-- Pinning to `public, pg_temp` (in that order) means: resolve everything
-- against the public schema first, fall back to pg_temp only for
-- intentional temporary objects. Closes the shadow-attack vector.
--
-- ALTER FUNCTION ... SET search_path doesn't change function bodies —
-- the linter warning goes away once the GUC is set on each function.

ALTER FUNCTION public.create_family_org(text, text)            SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_create_family_org_on_signup()       SET search_path = public, pg_temp;
ALTER FUNCTION public.add_elder_intermediary(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.list_elder_intermediaries(uuid)          SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_elder_intermediary(uuid)          SET search_path = public, pg_temp;
ALTER FUNCTION public.decline_elder_intermediary(uuid)         SET search_path = public, pg_temp;
ALTER FUNCTION public.list_my_pending_invitations()            SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_updated_at()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_member(uuid)                      SET search_path = public, pg_temp;
