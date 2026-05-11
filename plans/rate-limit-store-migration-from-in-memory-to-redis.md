---
id: 20260511T000100Z-rate-limit-redis-migrate
title: Rate-limit store migration from in-memory to Redis
status: refined
author: Jonathan Turnock
created: 2026-05-11
reviewed_by: Jonathan Turnock
---

## Summary

Move the rate-limit store from per-process in-memory state to a shared
Redis-backed counter. The current implementation can't enforce limits
across replicas; a single client distributed across pods gets effectively
N× the configured budget.

## Requirements

- Identical token-bucket semantics (refill rate, burst capacity) to the current limiter.
- Per-key TTL matches the current sliding window; no stale keys accumulate.
- Failure-open: if Redis is unreachable for >100ms, allow the request and emit a `rate_limit_redis_unavailable` metric.
- p99 added latency ≤ 5ms vs the in-memory implementation under nominal load.

## Technical Approach

- Replace the in-process Map with a Redis client wrapping `INCR` + `EXPIRE` via a Lua script (atomic per-key).
- Read `REDIS_URL` at boot; fail-open path triggers when client reports disconnect or a single call exceeds 100ms.
- Keep the limiter's public API unchanged so call sites need no edits.
- Add a Prometheus counter for `rate_limit_redis_unavailable` and a histogram for limiter latency.

## Affected Systems

- Rate-limit middleware (request path)
- Deployment / config layer (REDIS_URL)
- Metrics dashboards

## Acceptance Criteria

- Existing limiter unit tests pass unchanged against the Redis-backed implementation.
- A two-pod soak test holds aggregate rate under a configured limit (verifying cross-replica enforcement).
- Killing Redis mid-soak triggers fail-open within one second and the failure counter increments.
- Limiter p99 latency under nominal load stays within 5ms of the current baseline.

## Risks & Considerations

- Lua script must be `EVALSHA`-cached or steady-state overhead climbs sharply.
- Failure-open is a deliberate availability trade-off — flag it explicitly in the runbook.

## Open Questions

- Shadow-mode period before cutover: yes (one release) — write to Redis but decide via in-memory, compare results in metrics. Hard-cut next release if shadow allow/deny matches in-memory within 0.01%.
