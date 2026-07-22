# ADR-004: Move hosting from Cloudflare Pages Functions to Cloudflare Workers via `@cloudflare/vite-plugin`

Date: 2026-07-22

## Status

Accepted

## Decision

Replace the hand-rolled Cloudflare Pages + `functions/api/*.ts` backend with a single Cloudflare Worker (`worker/index.ts`), built and bundled by `@cloudflare/vite-plugin` alongside the existing Vite+Vue frontend. Deployment target becomes Cloudflare Workers with Workers Static Assets instead of Cloudflare Pages. `wrangler.toml` is replaced by `wrangler.jsonc`.

This does not change [ADR-001](001-cloudflare-pages-access-hosting-auth.md)'s reasoning for using Cloudflare + Access, nor [ADR-002](002-d1-data-store.md)'s reasoning for using D1 — only the specific product (Workers, not Pages) and the resulting code shape (one `fetch` handler, not per-route `PagesFunction<Env>` files).

Separately, `app/` was renamed to `src/` to match plain Vite's own convention (`npm create vite@latest` scaffolds `src/main.ts`), rather than staying with the non-standard bare `app/` at repo root.

## Context

While investigating how to bring this repo's directory layout in line with current standards, two things were checked and are worth recording:

- **`NCPD-Template-Child` does not use Nuxt.** Its `site-sample` is a plain Vite+Vue3 static site inside an AWS SAM/CloudFormation template. Its `src/app/` layout exists because `src/` there is a self-contained sub-package (own `package.json`/`vite.config.ts`) inside a multi-service AWS CDK monorepo — a concern this repo doesn't have, since this repo *is* the one Vite project. An earlier attempt to adopt Nuxt 4 on the mistaken assumption that Child already used it was abandoned mid-plan once this was found; Nuxt was not adopted.
- **Cloudflare's current guidance for new Vite-based full-stack projects has shifted.** Cloudflare's own messaging: "start with Workers" for new projects, with future feature investment going there; Pages remains supported but isn't where new capability lands. `@cloudflare/vite-plugin` (GA) is the supported way to get this without adopting a new framework: it's a plain Vite plugin that builds both the static client and a Worker from one Vite project, and `wrangler deploy` auto-detects the build output.

This preserves everything the previous setup already had — `vite-plus`/oxlint/oxfmt/vitest are completely unaffected, since the project is still a plain Vite project. Only the backend's shape and the deploy target change.

## What changed mechanically

- `functions/api/videos.ts`, `functions/api/videos/[id].ts`, `functions/api/videos/[id]/chunks.ts`, `functions/api/progress.ts`, `functions/types.ts` → `worker/index.ts` (one `fetch(request, env, ctx)` entry with manual routing) + `worker/routes/videos.ts` + `worker/routes/progress.ts`. Cloudflare Pages Functions' automatic file-based routing (`onRequestGet`/`onRequestPost` per file) doesn't exist for a plain Worker, so `worker/index.ts` routes by pathname/method itself.
- D1 access: `context.env.DB` (inside a `PagesFunction<Env>`) → plain `env.DB` (inside the Worker's `fetch` handler) — simpler, one less layer of indirection.
- Static assets: the Worker's `env.ASSETS.fetch(request)` serves `dist/client` for anything that doesn't match an `/api/*` route (configured via `wrangler.jsonc`'s `assets` block, binding name `ASSETS`).
- `vite build` now emits two things: `dist/client/` (static frontend, same as before) and `dist/dictatube/` (the bundled Worker + a generated `wrangler.json`). The GitHub Pages dev-preview workflow (ADR-003) only uploads `dist/client`.

## Consequences

### Pros

- Matches Cloudflare's current recommended path for new Vite projects — less likely to need another migration soon.
- D1 access and the overall backend code are simpler (no Pages-specific `PagesFunction<Env>` typing).
- No tooling lost: `vite-plus`, oxlint, oxfmt, and vitest all keep working exactly as before, since this is still a plain Vite project (unlike the abandoned Nuxt path, which would have required dropping `vite-plus` for Nuxt's own `nuxi` CLI).

### Cons

- Losing Pages Functions' automatic file-based routing means `worker/index.ts` has to route requests by hand; this is more code to maintain as routes grow, though trivial at today's 4 routes.
- Cloudflare Access still needs to be configured against the Worker's route (dashboard state, same caveat as ADR-001) — not yet verified end-to-end since Cloudflare login isn't available in this sandbox (see `CLAUDE.md` Gotchas).
- `*.workers.dev` (the free subdomain, no custom domain purchase needed) is assumed to work the same way ADR-001 assumed for `*.pages.dev` — not yet verified against a real deployment.
