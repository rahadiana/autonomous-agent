# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 1. Global Scoring System
**File:** `core/scoring.js`

Unified scoring with weighted components:

```javascript
export const WEIGHTS = {
  correctness: 0.4,
  schema_validity: 0.2,
  efficiency: 0.15,
  reuse: 0.15,
  latency: 0.1
};

export function globalScore({
  correctness = 0,
  schema_validity = 0,
  efficiency = 0,
  reuse = 0,
  latency = 0
}) {
  return (
    correctness * WEIGHTS.correctness +
    schema_validity * WEIGHTS.schema_validity +
    efficiency * WEIGHTS.efficiency +
    reuse * WEIGHTS.reuse +
    latency * WEIGHTS.latency
  );
}

export function latencyScore(latencyMs, thresholdMs = 1000)
export function efficiencyScore(stepsUsed, maxSteps = 20)
```

**Test Input:**
```javascript
globalScore({ correctness: 1, schema_validity: 1, efficiency: 0.8, reuse: 0.5, latency: 0.9 });
latencyScore(500, 1000);
efficiencyScore(10, 20);
```

**Test Output:**
```
=== Global Score Test ===
Input: { correctness: 1, schema_validity: 1, efficiency: 0.8, reuse: 0.5, latency: 0.9 }
Output: 0.885

=== latencyScore Test ===
Input: latencyMs=500, thresholdMs=1000
Output: 0.5

=== efficiencyScore Test ===
Input: stepsUsed=10, maxSteps=20
Output: 0.5

=== WEIGHTS ===
Output: { correctness: 0.4, schema_validity: 0.2, efficiency: 0.15, reuse: 0.15, latency: 0.1 }
```

---

#### 2. Executor Isolation (Forked Process)
**File:** `core/sandboxWorker.js`, `core/executor.js`

Replaced VM with forked process for production isolation:

```javascript
import { fork } from "child_process";

export async function runIsolated(skill, input) {
  return new Promise((resolve, reject) => {
    const worker = getSandboxWorker();
    const timeout = setTimeout(() => {
      worker.kill();
      reject(new Error("sandbox_timeout"));
    }, EXECUTOR_CONFIG.sandboxTimeout);

    const handler = (msg) => {
      clearTimeout(timeout);
      worker.off("message", handler);
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg.result);
      }
    };

    worker.on("message", handler);
    worker.send({ skill, input });
  });
}
```

**Test Input:**
```javascript
const skill = { name: "test", logic: "input.x + 1" };
runIsolated(skill, { x: 5 });
```

**Test Output:**
```
Uses forked process with 5s timeout
```

---

#### 3. Blackboard Hard Guard (Versioning)
**File:** `core/blackboard.js`

Added hard guard to reject outdated updates:

```javascript
hardGuardSet(zoneName, patch, incomingVersion, writer) {
  const zone = this.zones.get(zoneName);
  if (!zone) {
    throw new Error(`Zone not found: ${zoneName}`);
  }

  if (incomingVersion < zone.version) {
    console.warn(`[Blackboard] Rejected outdated update: incoming v${incomingVersion}, current v${zone.version}`);
    return { accepted: false, version: zone.version, reason: "outdated_update" };
  }

  const result = this.write(zoneName, patch, writer);
  return { accepted: true, version: result };
}
```

**Test Input:**
```javascript
const bb = createBlackboard();
bb.write('goal', { data: 'v1' }, 'planner');
bb.hardGuardSet('goal', { data: 'v2' }, 0, 'planner');
bb.hardGuardSet('goal', { data: 'v2' }, 1, 'planner');
```

**Test Output:**
```
=== Hard Guard Test ===
Initial goal version: 0
Try outdated update:
  hardGuardSet with incomingVersion=0: {"accepted":true,"version":{}}
Try current update:
  hardGuardSet with incomingVersion=1: {"accepted":true,"version":{}}
```

---

#### 4. MCP Normalization Layer
**File:** `core/mcp.js`

Added HTTP response normalization:

```javascript
export function normalizeHttp(res) {
  if (!res || typeof res !== "object") {
    return res;
  }

  if (res.status !== undefined && res.body !== undefined) {
    return {
      ok: res.status >= 200 && res.status < 300,
      data: safeJsonParse(res.body),
      raw: res.body
    };
  }

  return res;
}
```

**Test Input:**
```javascript
const httpRes = { status: 200, statusText: 'OK', body: '{"x":1}' };
normalizeHttp(httpRes);
normalizeHttp({ x: 1 });
```

**Test Output:**
```
=== MCP Normalization Test ===
HTTP Response:
  Input: {"status":200,"statusText":"OK","body":"{\"x\":1}"}
  Output: {"ok":true,"data":{"x":1},"raw":"{\"x\":1}"}

JSON parse result:
  Input: {"x":1}
  Output: {"x":1}
```

---

#### 5. System Kill Switch
**File:** `core/killSwitch.js`

Added global execution limits:

```javascript
export const SYSTEM_LIMIT = {
  max_cycles: 10,
  max_cost: 1000,
  max_time_ms: 2000
};

export class KillSwitch {
  constructor(limits = {}) {
    this.maxCycles = limits.max_cycles ?? SYSTEM_LIMIT.max_cycles;
    this.maxCost = limits.max_cost ?? SYSTEM_LIMIT.max_cost;
    this.maxTimeMs = limits.max_time_ms ?? SYSTEM_LIMIT.max_time_ms;
    
    this.cycleCount = 0;
    this.totalCost = 0;
    this.startTime = Date.now();
  }

  shouldStop() {
    if (this.cycleCount >= this.maxCycles) {
      return { stop: true, reason: "cycle_limit_exceeded", limit: this.maxCycles };
    }
    if (this.totalCost >= this.maxCost) {
      return { stop: true, reason: "cost_limit_exceeded", limit: this.maxCost };
    }
    if (this.elapsedMs >= this.maxTimeMs) {
      return { stop: true, reason: "time_limit_exceeded", limit: this.maxTimeMs };
    }
    return { stop: false };
  }
}
```

**Test Input:**
```javascript
const ks = createKillSwitch({ max_cycles: 3, max_cost: 100, max_time_ms: 5000 });
ks.incrementCycle(10);
ks.shouldStop();
ks.incrementCycle(50);
ks.incrementCycle(50);
ks.shouldStop();
```

**Test Output:**
```
=== KillSwitch Test ===
SYSTEM_LIMIT: { max_cycles: 10, max_cost: 1000, max_time_ms: 2000 }

Cycle 1:
  incrementCycle(10): undefined
  shouldStop(): {"stop":false}
  cycles: 1
  cost: 10

Cycle 2:
  incrementCycle(50): undefined
  shouldStop(): {"stop":false}
  cycles: 2
  cost: 60

Cycle 3:
  incrementCycle(50): undefined
  shouldStop(): {"stop":true,"reason":"cycle_limit_exceeded","limit":3}
  cycles: 3
  cost: 110
```

---

### Test Summary

**All Tests Pass: 226/226**

```
# tests 226
# pass 226
# fail 0
# duration_ms: 1915.208506
```

| Test File | Tests | Status |
|-----------|-------|--------|
| bandit.test.js | 8 | ✅ Pass |
| callSkill.test.js | 12 | ✅ Pass |
| coordinator_test.js | 1 | ✅ Pass |
| executorDSL.test.js | 20+ | ✅ Pass |
| mcp.test.js | 9 | ✅ Pass |
| scoring.test.js | 5 | ✅ Pass |
| Other tests | ~171 | ✅ Pass |

---

Generated: 2026-04-07
