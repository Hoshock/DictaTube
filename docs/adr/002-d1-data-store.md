# ADR-002: Store application data in Cloudflare D1 instead of the GitHub repository

Date: 2026-07-22

## Status

Accepted

## Decision

Videos, chunks, and study progress live in Cloudflare D1; the GitHub repository holds source code only. This withdraws the project's original requirement of persisting data as JSON files committed to the repo.

## Context

The original design committed `data/*.json` through the Contents API so GitHub Pages could serve it. With hosting on Cloudflare ([ADR-001](001-cloudflare-pages-access-hosting-auth.md)), serving is no longer a constraint — but writing to the repo from Pages Functions would still require a GitHub credential: a fine-grained PAT or a GitHub App private key. The owner explicitly refused to create a PAT, and a GitHub App is heavier to set up and rotate than this problem justifies.

Two further pressures pointed the same way:

- Progress updates are frequent small writes. Commit-per-save means a sha-fetch/PUT round-trip per save and a noisy commit history.
- The repo is public, so transcripts and study progress would be public too.

D1's free tier (5M row reads/day, 100k writes/day) exceeds single-user needs by orders of magnitude, and Time Travel provides 30-day point-in-time restore.

## Consequences

### Pros

- No GitHub credentials exist anywhere in the system.
- Functions code shrinks to plain SQL; no Contents API sha handling.
- Study data is fully private despite the public repo, and writes are low-latency.

### Cons

- Data is no longer versioned in git next to the code; diff/history visibility for data changes is lost.
- Data lives in the Cloudflare account; backup beyond Time Travel needs an explicit `wrangler d1 export` habit or a scheduled export.
- Local development depends on wrangler's D1 emulation matching production behavior.
