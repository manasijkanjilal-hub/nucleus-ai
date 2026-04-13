# Nucleus AI — Deployment Documentation

Complete guides for deploying Nucleus AI to production.

---

## Quick Start

Deploy to any VPS with a single command:

```bash
git clone https://github.com/your-org/nucleus-ai.git
cd nucleus-ai
./scripts/deployment/deploy.sh
```

---

## Architecture Overview

```
                    ┌─────────────────┐
                    │   Nginx (443)   │  ← SSL/TLS termination
                    │  Reverse Proxy  │  ← Rate limiting
                    └────────┬────────┘  ← Static file caching
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────┴───────┐       ┌─────────┴────────┐
        │   Frontend    │       │     Backend       │
        │  (Next.js)    │       │   (FastAPI)       │
        │   :3000       │       │    :8000          │
        └───────────────┘       └─────────┬─────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                     ┌────────┴────────┐    ┌─────────┴───────┐
                     │   PostgreSQL    │    │     Qdrant      │
                     │    :5432        │    │     :6333       │
                     └─────────────────┘    └─────────────────┘
```

---

## Deployment Guides by Provider

| Provider | Guide | Best For |
|----------|-------|----------|
| [AWS](./aws.md) | ECS Fargate or EC2 | Enterprise, auto-scaling |
| [Google Cloud](./gcp.md) | Cloud Run or GKE | Serverless, simplicity |
| [Azure](./azure.md) | Container Apps or AKS | Microsoft ecosystem |
| [DigitalOcean](./digitalocean.md) | App Platform or Droplets | Cost-effective, simple |
| [Self-Hosted](./self-hosted.md) | Any VPS | Full control, budget |

---

## Supporting Guides

| Topic | Guide | Description |
|-------|-------|-------------|
| [Database](./database.md) | Migrations, backups, scaling | PostgreSQL & Qdrant management |
| [Security](./security.md) | Hardening, CORS, rate limiting | Production security best practices |
| [Monitoring](./monitoring.md) | Logging, metrics, alerting | Observability stack setup |
| [Checklist](./checklist.md) | Pre/post deployment steps | Step-by-step verification |

---

## File Structure

```
nucleus-ai/
├── docker/production/
│   ├── Dockerfile.backend      # Multi-stage backend image
│   └── Dockerfile.frontend     # Multi-stage frontend image
├── nginx/
│   ├── nginx.conf              # Main Nginx configuration
│   ├── conf.d/default.conf     # Site configuration (SSL, routing)
│   └── ssl/                    # SSL certificates (gitignored)
├── scripts/deployment/
│   ├── deploy.sh               # One-command deployment script
│   ├── backup.sh               # Database backup automation
│   ├── restore.sh              # Database restore script
│   └── init-db.sql             # PostgreSQL initialization
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions CI/CD pipeline
├── .gitlab-ci.yml              # GitLab CI/CD pipeline
├── docker-compose.prod.yml     # Production compose file
├── .env.production.example     # Production env template
└── docs/deployment/            # This documentation
```

---

## Environment Requirements

### Minimum (Small Team / Low Traffic)
- 2 vCPUs, 4 GB RAM, 40 GB SSD
- Single server running all services
- Estimated cost: $20-50/month

### Recommended (Production)
- 4 vCPUs, 8 GB RAM, 80 GB SSD
- Managed PostgreSQL (separate)
- Estimated cost: $100-200/month

### Enterprise (High Traffic)
- Multiple servers with load balancing
- Managed databases (RDS, Cloud SQL)
- Auto-scaling container orchestration
- Estimated cost: $200-500+/month
