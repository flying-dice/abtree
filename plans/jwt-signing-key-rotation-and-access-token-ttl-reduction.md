---
id: 20260511T000300Z-jwt-rotate-key-shorten-ttl
title: JWT signing key rotation and access-token TTL reduction
status: refined
author: Jonathan Turnock
created: 2026-05-11
reviewed_by: Jonathan Turnock
---

## Summary

Rotate the JWT signing key and reduce access-token TTL from 1 hour to 15
minutes. The current long-lived tokens narrow our ability to revoke
compromised credentials quickly; rotation also addresses the standing
audit finding to rotate signing material at least quarterly.

## Requirements

- New signing key (RS256 or Ed25519, matching current alg) issued via the existing JWKS rotation tool.
- JWKS endpoint serves both the new key (active) and the previous key (verify-only) for a 24h grace window.
- Access tokens issued post-deploy carry `exp = iat + 15m`.
- Client refresh-token flow continues to work under the shorter access-token TTL; refresh latency p99 stays under current SLO.
- Rotation runbook updated and signed off by the codeowner before deploy.

## Technical Approach

- Pre-stage the new key in the JWKS rotation tool 48h before cutover; let it propagate to caches.
- At cutover, flip "active" pointer to the new key; keep the previous key in the JWKS for 24h verify-only.
- Update the token issuer's TTL constant from 3600 to 900 seconds.
- Add a metric for refresh-token call rate; alert if rate spikes >2x baseline (indicates clients not handling shorter TTL well).
- Tear down the old key from the JWKS exactly 24h after cutover.

## Affected Systems

- Auth service (token issue + verify)
- JWKS endpoint (cache TTL implications)
- All client SDKs that handle access-token refresh

## Acceptance Criteria

- Tokens issued post-deploy have `exp - iat == 900`.
- JWKS lists both new and old `kid` during the grace window; only new after 24h.
- Synthetic integration test: requests with valid old-key tokens continue to verify until expiry.
- Production 401 rate stays within ±10% of pre-deploy baseline for the first 24h.
- Refresh call rate is metered; alert configured and firing-tested.

## Risks & Considerations

- JWKS caching at clients can extend the effective grace window unpredictably — confirm worst-case cache TTL across SDKs before scheduling old-key removal.
- Misconfigured client retry can hammer the refresh endpoint when access TTL drops; rate-limit the refresh path and call out in the runbook.
- Codeowner sign-off on the runbook is a deploy gate, not a nice-to-have.

## Open Questions

- Per-client `exp` minimums: audit mobile/background-task callers for hourly-scheduled jobs. If any rely on `exp ≥ 1h`, decide per-client carve-out (audience-specific TTL) vs. blocking the global cut. Owner: auth + mobile teams, before cutover.
