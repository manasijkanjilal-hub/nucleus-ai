# Workflow Setup Instructions (Manual GitHub Add)

The repository was pushed **without** `.github/workflows/` to bypass GitHub App workflow permission restrictions.

Use the steps below to add workflow files manually in GitHub.

## Why this is needed

Some GitHub Apps/tokens can push regular files but are blocked from creating or updating files under `.github/workflows/`.

## Option A (Recommended): Add via GitHub Web UI

1. Open your repository: `https://github.com/manasijkanjilal-hub/nucleus-ai`
2. Click **Add file** → **Create new file**
3. In filename, enter: `.github/workflows/deploy.yml`
4. Paste the workflow content from this document (below)
5. Commit directly to `master` (or create a PR if you prefer)

## Option B: Add with your own local git credentials

If your personal GitHub credentials have workflow scope:

```bash
git checkout master
git pull origin master
mkdir -p .github/workflows
# create .github/workflows/deploy.yml with content below
git add .github/workflows/deploy.yml
git commit -m "ci: add github actions workflow"
git push origin master
```

---

## `.github/workflows/deploy.yml`

```yaml
# =============================================================================
# Nucleus AI — GitHub Actions CI/CD Pipeline
# =============================================================================
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/${{ github.repository }}/backend
  FRONTEND_IMAGE: ghcr.io/${{ github.repository }}/frontend

jobs:
  # ---- Lint & Type Check -----------------------------------------------------
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install ruff mypy

      - name: Lint backend
        run: |
          cd backend
          ruff check .

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Lint frontend
        run: |
          cd frontend
          npm ci
          npm run lint

  # ---- Backend Tests ---------------------------------------------------------
  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: nucleus
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: nucleus_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov httpx aiosqlite

      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://nucleus:testpassword@localhost:5432/nucleus_test
          DATABASE_URL_SYNC: postgresql+psycopg2://nucleus:testpassword@localhost:5432/nucleus_test
          OPENAI_API_KEY: "test-key"
        run: |
          cd backend
          python -m pytest tests/ -v --cov=. --cov-report=xml --cov-report=term-missing

      - name: Upload coverage
        if: github.event_name == 'pull_request'
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
          flags: backend

  # ---- Frontend Tests --------------------------------------------------------
  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8000
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          NEXTAUTH_SECRET: test-secret
        run: |
          cd frontend
          npm run build

  # ---- Security Scan ---------------------------------------------------------
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: [lint]
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner (backend)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: backend/
          severity: CRITICAL,HIGH
          exit-code: "0"
          format: table

      - name: Run Trivy vulnerability scanner (frontend)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: frontend/
          severity: CRITICAL,HIGH
          exit-code: "0"
          format: table

  # ---- Build & Push Docker Images --------------------------------------------
  build:
    name: Build & Push Images
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend, security]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - service: backend
            dockerfile: docker/production/Dockerfile.backend
          - service: frontend
            dockerfile: docker/production/Dockerfile.frontend
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }}

  # ---- Deploy to Staging -----------------------------------------------------
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/staging'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/nucleus-ai
            git pull origin staging
            docker compose -f docker-compose.prod.yml --env-file .env.staging pull
            docker compose -f docker-compose.prod.yml --env-file .env.staging up -d
            docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
            # Verify health
            sleep 10
            curl -f http://localhost:8000/health || exit 1

  # ---- Deploy to Production --------------------------------------------------
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/nucleus-ai
            git pull origin main

            # Pull new images
            docker compose -f docker-compose.prod.yml --env-file .env.production pull

            # Rolling restart
            docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps backend
            sleep 15
            curl -f http://localhost:8000/health || exit 1

            docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps frontend
            sleep 10
            curl -f http://localhost:3000 || exit 1

            docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps nginx

            # Run migrations
            docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

            echo "Deployment complete!"
```
