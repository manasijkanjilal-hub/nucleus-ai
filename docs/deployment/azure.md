# Azure Deployment Guide — Nucleus AI

Deploy Nucleus AI on Azure using **Azure Container Apps** (recommended) or **AKS**.

---

## Prerequisites

- Azure CLI (`az`) installed and authenticated
- Docker installed locally
- An Azure subscription
- A domain name

---

## Option A: Azure Container Apps (Recommended)

### 1. Set Up Resource Group and Registry

```bash
RESOURCE_GROUP=nucleus-ai-rg
LOCATION=eastus
ACR_NAME=nucleusairegistry

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME --sku Standard

# Log in to ACR
az acr login --name $ACR_NAME
```

### 2. Build and Push Images

```bash
# Build and push using ACR Tasks (no local Docker needed)
az acr build --registry $ACR_NAME \
  --image nucleus-ai/backend:latest \
  --file docker/production/Dockerfile.backend .

az acr build --registry $ACR_NAME \
  --image nucleus-ai/frontend:latest \
  --file docker/production/Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com .
```

### 3. Set Up Azure Database for PostgreSQL

```bash
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name nucleus-db \
  --location $LOCATION \
  --admin-user nucleus \
  --admin-password "YOUR_STRONG_PASSWORD" \
  --sku-name Standard_B2ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --high-availability Enabled

az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name nucleus-db \
  --database-name nucleus
```

### 4. Create Container Apps Environment

```bash
az containerapp env create \
  --name nucleus-env \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

### 5. Deploy Backend

```bash
az containerapp create \
  --name nucleus-backend \
  --resource-group $RESOURCE_GROUP \
  --environment nucleus-env \
  --image ${ACR_NAME}.azurecr.io/nucleus-ai/backend:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --target-port 8000 \
  --ingress external \
  --cpu 1 --memory 2Gi \
  --min-replicas 1 --max-replicas 10 \
  --env-vars \
    APP_ENV=production \
    DEBUG=false \
    DATABASE_URL=postgresql+asyncpg://nucleus:PASS@nucleus-db.postgres.database.azure.com:5432/nucleus \
    QDRANT_URL=https://your-qdrant.cloud.qdrant.io \
  --secrets \
    openai-key="sk-your-key" \
    secret-key="your-secret" \
  --secret-env-vars \
    OPENAI_API_KEY=openai-key \
    SECRET_KEY=secret-key
```

### 6. Deploy Frontend

```bash
az containerapp create \
  --name nucleus-frontend \
  --resource-group $RESOURCE_GROUP \
  --environment nucleus-env \
  --image ${ACR_NAME}.azurecr.io/nucleus-ai/frontend:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --target-port 3000 \
  --ingress external \
  --cpu 0.5 --memory 1Gi \
  --min-replicas 1 --max-replicas 5 \
  --env-vars \
    NODE_ENV=production \
    NEXTAUTH_URL=https://yourdomain.com \
  --secrets \
    nextauth-secret="your-secret" \
  --secret-env-vars \
    NEXTAUTH_SECRET=nextauth-secret
```

### 7. Custom Domain and SSL

```bash
# Add custom domain (Azure provides free managed certificates)
az containerapp hostname add \
  --name nucleus-frontend \
  --resource-group $RESOURCE_GROUP \
  --hostname yourdomain.com

az containerapp hostname bind \
  --name nucleus-frontend \
  --resource-group $RESOURCE_GROUP \
  --hostname yourdomain.com \
  --environment nucleus-env \
  --validation-method CNAME
```

---

## Option B: AKS (Azure Kubernetes Service)

### 1. Create AKS Cluster

```bash
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name nucleus-aks \
  --node-count 3 \
  --node-vm-size Standard_B2ms \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys

az aks get-credentials --resource-group $RESOURCE_GROUP --name nucleus-aks
```

### 2. Deploy with Helm/kubectl

Use the same Kubernetes manifests as the GKE guide, updating image references to ACR.

---

## Monitoring

- **Azure Monitor:** Container-level metrics and logs
- **Application Insights:** APM with distributed tracing
- **Log Analytics Workspace:** Centralized log querying with KQL

---

## Cost Estimation (Monthly)

| Service | Spec | Estimated Cost |
|---------|------|---------------|
| Container Apps Backend | 1 vCPU, 2 GB, min 1 | ~$45 |
| Container Apps Frontend | 0.5 vCPU, 1 GB, min 1 | ~$25 |
| PostgreSQL Flexible | B2ms, HA | ~$80 |
| Container Registry | Standard | ~$5 |
| Qdrant Cloud | Starter | ~$25 |
| **Total** | | **~$180/mo** |
