# ADR-005: Split dev-preview and production deploys by branch (`develop` → GitHub Pages, `main` → Cloudflare Workers)

Date: 2026-07-22

## Status

Accepted

## Decision

Introduce a `develop` branch as the integration branch for ongoing work. `gh-pages.yml` ([ADR-003](003-github-pages-dev-preview.md)) now triggers only on pushes to `develop`, not `main`. Add a new `deploy-production.yml` workflow that triggers on pushes to `main` and deploys the built Worker to Cloudflare Workers via [`cloudflare/wrangler-action@v3`](https://github.com/cloudflare/wrangler-action), authenticating with a `CLOUDFLARE_API_TOKEN` repository secret.

## Context

`gh-pages.yml` previously triggered on both `main` and `claude/**` — a workaround so this sandbox's own working branch (which can't run `wrangler login`) could still get a visual dev-preview build. That conflated "the branch dev-preview builds from" with "the branch production should build from," and there was no production deploy automation at all: `docs/design.md`'s architecture diagram showed "push で自動デプロイ" for Cloudflare, but this was aspirational — nothing in the repo actually did it.

`main` is now reserved for production. `develop` is the integration branch that ongoing feature work merges into; every push there refreshes the GitHub Pages dev-preview. This also drops the `claude/**` trigger entirely — a sandboxed working session should push to `develop` (or open a PR into it) like any other contributor, not rely on a special-cased branch pattern.

Deploying to Cloudflare from GitHub Actions is possible even though this sandbox cannot run `wrangler login`: `wrangler login`'s blocker is specifically its interactive OAuth callback, which needs a browser reachable from the machine running it. A GitHub Actions runner instead authenticates non-interactively via `CLOUDFLARE_API_TOKEN` (a scoped API token, not an OAuth session), which `wrangler-action` passes straight to `wrangler deploy`. `wrangler deploy` at the repo root picks up the top-level `wrangler.jsonc` (`main: ./worker/index.ts`, the `assets` block) and re-bundles from source — this is the same mechanism [ADR-004](004-cloudflare-workers-vite-plugin.md) already relied on ("`wrangler deploy` auto-detects the build output").

## Consequences

### Pros

- Dev-preview and production deploys are triggered by distinct, unambiguous branches; no more special-casing a sandbox session's working branch in a shared workflow file.
- Production deploy is now automated in principle — once the setup steps below are done, a `main` push deploys with no manual `wrangler` invocation needed.

### Cons — setup steps this ADR does not complete

This workflow **cannot succeed yet**. Two manual, one-time steps remain, neither of which this sandbox can perform:

- `CLOUDFLARE_API_TOKEN` must be added under the repo's Settings → Secrets and variables → Actions. Without it, `wrangler-action` has no credentials.
- `wrangler.jsonc`'s `d1_databases[0].database_id` is still the placeholder `REPLACE_WITH_D1_DATABASE_ID` — no real D1 database has been created yet (`wrangler d1 create` also needs an authenticated `wrangler`, i.e. the owner's own machine). `wrangler deploy` will fail validation against a placeholder ID.

Until both are done, pushes to `main` will show a failing `deploy-production.yml` run. This is expected, not a regression — see `docs/design.md`'s セットアップ状況 for current status.
