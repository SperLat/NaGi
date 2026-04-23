# Security

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Email: security@cedar-project.org (placeholder — update before public launch)

We aim to respond within 72 hours.

## Key security properties

- All Anthropic API keys are held server-side in Supabase Edge Functions. They are never exposed to the mobile client.
- Row Level Security (RLS) is enforced on all tenant tables. `scripts/verify-rls.ts` runs in CI on every migration.
- Elder profiles are scoped to their organization. Cross-tenant access is blocked at the database layer.
- The mobile app never stores auth tokens in plaintext. Supabase Auth handles token lifecycle.

## Threat model

Full threat model in Step 11. Key assumptions:
- Self-hosters are responsible for their own `ANTHROPIC_API_KEY` and Supabase credentials.
- The mobile app is not a sensitive data store — activity logs are synced to server.
- Elder accounts in v0 do not have independent auth (Assumption §8 in ARCHITECTURE.md).
