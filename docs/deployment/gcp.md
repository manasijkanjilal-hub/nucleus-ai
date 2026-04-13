# Google Cloud Deployment Guide — Nucleus AI

Deploy Nucleus AI on GCP using **Cloud Run** (serverless) or **GKE** (Kubernetes).

---

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Docker installed locally
- A GCP project with billing enabled
- Domain name configured

---

## Option A: Cloud Run (Recommended for Simplicity)

### 1. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

### 2. Create Artifact Registry

```bash
gcloud artifacts repositories create nucleus-ai \
  --repository-format=docker \
  --location=us-central1 \
  --description="Nucleus AI container images"

# Authenticate Docker
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 3. Build and Push Images

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=us-central1
REGISTRY=${REGION}-docker.pkg.dev/${PROJECT_ID}/nucleus-ai

# Build and push backend
docker build -f docker/production/Dockerfile.backend -t ${REGISTRY}/backend:latest .
docker push ${REGISTRY}/backend:latest

# Build and push frontend
docker build -f docker/production/Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -t ${REGISTRY}/frontend:latest .
docker push ${REGISTRY}/frontend:latest
```

### 4. Set Up Cloud SQL (PostgreSQL)

```bash
# Create instance
gcloud sql instances create nucleus-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-4096 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --availability-type=REGIONAL \
  --root-password="YOUR_STRONG_PASSWORD"

# Create database
gcloud sql databases create nucleus --instance=nucleus-db

# Create user
gcloud sql users create nucleus \
  --instance=nucleus-db \
  --password="YOUR_DB_PASSWORD"
```

### 5. Store Secrets

```bash
echo -n "sk-your-openai-key" | \
  gcloud secrets create OPENAI_API_KEY --data-file=-

echo -n "your-nextauth-secret" | \
  gcloud secrets create NEXTAUTH_SECRET --data-file=-

echo -n "your-secret-key" | \
  gcloud secrets create SECRET_KEY --data-file=-
```

### 6. Deploy Backend to Cloud Run

```bash
gcloud run deploy nucleus-backend \
  --image=${REGISTRY}/backend:latest \
  --region=us-central1 \
  --platform=managed \
  --port=8000 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=300 \
  --concurrency=80 \
  --set-env-vars="APP_ENV=production,DEBUG=false,QDRANT_URL=https://your-qdrant.cloud.qdrant.io" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,SECRET_KEY=SECRET_KEY:latest" \
  --add-cloudsql-instances=${PROJECT_ID}:us-central1:nucleus-db \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://nucleus:PASS@/nucleus?host=/cloudsql/${PROJECT_ID}:us-central1:nucleus-db" \
  --allow-unauthenticated
```

### 7. Deploy Frontend to Cloud Run

```bash
gcloud run deploy nucleus-frontend \
  --image=${REGISTRY}/frontend:latest \
  --region=us-central1 \
  --platform=managed \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=5 \
  --timeout=60 \
  --set-env-vars="NODE_ENV=production,NEXTAUTH_URL=https://yourdomain.com" \
  --set-secrets="NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest" \
  --allow-unauthenticated
```

### 8. Set Up Custom Domain

```bash
# Map domain to frontend service
gcloud run domain-mappings create \
  --service=nucleus-frontend \
  --domain=yourdomain.com \
  --region=us-central1

# Map API subdomain to backend
gcloud run domain-mappings create \
  --service=nucleus-backend \
  --domain=api.yourdomain.com \
  --region=us-central1
```

Cloud Run provides automatic SSL certificates via managed Google certificates.

---

## Option B: GKE (Kubernetes)

For teams needing full Kubernetes control.

### 1. Create GKE Cluster

```bash
gcloud container clusters create-auto nucleus-ai-cluster \
  --region=us-central1 \
  --release-channel=regular
```

### 2. Create Kubernetes Manifests

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nucleus-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nucleus-backend
  template:
    metadata:
      labels:
        app: nucleus-backend
    spec:
      containers:
      - name: backend
        image: us-central1-docker.pkg.dev/PROJECT/nucleus-ai/backend:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: "2"
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        envFrom:
        - secretRef:
            name: nucleus-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: nucleus-backend
spec:
  selector:
    app: nucleus-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### 3. Deploy

```bash
kubectl apply -f k8s/
```

---

## Monitoring

- **Cloud Monitoring:** Automatic metrics for Cloud Run (latency, request count, error rate)
- **Cloud Logging:** Structured logs from containers
- **Error Reporting:** Automatic error grouping and alerting
- **Uptime Checks:** Configure in Cloud Monitoring console

---

## Cost Estimation (Monthly)

| Service | Spec | Estimated Cost |
|---------|------|---------------|
| Cloud Run Backend | 2 vCPU, 2 GB, min 1 instance | ~$50 |
| Cloud Run Frontend | 1 vCPU, 1 GB, min 1 instance | ~$25 |
| Cloud SQL | db-custom-2-4096, HA | ~$80 |
| Qdrant Cloud | Starter | ~$25 |
| Artifact Registry | Image storage | ~$5 |
| **Total** | | **~$185/mo** |
