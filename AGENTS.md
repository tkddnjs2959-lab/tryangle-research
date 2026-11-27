# JAUT admin production source rules

These rules apply to this entire repository, on every computer and in every Codex session.

## Before editing

1. 작업을 시작할 때 GitHub에서 이 저장소의 `main` 최신 커밋 SHA를 직접 조회한다. 작업 문서와 수정할 파일은 그 SHA 기준으로 읽는다.
2. 기본 작업 방식은 GitHub에서 직접 수정하는 것이다. 기존 PC 폴더를 갱신하거나 이전 작업본을 가져올 필요가 없다. 빌드가 필요하면 같은 SHA의 깨끗한 임시 작업 공간이나 CI를 사용한다.
3. 변경은 확인한 SHA를 부모로 삼아 `main`에 반영한다. 강제 푸시를 사용하지 않는다. 다른 PC가 먼저 반영했다면 최신 파일을 다시 읽고 요청한 변경만 재적용한 뒤 검증한다.
4. 완료 시 GitHub `main`에서 변경과 커밋 SHA를 다시 확인한다. 운영 반영 여부는 Vercel 운영 배포의 상태와 SHA를 별도로 대조해 보고한다.

Read the current production section of `README.md` at that SHA. `scripts/sync-main.ps1` is optional for a dedicated clean local checkout.

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
