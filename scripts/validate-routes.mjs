import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Always resolve paths relative to the project root, not the cwd.
// This ensures the script works regardless of which directory it is run from.
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (file) => resolve(root, file);

const required = [
  'app/(public)/page.tsx',
  'app/(app)/assets/page.tsx',
  'app/(app)/customers/page.tsx',
  'app/(app)/dashboard/page.tsx',
  'app/(app)/search/page.tsx',
  'app/(app)/settings/page.tsx',
  'app/(app)/work-orders/page.tsx',
  'app/auth/callback/route.ts',
  'actions/assets.ts',
  'actions/customers.ts',
  'actions/settings.ts',
  'actions/work-orders.ts',
  'lib/auth/permissions.ts',
  'proxy.ts',
  'supabase/migrations/0001_foundation.sql',
  'supabase/migrations/0002_fix_company_member_rls.sql',
  'supabase/migrations/0003_phase1_core_business.sql',
  'supabase/migrations/0004_estimates_invoices.sql'
];

const missing = required.filter((file) => !existsSync(r(file)));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}

const loginPage = readFileSync(r('app/(public)/page.tsx'), 'utf8');
if (!loginPage.includes('AuthForm')) {
  console.error('Public homepage must render AuthForm only.');
  process.exit(1);
}

const proxy = readFileSync(r('proxy.ts'), 'utf8');
if (!proxy.includes('updateSession')) {
  console.error('proxy.ts must use Supabase session protection.');
  process.exit(1);
}

const phaseOneMigration = readFileSync(r('supabase/migrations/0003_phase1_core_business.sql'), 'utf8');
for (const token of ['customers', 'assets', 'work_orders', 'has_permission', 'search_company_records']) {
  if (!phaseOneMigration.includes(token)) {
    console.error(`Phase 1 migration is missing ${token}.`);
    process.exit(1);
  }
}

console.log('Route validation passed.');
