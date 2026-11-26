# JAUT admin production source rules

These rules apply to this entire repository, on every computer and in every Codex session.

## Before editing

1. Read the `현재 운영 기준` section at the top of `README.md`.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/sync-main.ps1`.
3. If the script reports uncommitted work, stop. Preserve the user's changes and resolve them before switching branches or pulling.
4. Make changes only from an up-to-date local `main`, unless the user explicitly requests an isolated feature branch.

## Production deployment

- GitHub `origin/main` is the only production source.
- Production deployment happens only through the Vercel Git integration after pushing `main`.
- Never run `vercel --prod`, `vercel deploy --prod`, `vercel promote`, or deploy an uncommitted working tree.
- Never deploy from a backup, `agent/*`, or `codex/*` branch.
- After deployment, confirm that Vercel's production deployment SHA equals `git rev-parse origin/main`.
- Do not move the production alias to an older deployment unless the user explicitly requests a rollback.

The `prebuild` guard in `scripts/assert-production-source.mjs` intentionally rejects Vercel production builds that are not GitHub deployments from `main`.
Vercel's project-level Ignored Build Step also requires a Git clone (`.git`), GitHub provider, and `main` ref for production. This is an external safety gate that still applies when an old checkout does not contain the repository guard script. Do not remove or weaken it.

## Product invariants

- Admin branding is `JAUT 매체연기` / `매체연기 어드민`.
- Admin login exposes Google login only. Do not restore a password form.
- `/admin` leads to the media-acting student management flow at `/admin/coaching`.
- Homepage daily visit totals appear in `/admin/inquiries`.

## Recovery and cleanup

- Mark confirmed production snapshots with `admin-final-YYYY-MM-DD` tags.
- Preserve obsolete branch tips as `archive/*` tags before deleting the branches.
- Never rewrite or force-push `main` history.
