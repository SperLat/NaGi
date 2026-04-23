// Populates a real Supabase instance with a demo-ready family org for the
// hackathon demo path. Safe to re-run (all upserts).
//
// Usage:
//   SUPABASE_URL=https://... SERVICE_ROLE_KEY=... pnpm tsx scripts/seed-mock.ts
//   — or —
//   (will auto-load deploy/.env if the env vars are not set)

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ─────────────────────────────────────────────────────────────────

function loadEnvFile(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

const envFile = loadEnvFile(join(__dirname, '..', 'deploy', '.env'));

function env(key: string): string {
  return process.env[key] ?? envFile[key] ?? '';
}

const SUPABASE_URL = env('SUPABASE_URL').replace('http://kong:8000', 'http://localhost:8000');
const SERVICE_ROLE_KEY = env('SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SERVICE_ROLE_KEY');
  console.error('Set them directly or populate deploy/.env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_EMAIL = 'demo@cedar.dev';
const DEMO_PASSWORD = 'nagidemo2026';

const DEMO_ORG = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Familia Demo',
  slug: 'familia-demo',
  kind: 'family',
};

const DEMO_ELDER = {
  id: 'b0000000-0000-0000-0000-000000000001',
  organization_id: DEMO_ORG.id,
  display_name: 'Abuela Rosa',
  preferred_lang: 'es',
  profile: {
    bio: 'Profesora jubilada. Le gusta el jardín y las telenovelas.',
    interests: ['jardinería', 'familia', 'telenovelas'],
    common_tasks: ['llamar familia', 'ver el clima'],
  },
  profile_version: 1,
  ui_config: {
    home_cards: ['call_family', 'get_help', 'my_day', 'one_task'],
    offline_message: 'Estoy aquí contigo. Llama a tu hija si necesitas ayuda.',
    text_size: 'xl',
    high_contrast: false,
    voice_input: true,
  },
  status: 'active',
};

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const start = Date.now();
  console.log(`Seeding demo data → ${SUPABASE_URL}\n`);

  // 1. Create/retrieve demo user
  let userId: string;
  const { data: existingUsers } = await db.auth.admin.listUsers();
  const existing = existingUsers?.users.find(u => u.email === DEMO_EMAIL);

  if (existing) {
    userId = existing.id;
    console.log(`  ✓ user already exists   (${DEMO_EMAIL})`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create user: ${error?.message}`);
    }
    userId = data.user.id;
    console.log(`  ✓ created user          (${DEMO_EMAIL})`);
  }

  // 2. Upsert organization
  const { error: orgErr } = await db
    .from('organizations')
    .upsert({ ...DEMO_ORG, created_by: userId, created_at: new Date().toISOString() }, { onConflict: 'id' });
  if (orgErr) throw new Error(`Failed to upsert org: ${orgErr.message}`);
  console.log(`  ✓ organization          (${DEMO_ORG.name})`);

  // 3. Upsert org membership
  const { error: memberErr } = await db.from('organization_members').upsert(
    {
      organization_id: DEMO_ORG.id,
      user_id: userId,
      role: 'owner',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,user_id' },
  );
  if (memberErr) throw new Error(`Failed to upsert member: ${memberErr.message}`);
  console.log(`  ✓ org membership        (owner)`);

  // 4. Upsert elder
  const { error: elderErr } = await db.from('elders').upsert(
    {
      ...DEMO_ELDER,
      profile: JSON.stringify(DEMO_ELDER.profile),
      ui_config: JSON.stringify(DEMO_ELDER.ui_config),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (elderErr) throw new Error(`Failed to upsert elder: ${elderErr.message}`);
  console.log(`  ✓ elder                 (${DEMO_ELDER.display_name})`);

  // 5. Upsert elder_intermediary link
  const { error: linkErr } = await db.from('elder_intermediaries').upsert(
    {
      elder_id: DEMO_ELDER.id,
      user_id: userId,
      relation: 'hija',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'elder_id,user_id' },
  );
  if (linkErr) throw new Error(`Failed to upsert elder link: ${linkErr.message}`);
  console.log(`  ✓ elder → intermediary  (hija)\n`);

  const elapsed = Date.now() - start;
  console.log('Demo environment ready ─────────────────────────');
  console.log(`  URL:      ${SUPABASE_URL}`);
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Org ID:   ${DEMO_ORG.id}`);
  console.log(`  Elder ID: ${DEMO_ELDER.id}`);
  console.log(`─────────────────────────────────────────────────`);
  console.log(`  Done in ${elapsed}ms`);
}

seed().catch(err => {
  console.error('Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
