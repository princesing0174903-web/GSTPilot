// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — k6 Enterprise Load Test
//
// 4 user-equivalent tiers (ramping VUs over 5 min each, sequential):
//   • 100k  — pilot tier (≈100 concurrent users, validates baseline latency)
//   • 500k  — growth tier (≈500 concurrent users, validates p95 latency)
//   • 1m    — scale tier (≈1k concurrent users, validates p99 latency)
//   • 5m    — enterprise tier (≈5k concurrent users, validates saturation)
//
// Usage:
//   k6 run tests/load/loadtest.k6.js
//   k6 run -e TARGET=100k tests/load/loadtest.k6.js          # run only one tier
//   k6 run -e BASE_URL=http://staging:3000 tests/load/loadtest.k6.js
//
// Thresholds (fail the run if violated):
//   • http_req_failed < 1%
//   • p95 (100k tier)  < 500 ms
//   • p99 (any tier)    < 1500 ms
// ═══════════════════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Tier definitions: each tier ramps to a peak concurrent-VU count over 5 min
// (3 min ramp-up + 2 min steady), then ramps down to 0 over 30s.
const TIERS = {
  '100k': { peak: 100,  tag: '100k' },
  '500k': { peak: 500,  tag: '500k' },
  '1m':   { peak: 1000, tag: '1m' },
  '5m':   { peak: 5000, tag: '5m' },
};

const requested = (__ENV.TARGET || '').toLowerCase();
const selectedTiers = requested && TIERS[requested]
  ? [requested]
  : Object.keys(TIERS);

// Build the scenarios object dynamically so `k6 run -e TARGET=1m` runs only 1m.
const scenarios = {};
for (const key of selectedTiers) {
  const t = TIERS[key];
  scenarios[key] = {
    executor: 'ramping-vus',
    exec: 'default',
    startTime: (() => {
      // Sequential offset: each prior tier was 5.5 min long.
      const idx = Object.keys(TIERS).indexOf(key);
      return `${idx * 330}s`;
    })(),
    stages: [
      { duration: '3m', target: t.peak },     // ramp-up
      { duration: '2m', target: t.peak },     // steady
      { duration: '30s', target: 0 },          // ramp-down
    ],
    gracefulRampDown: '15s',
    tags: { load: t.tag },
    env: { K6_TIER: t.tag },
  };
}

export const options = {
  scenarios,
  thresholds: {
    // Tier-agnostic baseline: failure rate must stay under 1%.
    'http_req_failed': ['rate<0.01'],
    // Per-tier p95 / p99 latency budgets.
    'http_req_duration{load:100k}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{load:500k}': ['p(99)<1500'],
    'http_req_duration{load:1m}':   ['p(99)<1500'],
    'http_req_duration{load:5m}':   ['p(99)<1500'],
  },
};

const ENDPOINTS = [
  { path: '/',                 weight: 30 },
  { path: '/api/health',       weight: 20 },
  { path: '/api/billing/plans', weight: 20 },
  { path: '/api/dashboard',    weight: 30 },  // weighted heavier
];
const TOTAL_WEIGHT = ENDPOINTS.reduce((s, e) => s + e.weight, 0);

function pickEndpoint() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const e of ENDPOINTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return ENDPOINTS[0];
}

export default function () {
  const tier = (__ENV.K6_TIER || 'unknown');
  const ep = pickEndpoint();
  const url = `${BASE_URL}${ep.path}`;
  const params = {
    tags: { load: tier, endpoint: ep.path },
    headers: { 'User-Agent': 'k6/gstpilot-loadtest' },
    timeout: '30s',
  };
  const res = http.get(url, params);

  check(res, {
    'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
  }, { load: tier });

  // Small think-time between requests to model human pacing.
  sleep(0.2 + Math.random() * 0.3);
}

// Cleanup hook — k6 will print final threshold results automatically.
export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      tiers: selectedTiers,
      metrics: {
        http_req_failed: data.metrics.http_req_failed,
        http_req_duration: data.metrics.http_req_duration,
      },
    }, null, 2),
  };
}
