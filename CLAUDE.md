# DictaTube

Personal YouTube-dictation study app (single user). See [README.md](./README.md) for what it does and [docs/design.md](./docs/design.md) / [docs/adr/](./docs/adr/index.md) for the design record.

## Commands

```bash
pnpm install
pnpm test         # vitest — shared/chunker.ts only today
pnpm type-check    # vue-tsc for app/, tsc for functions/ (two separate tsconfigs, one command)
pnpm lint          # vp lint . --fix — see Gotchas before trusting --fix blindly
pnpm format        # vp fmt .
pnpm build         # vite build; add VITE_DEMO_MODE=true VITE_BASE_PATH=/DictaTube/ to reproduce the GitHub Pages build locally
pnpm dev           # vite dev server
```

## Directory Structure

```
.
├── app/                    # SPA (Vue 3 + TS), served by Cloudflare Pages in prod
│   ├── views/              # kebab-case filenames — see Code Style
│   ├── demo-data.ts        # mock Video/Chunk data, used only when VITE_DEMO_MODE=true
│   └── youtube-iframe-api.ts  # loads the YouTube IFrame Player <script> once, globally
├── functions/api/           # Cloudflare Pages Functions — one file per route, PagesFunction<Env>
├── shared/                  # chunker.ts + types.ts, imported by both app/ and functions/
├── db/schema.sql             # D1 schema (videos/chunks/progress); no migration tool yet
├── docs/design.md            # architecture + status, in Japanese
├── docs/adr/                 # one ADR per architectural decision, in English
└── .github/workflows/gh-pages.yml  # dev-preview deploy only — not the production path
```

## Key Files

- Change how captions are split into chunks: `shared/chunker.ts` (`parseJson3Captions`, `chunkWords`) — shared by the SPA and Functions, keep it that way rather than duplicating logic.
- Add an API route: `functions/api/**.ts`, export `onRequestGet`/`onRequestPost` typed `PagesFunction<Env>` (`functions/types.ts`), query `context.env.DB` (D1) directly with `db/schema.sql`'s column names (snake_case in SQL, mapped to camelCase `shared/types.ts` shapes in the handler).
- Add a dynamic Cloudflare Functions route: name the bracket segment a single lowercase word, e.g. `[id].ts` — see Code Style.
- Chunk-loop playback: `app/views/player-view.vue` + `app/youtube-iframe-api.ts`. Playback must only ever start from a user tap (`playCurrentChunk`), never automatically — mobile browsers block autoplay otherwise.

## Code Style

- User-facing docs (`README.md`, `docs/design.md`) and commit messages are Japanese; ADRs (`docs/adr/`) and this file are English; code identifiers are always English.
- Vue SFC and `app/`-level `.ts` filenames are kebab-case (`home-view.vue`, not `HomeView.vue`) — enforced by `unicorn/filename-case`.
- Cloudflare Functions dynamic-route filenames (`functions/api/videos/[id].ts`) use a single lowercase word inside the brackets so the same `filename-case` rule doesn't need a per-file exception.
- No `null` and no bare `undefined` identifier in expressions (`unicorn/no-null`, `eslint/no-undefined`, both `error`). Represent "no value yet" with an uninitialized `let x: T | undefined` (see Gotchas) and check truthiness (`if (x)`), not `=== undefined`/`=== null`.
- No ternaries, no optional chaining (`?.`), functions capped at 10 statements and 3 params — write `if`/`else` with early returns and small named helpers instead. No magic numbers, including `0`/`1`/`-1` — name them even when the name feels redundant.

## Tech Stack

- Frontend: Vue 3 + TypeScript + Tailwind 4, built with `vite-plus` (the `vp` CLI wraps Vite, oxlint, and oxfmt) + pnpm. Mirrors `NCPD-Template-Child`'s `site-sample` layout.
- Backend (prod only): Cloudflare Pages Functions + D1. GitHub repo holds source only, no data (`docs/adr/002`).
- Auth (prod only): Cloudflare Access + GitHub IdP, owner-only (`docs/adr/001`).
- Dev preview: GitHub Pages, mock data only, no backend (`docs/adr/003`).

## Testing

- `pnpm test` runs real `vitest` (not `vite-plus`'s own test runner — see Gotchas) against `shared/**/*.test.ts` only, via a standalone `vitest.config.ts`.
- No test currently exercises `functions/` or `app/`; `pnpm type-check` and a manual browser check are what's verified those so far.
- The chunker tests use synthetic word-timestamp fixtures, not real fetched YouTube captions (fetching real json3 captions is exactly what the still-unresolved step-0 spike would validate) — don't treat them as proof the real parser handles real caption quirks.

## Documentation Maintenance

- A change to the architecture, data model, or hosting/auth setup needs a new or updated ADR under `docs/adr/` plus a row in `docs/adr/index.md`, in the same change.
- `docs/design.md`'s セットアップ状況/実装ステップ sections describe what's actually done — update them whenever a step's status changes, don't let them go stale.
- `README.md`'s command list must match `package.json`'s `scripts` — update both together.

## Gotchas

- `vp lint . --fix` flip-flops forever on two rule pairs: `oxc/no-rest-spread-properties` ↔ `eslint/prefer-object-spread`, and `eslint/no-undefined` ↔ `unicorn/no-typeof-undefined`. `vite.config.ts`'s `lint.rules` disables the losing side of each pair; don't re-enable them without re-running `npx vp lint .` (no `--fix`) to confirm both sides don't still fire.
- `no-null` + `no-undefined` together make it impossible to *initialize* an optional local to "no value yet" without one of the banned literals. `init-declarations` is set to `"off"` in `vite.config.ts` specifically so `let x: T | undefined` (no initializer) is legal — don't turn it back on without solving that first.
- `vite-plus`'s bundled test runner (`@voidzero-dev/vite-plus-test`, exposed as `vp test`) crashes (`Cannot read properties of undefined`) when it loads `vite.config.ts`'s `defineConfig`. Real `vitest` + a separate plain `vitest.config.ts` sidesteps it; don't switch `pnpm test` back to `vp test` without confirming that's fixed upstream.
- GitHub Pages needs no manual repo setting — `actions/configure-pages` (in `gh-pages.yml`) calls the Pages API's `findOrCreatePagesSite` and enables the site itself on first run, given the workflow's `pages: write` permission.
- For ad-hoc browser verification in a sandbox with no real Chrome install, use `npx @playwright/cli` (bin `playwright-cli`, an interactive/scriptable session CLI — distinct from the `playwright` library) with a config pointing `browser.launchOptions.executablePath` at `/opt/pw-browsers/chromium` and `args: ["--no-sandbox"]`; the default `chrome` channel isn't installed.
- `wrangler login`'s OAuth flow needs a browser that can reach the CLI's local callback port — that never works from a remote/cloud sandbox. Real Cloudflare work (the step-0 Workers↔YouTube spike, D1, Access setup) has to happen from the owner's own machine.
