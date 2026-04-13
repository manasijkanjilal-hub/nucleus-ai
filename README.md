# Nucleus AI — Marketing Orchestration Platform

Enterprise-grade, AI-powered marketing orchestration built with **Next.js 15**, **FastAPI**, **LangGraph**, and **Qdrant**.

## Architecture

```
/nucleus-ai
  /frontend        ← Next.js 15 (App Router) + Tailwind + shadcn/ui
  /backend         ← Python FastAPI + LangGraph
    /agents        ← Multi-agent nodes (Planner, Executor, Reviewer)
    /api/v1        ← REST endpoints
    /core          ← Config, security, PII scrubber
    /db            ← SQLAlchemy models & Qdrant vector store
  docker-compose.yml
```

### Core Modules

| Module | Description |
|--------|-------------|
| **A — Context Vault** | RAG pipeline: ingest brand docs → chunk → embed → vector search |
| **B — Agentic Workflow** | LangGraph multi-agent: Planner → Executor → Reviewer loop |
| **C — Attribution Engine** | Spend & conversion tracking, ROAS metrics |
| **D — Privacy-Native** | PII scrubbing middleware for all data flows |

---

## Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
- **Node.js ≥ 20** and **npm**
- **Python ≥ 3.12** and **pip**
- *(Optional)* An OpenAI API key for real embeddings

### Option 1 — Docker Compose (easiest)

```bash
# Clone and enter the project
cd nucleus-ai

# Copy env files
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY (optional)

# Start everything
docker compose up --build
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Qdrant Dashboard**: http://localhost:6333/dashboard

### Option 2 — Local Development

#### 1. Start infrastructure

```bash
# Start only Postgres + Qdrant via Docker
docker compose up postgres qdrant -d
```

#### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Copy & edit env
cp .env.example .env

# Run
uvicorn main:app --reload --port 8000
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

### Context Vault (Module A — Step 2)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/context/ingest` | Ingest text/PDF into Context Vault |
| `POST` | `/api/v1/context/search` | Semantic search over ingested content |

### Agentic Workflow Engine (Module B — Step 3)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/workflow/execute` | Run multi-agent workflow (sync) |
| `POST` | `/api/v1/workflow/execute/async` | Queue workflow for background execution |
| `GET` | `/api/v1/workflow/status/{job_id}` | Check async job status |

### Attribution Engine (Module C — Step 4)

#### Campaign Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/campaigns/` | Create a new campaign |
| `GET` | `/api/v1/campaigns/` | List campaigns (filter by brand, status, dates) |
| `GET` | `/api/v1/campaigns/{id}` | Get campaign details |
| `PUT` | `/api/v1/campaigns/{id}` | Update a campaign |
| `DELETE` | `/api/v1/campaigns/{id}` | Delete a campaign |

#### Spend Tracking

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/spend/` | Log a spend entry |
| `GET` | `/api/v1/spend/campaign/{id}` | Get spend entries for a campaign |
| `GET` | `/api/v1/spend/summary` | Aggregate spend by campaign/channel |

#### Conversion Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/conversions/` | Record a conversion event |
| `GET` | `/api/v1/conversions/campaign/{id}` | Get conversions for a campaign |
| `GET` | `/api/v1/conversions/summary` | Aggregate conversions by campaign |

#### Attribution Metrics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/attribution/roas/{id}` | Calculate ROAS (Revenue / Spend) |
| `GET` | `/api/v1/attribution/cac/{id}` | Calculate CAC (Spend / New Customers) |
| `GET` | `/api/v1/attribution/ltv/{id}` | Calculate LTV (Revenue / Unique Customers) |
| `GET` | `/api/v1/attribution/dashboard` | Comprehensive dashboard with all metrics |
| `GET` | `/api/v1/attribution/report/{id}` | Detailed attribution report for a campaign |

### Example: Ingest text

```bash
curl -X POST http://localhost:8000/api/v1/context/ingest \
  -F "brand_id=acme-corp" \
  -F "content_type=brand_guide" \
  -F "vertical=SaaS" \
  -F "text=Acme Corp is a B2B SaaS company that values clarity and simplicity..."
```

### Example: Search

```bash
curl -X POST http://localhost:8000/api/v1/context/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "brand tone of voice", "brand_id": "acme-corp", "limit": 5}'
```

### Example: Execute Workflow

```bash
curl -X POST http://localhost:8000/api/v1/workflow/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Launch a Q3 integrated campaign for our new product line targeting millennials",
    "brand_id": "acme-corp"
  }'
```

Response includes:
- `task_plan`: Structured sub-tasks from the Planner
- `generated_content`: Marketing assets from the Writer
- `reviewer_feedback`: Quality/safety review from the Reviewer
- `approved`: Whether the content passed review
- `iterations`: Number of revision cycles

### Example: Async Workflow

```bash
# Queue the workflow
curl -X POST http://localhost:8000/api/v1/workflow/execute/async \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Create holiday season email campaign", "brand_id": "acme-corp"}'

# Check status (replace JOB_ID with the returned job_id)
curl http://localhost:8000/api/v1/workflow/status/JOB_ID
```

---

## Multi-Agent Architecture (Module B)

The Agentic Workflow Engine uses **LangGraph StateGraph** with three collaborating agents:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Planner  │ ──▶ │  Writer  │ ──▶ │ Reviewer │
└──────────┘     └──────────┘     └──────────┘
                      ▲                 │
                      │   (revise)      │
                      └─────────────────┘
                                        │ (approve)
                                        ▼
                                      END
```

| Agent | Role | Key Features |
|-------|------|-------------|
| **Planner** | Decomposes user prompt into sub-tasks | Structured JSON output (email, ad copy, landing page, etc.) |
| **Writer** | Generates marketing assets | Queries Context Vault for brand tone/guidelines, uses RAG |
| **Reviewer** | Validates content quality & safety | Brand safety checks, formatting validation, iteration limit |

**Files:**
- `backend/agents/state.py` — TypedDict state schema
- `backend/agents/nodes.py` — Planner, Writer, Reviewer node functions
- `backend/agents/tools.py` — LangChain tool for Context Vault search
- `backend/agents/graph.py` — StateGraph construction and routing logic
- `backend/api/v1/workflow.py` — REST API endpoints

---

## Database Models

- **User** — platform users with hashed passwords
- **BrandProfile** — brand DNA (name, vertical, tone keywords)
- **Campaign** — marketing campaigns linked to brands
- **SpendLog** — daily ad spend records per campaign
- **ConversionEvent** — revenue events for ROAS calculation

---

## Development Status

- [x] Step 1: Project scaffolding & tooling
- [x] Step 2: Database models & Context Vault (Module A)
- [x] Step 3: Multi-Agent Graph (Module B)
- [x] Step 4: Attribution Engine (Module C)
- [ ] Step 5: Frontend dashboard
- [x] Step 6: Privacy-Native Processing (Module D)

---

## License

Proprietary — All rights reserved.
