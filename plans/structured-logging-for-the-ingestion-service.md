---
id: 20260510T225800Z-structured-ingestion-logs-correlate
title: Structured logging for the ingestion service
status: refined
author: Jonathan Turnock
created: 2026-05-10
reviewed_by: Jonathan Turnock
---

## Summary

Add structured (JSON) logging across the ingestion service so request
traces correlate end-to-end in Grafana. Today's text lines block
single-trace pivoting through the dashboards.

## Requirements

- JSON lines with `timestamp` (ISO 8601), `level`, `trace_id`, `span_id`, `service`, `message`; extras under `attrs`.
- `trace_id` taken from inbound `traceparent` (W3C) when present, otherwise minted at entrypoint; propagated through every async boundary.
- `LOG_LEVEL` env var keeps controlling level filtering.
- No raw payloads, auth headers, or user-identifying strings in structured fields. Use `payload_hash` (sha256 short hex) instead.

## Technical Approach

- Logger wrapper serialises to JSON; reads `trace_id` from `AsyncLocalStorage`.
- HTTP / queue consumer entrypoints parse `traceparent` or mint a fresh id and store on the async context.
- Loki dashboard variable filters `{trace_id="$tid"}`; add "View trace" link to Tempo.
- Single-pass migration; no compatibility shim.

## Affected Systems

- Ingestion service (HTTP handlers, queue consumers, worker pool)
- Shared logging utility
- Grafana dashboards: ingestion-overview, request-latency

## Acceptance Criteria

- Integration test: synthetic request emits entrypoint + worker + retry lines with the same `trace_id`.
- Integration test: inbound `traceparent` is reused end-to-end.
- Grafana "Request trace" panel shows every line and links to Tempo.
- `bun test` passes; new logger has unit tests for parsing, propagation, redaction.
- Grep audit: zero remaining old-logger call sites.

## Risks & Considerations

- Log byte-volume roughly doubles; validate Loki retention budget.
- Bare `setImmediate`/`setTimeout` would drop trace_id; add a lint rule for the ingestion path.

## Open Questions

- Loki retention budget headroom — confirm with ops before merge; if no headroom, drop `attrs.payload_hash` from steady-state logs (keep on errors only).
