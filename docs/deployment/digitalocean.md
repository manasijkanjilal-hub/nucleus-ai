# DigitalOcean Deployment Guide — Nucleus AI

Deploy Nucleus AI on DigitalOcean using **App Platform** (PaaS) or **Droplets** (VPS).

---

## Prerequisites

- DigitalOcean account
- `doctl` CLI installed and authenticated
- Docker installed locally (for Droplet option)
- Domain name pointed to DigitalOcean

---

## Option A: App Platform (Easiest)

### 1. Create Container Registry

```bash
doctl registry create nucleus-ai-registry --region nyc3
doctl registry login
```

### 2. Push Images

```bash
# Build and tag
docker build -f docker/production/Dockerfile.backend -t registry.digitalocean.com/nucleus-ai-registry/backend:latest .
docker build -f docker/production/Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -t registry.digitalocean.com/nucleus-ai-registry/frontend:latest .

# Push
docker push registry.digitalocean.com/nucleus-ai-registry/backend:latest
docker push registry.digitalocean.com/nucleus-ai-registry/frontend:latest
```

### 3. Create Managed PostgreSQL

```bash
doctl databases create nucleus-db \
  --engine pg \
  --version 16 \
  --size db-s-2vcpu-4gb \
  --region nyc3 \
  --num-nodes 1
```

### 4. Create App via Spec

Create `do-app-spec.yaml`:

```yaml
name: nucleus-ai
region: nyc
services:
  - name: backend
    image:
      registry_type: DOCR
      repository: backend
      tag: latest
    instance_count: 2
    instance_size_slug: professional-xs
    http_port: 8000
    health_check:
      http_path: /health
    envs:
      - key: APP_ENV
        value: production
      - key: OPENAI_API_KEY
        type: SECRET
        value: sk-your-key
      - key: DATABASE_URL
        value: ${nucleus-db.DATABASE_URL}
    routes:
      - path: /api
      - path: /health

  - name: frontend
    image:
      registry_type: DOCR
      repository: frontend
      tag: latest
    instance_count: 1
    instance_size_slug: professional-xs
    http_port: 3000
    health_check:
      http_path: /api/health
    envs:
      - key: NODE_ENV
        value: production
      - key: NEXTAUTH_SECRET
        type: SECRET
        value: your-secret
    routes:
      - path: /

databases:
  - name: nucleus-db
    engine: PG
    version: "16"
    production: true
    cluster_name: nucleus-db
```

```bash
doctl apps create --spec do-app-spec.yaml
```

### 5. Custom Domain

```bash
doctl apps update <APP_ID> --spec do-app-spec.yaml
# Add domain via console: Apps → Settings → Domains
```

DigitalOcean App Platform provides free SSL certificates automatically.

---

## Option B: Droplet (VPS)

### 1. Create Droplet

```bash
doctl compute droplet create nucleus-ai \
  --image ubuntu-24-04-x64 \
  --size s-4vcpu-8gb \
  --region nyc3 \
  --ssh-keys <YOUR_SSH_KEY_ID>
```

### 2. Server Setup

```bash
ssh root@<DROPLET_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Clone and configure
git clone https://github.com/your-org/nucleus-ai.git /opt/nucleus-ai
cd /opt/nucleus-ai
cp .env.production.example .env.production
nano .env.production

# Set up SSL
apt install certbot -y
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Deploy
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 3. Enable Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Cost Estimation (Monthly)

| Option | Service | Estimated Cost |
|--------|---------|---------------|
| **App Platform** | 2× pro-xs + 1× pro-xs | ~$36 |
| | Managed PostgreSQL | ~$30 |
| | Container Registry | ~$5 |
| **Droplet** | s-4vcpu-8gb | ~$48 |
| **Shared** | Qdrant Cloud Starter | ~$25 |
| **Total (App Platform)** | | **~$96/mo** |
| **Total (Droplet)** | | **~$73/mo** |
