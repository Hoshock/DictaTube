# ADR-001: Host on Cloudflare Pages with Cloudflare Access for authentication

Date: 2026-07-22

## Status

Accepted

## Decision

Host the SPA and its API on Cloudflare Pages (+ Pages Functions) and gate the entire app with Cloudflare Access using GitHub as the identity provider, allowing only the owner's account — instead of the originally planned GitHub Pages with tokens handled in the browser.

## Context

Single-user study app, used mainly from a phone. The owner requires a real GitHub sign-in ("only my GitHub account can use this") rather than manually managed tokens.

A pure static site cannot complete GitHub OAuth: the token exchange requires a client secret, and github.com's OAuth endpoints send no CORS headers (verified 2026-07; the PKCE support GitHub added in 2025-07 still requires the secret). Any real login therefore needs a server-side component somewhere.

Alternatives rejected:

- **GitHub Pages + fine-grained PAT pasted into each device**: works technically, but the owner refused to create and manage PATs, and it leaves a long-lived write token in every browser's localStorage.
- **GitHub Pages + custom OAuth broker Worker**: requires a Cloudflare account anyway, plus session code that Cloudflare Access provides for free.
- **Import-only queue via a Mac daemon to avoid all of this**: rejected by the owner as clunky for phone-first usage.

Cloudflare Access (Zero Trust free tier, up to 50 users) provides the hosted login, the GitHub IdP connection, and the allow-list policy with zero auth code, and Pages can enable Access on the pages.dev domain without buying a custom domain.

## Consequences

### Pros

- No auth code and no tokens in the browser; credentials and API secrets live server-side in Cloudflare.
- The whole app, static assets included, is private to the owner and works from any device.
- Pages Functions give a server-side execution place for GitHub-independent concerns (D1 access, YouTube caption fetching).

### Cons

- Hosting leaves GitHub Pages; availability now depends on the Cloudflare account.
- The Access policy and IdP connection are dashboard state, not code in this repo. Reproducing the setup requires manual steps (accepted for now; Terraform can be added later if this grows).
- Auth is coupled to Cloudflare — moving hosts later means redesigning login.
