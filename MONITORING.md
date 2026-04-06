# 📊 MONITORING GUIDE

## Available Metrics

### Production Layer
```js
// GET /api/v1/agent/metrics
{
  production: {
    cost: {
      totalCost: 0,
      computeCost: 0,
      apiCost: 0,
      avgCostPerGoal: 0
    },
    budget: {
      latency: { used, max, utilization },
      apiCalls: { used, max, utilization },
      computeTime: { used, max, utilization },
      cost: { used, max, utilization }
    },
    workers: {
      active: 0,
      queued: 0,
      completed: 0,
      failed: 0
    },
    observability: {
      totalTraces: 0,
      activeSpans: 0,
      auditLogSize: 0
    }
  },
  operational: {
    health: "healthy",
    circuitBreaker: {
      state: "closed",
      failures: 0,
      threshold: 5
    },
    retry: {
      total: 0,
      success: 0,
      failed: 0
    },
    queue: {
      size: 0,
      maxSize: 100
    }
  },
  resilience: {
    safeMode: false,
    isolation: {
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0
    },
    decisions: {
      total: 0,
      byType: {}
    }
  }
}
```

## Grafana Dashboard JSON (Save as dashboard.json)

```json
{
  "dashboard": {
    "title": "Autonomous Agent",
    "panels": [
      {
        "title": "Requests/sec",
        "targets": [
          { "expr": "rate(agent_requests_total[5m])" }
        ]
      },
      {
        "title": "Latency p95",
        "targets": [
          { "expr": "histogram_quantile(0.95, rate(agent_latency_bucket[5m]))" }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          { "expr": "rate(agent_errors_total[5m]) / rate(agent_requests_total[5m])" }
        ]
      },
      {
        "title": "Cost/Goal",
        "targets": [
          { "expr": "agent_cost_total / agent_goals_total" }
        ]
      },
      {
        "title": "Reuse Rate",
        "targets": [
          { "expr": "rate(agent_reuse_total[5m]) / rate(agent_goals_total[5m])" }
        ]
      },
      {
        "title": "Budget Utilization",
        "targets": [
          { "expr": "agent_budget_used / agent_budget_max" }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "targets": [
          { "expr": "agent_circuit_breaker_state" }
        ]
      }
    ]
  }
}
```

## Prometheus Metrics to Export

Add to `/metrics` endpoint:

```js
// Gauge metrics
agent_requests_total{status}
agent_latency_seconds{quantile}
agent_errors_total{type}
agent_cost_total
agent_goals_total
agent_reuse_total
agent_budget_used{type}
agent_circuit_breaker_state{state}
```

## Red Flags to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| Latency p95 | > 1s | > 5s |
| Reuse rate | < 0.3 | < 0.1 |
| Budget utilization | > 80% | > 95% |
| Circuit breaker | open | - |

## Environment Variables

```bash
# Production config
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
AUTH_ENABLED=true
API_KEY=your_key_here
```