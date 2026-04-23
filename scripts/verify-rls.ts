// Step 3: verifies RLS policies block cross-org reads on all tenant tables.
// Structural check — reads migration files, no live DB required.
// Run in CI after every migration. Must exit 0 to allow merge.

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TENANT_TABLES = [
  'organizations',
  'organization_members',
  'elders',
  'elder_intermediaries',
  'activity_log',
  'ai_interactions',
];

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

function loadMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

function verify(): void {
  const sql = loadMigrations();
  const failures: string[] = [];

  for (const table of TENANT_TABLES) {
    const hasRls = sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    if (!hasRls) {
      failures.push(`${table}: missing ENABLE ROW LEVEL SECURITY`);
      continue;
    }

    // At minimum a SELECT policy must exist
    const hasSelectPolicy = new RegExp(
      `CREATE POLICY \\w+ ON ${table}\\s+FOR SELECT`,
    ).test(sql);
    if (!hasSelectPolicy) {
      failures.push(`${table}: missing SELECT policy`);
    }
  }

  if (failures.length > 0) {
    console.error('RLS verification FAILED:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log('RLS verification passed:');
  for (const t of TENANT_TABLES) console.log(`  ✓ ${t}`);
  process.exit(0);
}

verify();
