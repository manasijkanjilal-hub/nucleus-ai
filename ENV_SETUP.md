# Environment Setup Guide

This guide explains every environment variable used by **Nucleus AI** and where to obtain the required credentials.

---

## Quick Start

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.local.example frontend/.env.local

# Production (Docker Compose)
cp .env.production.example .env.production
```

Then fill in the values following the sections below.

---

## 1. OpenAI API Key *(required)*

| Variable | Example |
|---|---|
| `OPENAI_API_KEY` | `sk-proj-abc123...` |

**How to get it:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Copy the key immediately (it won't be shown again)

**Billing:** You need a paid account with credits. Embedding + chat completion calls cost a few cents per request. Monitor usage at [platform.openai.com/usage](https://platform.openai.com/usage).

**Related variables:**

| Variable | Default | Notes |
|---|---|---|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Cheapest OpenAI embedding model. `text-embedding-3-large` is more accurate but 6× the cost. |
| `LLM_MODEL` | `gpt-4o-mini` | Fast & cheap. Use `gpt-4o` for better quality. |

---

## 2. PostgreSQL Database *(required)*

| Variable | Example |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/nucleus` |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://user:pass@host:5432/nucleus` |

### Option A: Local PostgreSQL (development)

```bash
# Install
sudo apt install postgresql

# Create database and user
sudo -u postgres psql <<SQL
CREATE USER nucleus WITH PASSWORD 'nucleus';
CREATE DATABASE nucleus OWNER nucleus;
SQL
```

Default connection strings:
```
DATABASE_URL=postgresql+asyncpg://nucleus:nucleus@localhost:5432/nucleus
DATABASE_URL_SYNC=postgresql+psycopg2://nucleus:nucleus@localhost:5432/nucleus
```

### Option B: Docker PostgreSQL

If using `docker-compose.yml`, the database is created automatically. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in your `.env.production`.

### Option C: Managed Database

| Provider | Free Tier | Dashboard |
|---|---|---|
| **Supabase** | 500 MB | [supabase.com/dashboard](https://supabase.com/dashboard) |
| **Neon** | 512 MB | [console.neon.tech](https://console.neon.tech) |
| **AWS RDS** | 12 months free | [console.aws.amazon.com/rds](https://console.aws.amazon.com/rds) |

Copy the connection string from the provider's dashboard. Remember:
- **Backend** needs two URLs: one with `asyncpg` driver, one with `psycopg2`
- **Frontend (Prisma)** uses the standard `postgresql://` scheme

---

## 3. Qdrant Vector Database *(required for RAG)*

| Variable | Default |
|---|---|
| `QDRANT_URL` | `http://localhost:6333` |
| `QDRANT_COLLECTION` | `nucleus_context` |
| `VECTOR_DIMENSION` | `1536` |

### Option A: Local Qdrant (Docker)

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### Option B: Qdrant Cloud

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster (free tier available — 1 GB)
3. Copy the cluster URL and API key
4. Set:
   ```
   QDRANT_URL=https://your-cluster-id.cloud.qdrant.io:6333
   QDRANT_API_KEY=your-api-key
   ```

---

## 4. NextAuth.js Secret *(required for frontend)*

| Variable | Example |
|---|---|
| `NEXTAUTH_SECRET` | `K7gN+3x...` (base64 string) |
| `NEXTAUTH_URL` | `http://localhost:3000` |

**Generate the secret:**

```bash
openssl rand -base64 32
```

Copy the output and paste it as `NEXTAUTH_SECRET`.

**`NEXTAUTH_URL`** must match the URL where users access the app:
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

---

## 5. AWS S3 *(optional — file uploads)*

| Variable | Example |
|---|---|
| `AWS_ACCESS_KEY_ID` | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` |
| `AWS_REGION` | `us-east-1` |
| `AWS_BUCKET_NAME` | `my-nucleus-uploads` |
| `AWS_FOLDER_PREFIX` | `nucleus-ai/uploads` |

**How to get credentials:**
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new IAM user with **Programmatic access**
3. Attach the `AmazonS3FullAccess` policy (or a scoped policy for your bucket)
4. Copy the Access Key ID and Secret Access Key

**Create an S3 bucket:**
1. Go to [S3 Console](https://console.aws.amazon.com/s3/)
2. Click **Create bucket**
3. Set a unique name and choose your region
4. Keep "Block all public access" enabled (the app uses signed URLs)

---

## 6. CORS Origins

| Variable | Default |
|---|---|
| `CORS_ORIGINS` | `["http://localhost:3000"]` |

This is a JSON array of allowed frontend origins. Update it to include your production domain:

```
CORS_ORIGINS=["http://localhost:3000","https://yourdomain.com"]
```

---

## 7. Default Login Credentials

After running the seed script, these accounts are available:

| Email | Password | Role |
|---|---|---|
| `admin@nucleus-ai.com` | `admin123` | Admin |
| `demo@nucleus-ai.com` | `demo1234` | User |

Run the seed script:
```bash
cd frontend
npx prisma db seed
```

> ⚠️ **Change these passwords in production!**

---

## 8. Optional Variables

### Sentry (Error Tracking)
| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Get from [sentry.io](https://sentry.io) → Project Settings → Client Keys |
| `SENTRY_ENVIRONMENT` | `production`, `staging`, etc. |

### Email / SMTP
| Variable | Notes |
|---|---|
| `SMTP_HOST` | e.g. `smtp.gmail.com`, `smtp.sendgrid.net` |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | Your email or API username |
| `SMTP_PASSWORD` | Your email password or API key |

### Rate Limiting
| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_PER_MINUTE` | `60` | Max requests per minute per IP |
| `RATE_LIMIT_BURST` | `20` | Burst allowance |

---

## Validation

Run the included validation script to check your `.env` files:

```bash
bash scripts/validate-env.sh
```

This checks that all required variables are set and not empty.

---

## File Reference

| File | Purpose | Git-tracked? |
|---|---|---|
| `backend/.env` | Backend config (local dev) | ❌ No |
| `backend/.env.example` | Backend template | ✅ Yes |
| `frontend/.env.local` | Frontend config (local dev) | ❌ No |
| `frontend/.env.local.example` | Frontend template | ✅ Yes |
| `.env.production` | Production config (Docker) | ❌ No |
| `.env.production.example` | Production template | ✅ Yes |
