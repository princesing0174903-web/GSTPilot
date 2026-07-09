# GSTPilot Infinity™ — Enterprise Load Tests

k6 and Artillery configurations validating the platform at 4 enterprise scale
tiers (100K, 500K, 1M, 5M user-equivalent ramps).

## Files

| File | Tool | Description |
|------|------|-------------|
| `loadtest.k6.js` | [k6](https://k6.io) | 4-tier ramping-VU load test with thresholds |
| `loadtest.artillery.yml` | [Artillery](https://artillery.io) | Equivalent config in YAML |

## Quickstart

```bash
# k6 — run all 4 tiers sequentially
k6 run tests/load/loadtest.k6.js

# k6 — run a single tier
k6 run -e TARGET=1m tests/load/loadtest.k6.js

# k6 — point at staging
k6 run -e BASE_URL=https://staging.gstpilot.app tests/load/loadtest.k6.js

# Artillery — run all 4 phases
artillery run tests/load/loadtest.artillery.yml
```

## The 4 Tiers

| Tier | Peak concurrent VUs | What it validates |
|------|--------------------|--------------------|
| `100k` | 100  | **Pilot / smoke** — baseline latency under light load. p95 < 500 ms, p99 < 1500 ms. Validates that the platform compiles, boots, and serves all primary endpoints with realistic think-time. |
| `500k` | 500  | **Growth** — sustained mid-traffic. Validates that the Firestore connection pool, Next.js standalone server, and API routes hold up under 5× pilot load. p99 < 1500 ms. |
| `1m`   | 1000 | **Scale** — approaching peak. Validates that connection pooling, internal caching (60s analytics cache, 30s health cache), and rate-limit middleware behave correctly at 4-digit concurrency. p99 < 1500 ms. |
| `5m`   | 5000 | **Enterprise saturation** — stress tier. Validates graceful degradation under extreme load; used to find the saturation point and tune `apphosting.yaml` max-instances. p99 < 1500 ms is the target but the run is informational at this tier. |

## Endpoints Hit (weighted)

| Endpoint | Weight | Purpose |
|----------|--------|---------|
| `/`                  | 30 | Landing page (SSR / static) |
| `/api/health`        | 20 | Lightweight health probe |
| `/api/billing/plans` | 20 | Public plans catalog |
| `/api/dashboard`     | 30 | Authenticated dashboard (weight heavier) |

## Thresholds (k6)

```js
http_req_failed:                          rate < 0.01        // < 1% failures
http_req_duration{load:100k}:             p(95) < 500ms
http_req_duration{load:*}:                p(99) < 1500ms
```

## Ensure Block (Artillery)

```yaml
ensure:
  p99: 1500
  thresholds:
    - http.response_time.p99: 1500
    - http.codes.4xx: 1
```

## Interpreting Results

- **PASS**: All thresholds met → safe to roll forward to the next tier.
- **FAIL (latency)**: p95/p99 over budget → investigate slow API routes, missing
  Firestore indexes, or connection-pool exhaustion.
- **FAIL (error rate)**: > 1% non-2xx/3xx → investigate 429 (rate-limit) or 5xx
  (server crash). Check `/api/health/detailed` for sub-system status.

## CI Integration

The k6 script can be invoked from `.github/workflows/ci.yml` after a successful
build:

```yaml
- name: Smoke load test (100k tier only)
  run: k6 run -e TARGET=100k -e BASE_URL=http://localhost:3000 tests/load/loadtest.k6.js
```

The 500k / 1m / 5m tiers are reserved for pre-release soak tests on staging —
not run on every PR.
