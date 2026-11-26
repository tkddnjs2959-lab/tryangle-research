const isProduction = process.env.VERCEL_ENV === 'production';

if (!isProduction) {
  console.log('[production-source] Non-production build: source guard skipped.');
  process.exit(0);
}

const expected = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_REPO_OWNER: 'tkddnjs2959-lab',
  VERCEL_GIT_REPO_SLUG: 'tryangle-research',
};

const errors = [];
for (const [name, value] of Object.entries(expected)) {
  if (process.env[name] !== value) {
    errors.push(`${name} must be ${JSON.stringify(value)} (received ${JSON.stringify(process.env[name] ?? '')})`);
  }
}

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
  errors.push('VERCEL_GIT_COMMIT_SHA must contain the 40-character GitHub commit SHA.');
}

if (errors.length > 0) {
  console.error('\n[production-source] BLOCKED: production builds must come from GitHub origin/main.');
  for (const error of errors) console.error(`- ${error}`);
  console.error('- Push the verified main branch and let the Vercel Git integration deploy it.\n');
  process.exit(1);
}

console.log(`[production-source] Approved GitHub main deployment: ${commitSha.slice(0, 7)}`);
