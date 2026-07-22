# ADR-003: Use GitHub Pages as a dev-preview deployment, separate from the Cloudflare Pages production target

Date: 2026-07-22

## Status

Accepted

## Decision

Add a GitHub Actions workflow that builds the SPA with a `VITE_DEMO_MODE=true` flag and a `/DictaTube/` base path, and publishes it to GitHub Pages purely for visual verification during development. This does not change [ADR-001](001-cloudflare-pages-access-hosting-auth.md) or [ADR-002](002-d1-data-store.md): Cloudflare Pages + Access + D1 remains the only production target.

## Context

Development happens partly from a sandboxed environment that cannot authenticate to Cloudflare (no interactive browser to complete `wrangler login`'s OAuth callback). There was otherwise no way to see UI changes rendered without pushing to the owner's own machine first.

GitHub Pages is static-only: no server, no D1, no Cloudflare Access. `/api/*` calls have nothing to answer them there. Rather than letting every view 404 against a missing backend, the dev-preview build swaps in an in-memory mock dataset (`app/demoData.ts`) behind `import.meta.env.VITE_DEMO_MODE`, so the UI shell, layout, and navigation can be checked visually. This mock path never runs in the Cloudflare build (the env var is only set by the GitHub Pages workflow).

## Consequences

### Pros

- UI/layout changes are visible within a couple minutes of pushing, without needing Cloudflare credentials in this environment.
- No change to the production architecture or its auth/data model.

### Cons

- The preview cannot exercise anything backend-dependent: real caption import, D1-backed progress, or Cloudflare Access. It only proves the SPA renders and navigates correctly.
- Two build modes (`VITE_DEMO_MODE` on/off) mean the demo path can silently drift from real API behavior if `shared/types.ts` changes without updating `app/demoData.ts`.
- Requires a one-time manual step outside this repo: repository Settings → Pages → Build and deployment → Source = "GitHub Actions". No available tooling can flip this from here.
