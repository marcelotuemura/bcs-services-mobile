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
  'app/(app)/dashboard/page.tsx',
  'app/auth/callback/route.ts',
  'middleware.ts',
  'supabase/migrations/0001_foundation.sql',
  'supabase/migrations/0002_fix_company_member_rls.sql'
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

const middleware = readFileSync(r('middleware.ts'), 'utf8');
if (!middleware.includes('updateSession')) {
  console.error('middleware.ts must use Supabase session protection.');
  process.exit(1);
}

console.log('Route validation passed.');
