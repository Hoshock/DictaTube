# ADR Index

| ADR                                                    | Description                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [ADR-001](001-cloudflare-pages-access-hosting-auth.md) | Host on Cloudflare (see ADR-004 for Pages→Workers); auth via Cloudflare Access (GitHub IdP) |
| [ADR-002](002-d1-data-store.md)                        | Application data in Cloudflare D1; GitHub repo holds source code only                       |
| [ADR-003](003-github-pages-dev-preview.md)             | GitHub Pages as a dev-preview deployment, separate from Cloudflare production               |
| [ADR-004](004-cloudflare-workers-vite-plugin.md)       | Cloudflare Workers + `@cloudflare/vite-plugin` instead of Pages Functions                   |
| [ADR-005](005-develop-main-branch-deploy-split.md)     | `develop` branch → GitHub Pages dev-preview, `main` branch → Cloudflare Workers production  |
