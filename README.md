# Autonomous Agent Platform

A production-grade adaptive execution engine with cognitive architecture, capable of learning from execution history and optimizing response times through template reuse.

## 🚀 Overview

This is a self-contained autonomous agent system that can:
- Understand natural language goals (math operations)
- Plan and execute actions using skills
- Learn from execution history (episodic memory)
- Reuse successful execution plans (template abstraction)
- Operate with isolation and resilience guarantees

## 📦 Features

### Core Capabilities
- **Goal Classification**: Automatically detects operation type (add, multiply, sum, etc.)
- **Planning**: Tree search with capability-filtered skill selection
- **Execution**: Isolated skill execution with variable resolution
- **Learning**: Episode recording and template extraction
- **Template Reuse**: 97%+ reuse rate for repeated goals

### Cognitive Architecture
- **Blackboard**: Shared state across execution stages
- **Episodic Memory**: Stores execution episodes for learning
- **Template Abstraction**: Generalizes goals to reusable patterns
- **Meta-Reasoning**: Self-evaluation and adaptation

### Resilience & Reliability
- **Isolation**: Per-request VM-level isolation
- **Circuit Breaker**: Automatic failure protection
- **Rate Limiting**: API protection
- **Safe Mode**: Deterministic fallback

### Observability
- **Prometheus Metrics**: Full request/error/latency tracking
- **Grafana Dashboards**: Visual monitoring
- **Health Checks**: Container health monitoring
- **Tracing**: Request span tracking

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     REST API Layer                          │
│  /execute  /status  /health  /metrics  /reset              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AgentCoordinator                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Classifier│  │ Planner  │  │ Executor │  │ Learning │   │
│  │          │  │          │  │          │  │          │   │
│  │classify  │  │ tree     │  │ skill    │  │ episode  │   │
│  │GoalCapa- │  │ search   │  │ execution│  │ template │   │
│  │bility()  │  │          │  │          │  │ extraction│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│        │              │              │              │      │
│        └──────────────┴──────────────┴──────────────┘      │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              EpisodicMemory                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Episodes   │  │  Templates  │  │   Vector    │   │  │
│  │  │  (Map)      │  │  (Store)    │  │   Store     │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
autonomous_agent/
├── core/                      # Core agent modules
│   ├── coordinator.js         # Main orchestration
│   ├── planner.js             # Tree search planning
│   ├── executor.js            # Skill execution
│   ├── episodicMemory.js     # Learning & memory
│   ├── templateAbstraction.js # Template extraction
│   ├── blackboard.js          # Shared state
│   ├── reasoner.js            # Evaluation
│   ├── production.js          # Budget & cost control
│   ├── resilience.js          # Circuit breaker & isolation
│   ├── deployment.js          # API routes & metrics
│   └── ...
├── config/                    # Monitoring config
│   ├── prometheus.yml
│   ├── prometheus_alerts.yml
│   └── grafana_dashboard.json
├── server.js                  # Entry point
├── docker-compose.yml         # Deployment
├── Dockerfile
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Running Locally

```bash
# Install dependencies
npm install

# Start the server
npm start
```

### Running with Docker

```bash
# Build and start all services
docker-compose up -d --build
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| App | 3000 | Main API |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Dashboards (admin/admin) |

## 📡 API Endpoints

### Execute Goal

```bash
POST /api/v1/agent/execute
Content-Type: application/json

{"goal": "add 5 and 3"}
```

Response:
```json
{
  "success": true,
  "goal": "add 5 and 3",
  "result": {
    "results": [
      {
        "capability": "math.add",
        "success": true,
        "result": {"result": 8}
      }
    ]
  },
  "reused": true
}
```

### Get Status

```bash
GET /api/v1/agent/status
```

### Get Health

```bash
GET /api/v1/agent/health
```

### Get Metrics

```bash
GET /metrics           # Prometheus format
GET /api/v1/agent/metrics  # JSON format
```

### Reset Agent

```bash
POST /api/v1/agent/reset
```

## 🎯 Supported Operations

| Goal Pattern | Operation | Example |
|--------------|------------|---------|
| add X and Y | Addition | "add 5 and 3" → 8 |
| sum X and Y | Addition | "sum 10 and 20" → 30 |
| total of X and Y | Addition | "total of 7 and 8" → 15 |
| multiply X and Y | Multiplication | "multiply 3 and 4" → 12 |
| product of X and Y | Multiplication | "product of 5 and 6" → 30 |
| times X and Y | Multiplication | "times 7 and 8" → 56 |

## 📊 Monitoring

### Key Metrics

| Metric | Description |
|--------|-------------|
| `agent_requests_total` | Total requests processed |
| `agent_errors_total` | Total errors |
| `agent_latency_seconds_bucket` | Latency histogram |
| `agent_reuse_total` | Template reuse count |
| `agent_budget_used_cost` | Budget consumption |

### Grafana Dashboard

Import `config/grafana_dashboard.json` for:
- Request rate
- Error rate
- Latency p95
- Template reuse rate
- Budget usage

### Prometheus Alerts

| Alert | Condition |
|-------|------------|
| HighErrorRate | Error rate > 2% for 2m |
| HighLatencyP95 | p95 latency > 2s for 3m |
| LowReuseRate | Reuse rate < 30% for 10m |
| HighBudgetUsage | Budget > 90% |

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Features
FEATURES_METAREASONING=true
FEATURES_AUTONOMY=false
```

### Coordinator Options

```javascript
createAgentCoordinator({
  maxIterations: 3,
  learningEnabled: true,
  autonomyEnabled: false,
  reuseThreshold: 0.5,
  maxCost: 1000,
  maxLatency: 30000
})
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run demo
npm run demo
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| Success Rate | 100% |
| Error Rate | 0% |
| Template Reuse | 97%+ |
| Avg Latency | <5ms |
| Throughput | ~100 req/s |

## 🔐 Safety Features

### Isolation
Each request runs in isolated context with:
- Independent memory state
- Timeout protection (10s default)
- Error containment

### Circuit Breaker
- Opens after consecutive failures
- Automatic recovery
- Fallback to safe mode

### Safe Mode
- Deterministic execution
- No learning/mutation
- Core operations only

## 🚦 Production Checklist

- [x] Health checks working
- [x] Prometheus metrics scraping
- [x] Grafana dashboards active
- [x] Error rate 0%
- [x] Latency <5ms p95
- [x] Template learning active
- [x] Reuse rate >90%

## 🔄 Operations

### During Incident

```bash
# Check health
curl http://localhost:3000/api/v1/agent/health

# View metrics
curl http://localhost:3000/metrics

# Reset agent (clear memory)
curl -X POST http://localhost:3000/api/v1/agent/reset
```

### Monitoring Commands

```bash
# View logs
docker logs autonomus_agent-app-1 --tail 50

# Check containers
docker ps

# View Prometheus targets
curl localhost:9090/api/v1/targets
```

## 📝 License

MIT

## 🤝 Contributing

This is a production internal system. For questions, please refer to the documentation or contact the platform team.
