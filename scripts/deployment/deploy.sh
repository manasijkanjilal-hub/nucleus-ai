#!/usr/bin/env bash
# =============================================================================
# Nucleus AI — Quick Start Deployment Script
# One-command deployment for VPS/self-hosted environments
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/nucleus-ai/main/scripts/deployment/deploy.sh | bash
#   # or
#   ./scripts/deployment/deploy.sh
# =============================================================================
set -euo pipefail

# ---- Colors & Helpers -------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1" >&2; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

header() {
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}══════════════════════════════════════════${NC}"
    echo ""
}

# ---- Pre-flight Checks ------------------------------------------------------
header "Nucleus AI — Production Deployment"

# Check if running as appropriate user
if [ "$(id -u)" = "0" ]; then
    warn "Running as root. It's recommended to run as a regular user with Docker permissions."
fi

# Check required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        err "$1 is not installed."
        return 1
    fi
    log "$1 found: $(command -v $1)"
}

header "Step 1: Checking Prerequisites"

MISSING=0
check_command docker || MISSING=1
check_command curl || MISSING=1
check_command git || MISSING=1
check_command openssl || MISSING=1

# Check docker compose
if docker compose version &> /dev/null; then
    log "Docker Compose found (plugin)"
elif docker-compose version &> /dev/null; then
    log "Docker Compose found (standalone)"
else
    err "Docker Compose not found!"
    MISSING=1
fi

if [ "${MISSING}" -eq 1 ]; then
    err "Missing prerequisites. Install them first:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    exit 1
fi

# ---- Determine Install Location ---------------------------------------------
INSTALL_DIR="${NUCLEUS_INSTALL_DIR:-/opt/nucleus-ai}"

header "Step 2: Setting Up Project"

if [ -d "${INSTALL_DIR}/.git" ]; then
    info "Existing installation found at ${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
    git pull origin main 2>/dev/null || warn "Could not pull latest changes"
elif [ -f "docker-compose.prod.yml" ]; then
    info "Running from project directory"
    INSTALL_DIR="$(pwd)"
else
    info "Cloning Nucleus AI to ${INSTALL_DIR}..."
    sudo mkdir -p "${INSTALL_DIR}"
    sudo chown "$(whoami)" "${INSTALL_DIR}"
    git clone https://github.com/your-org/nucleus-ai.git "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"

# ---- Environment Configuration -----------------------------------------------
header "Step 3: Configuring Environment"

ENV_FILE=".env.production"

if [ -f "${ENV_FILE}" ]; then
    info "Existing ${ENV_FILE} found. Keeping current configuration."
else
    if [ ! -f ".env.production.example" ]; then
        err ".env.production.example not found!"
        exit 1
    fi

    cp .env.production.example "${ENV_FILE}"
    log "Created ${ENV_FILE} from template"

    # Auto-generate secrets
    POSTGRES_PASSWORD=$(openssl rand -hex 32)
    SECRET_KEY=$(openssl rand -hex 64)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    # Update generated values
    sed -i "s/POSTGRES_PASSWORD=CHANGE_ME_strong_password_here/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" "${ENV_FILE}"
    sed -i "s/SECRET_KEY=CHANGE_ME_generate_with_openssl_rand_hex_64/SECRET_KEY=${SECRET_KEY}/" "${ENV_FILE}"
    sed -i "s/NEXTAUTH_SECRET=CHANGE_ME_generate_with_openssl_rand_base64_32/NEXTAUTH_SECRET=${NEXTAUTH_SECRET}/" "${ENV_FILE}"

    log "Auto-generated secure passwords and secrets"

    # Prompt for required configuration
    echo ""
    warn "You MUST configure the following in ${ENV_FILE}:"
    echo "  1. DOMAIN         — Your domain name"
    echo "  2. OPENAI_API_KEY — Your OpenAI API key"
    echo "  3. NEXT_PUBLIC_API_URL / NEXTAUTH_URL — Update with your domain"
    echo ""
    read -p "Would you like to configure now? (y/n): " CONFIGURE_NOW

    if [ "${CONFIGURE_NOW}" = "y" ] || [ "${CONFIGURE_NOW}" = "Y" ]; then
        read -p "Enter your domain (e.g., app.example.com): " DOMAIN
        if [ -n "${DOMAIN}" ]; then
            sed -i "s/DOMAIN=yourdomain.com/DOMAIN=${DOMAIN}/" "${ENV_FILE}"
            sed -i "s|NEXT_PUBLIC_API_URL=https://yourdomain.com/api|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api|" "${ENV_FILE}"
            sed -i "s|NEXT_PUBLIC_APP_URL=https://yourdomain.com|NEXT_PUBLIC_APP_URL=https://${DOMAIN}|" "${ENV_FILE}"
            sed -i "s|NEXTAUTH_URL=https://yourdomain.com|NEXTAUTH_URL=https://${DOMAIN}|" "${ENV_FILE}"
            sed -i "s|CORS_ORIGINS=\\[\"https://yourdomain.com\"\\]|CORS_ORIGINS=[\"https://${DOMAIN}\"]|" "${ENV_FILE}"

            # Update nginx config
            sed -i "s/server_name yourdomain.com;/server_name ${DOMAIN};/" nginx/conf.d/default.conf
            log "Domain configured: ${DOMAIN}"
        fi

        read -p "Enter your OpenAI API key (sk-...): " OPENAI_KEY
        if [ -n "${OPENAI_KEY}" ]; then
            sed -i "s/OPENAI_API_KEY=sk-CHANGE_ME/OPENAI_API_KEY=${OPENAI_KEY}/" "${ENV_FILE}"
            log "OpenAI API key configured"
        fi
    fi
fi

# ---- SSL Certificate ---------------------------------------------------------
header "Step 4: SSL Certificate"

if [ -f "nginx/ssl/fullchain.pem" ] && [ -f "nginx/ssl/privkey.pem" ]; then
    log "SSL certificates found"
else
    warn "No SSL certificates found in nginx/ssl/"

    DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2)
    if [ -n "${DOMAIN}" ] && [ "${DOMAIN}" != "yourdomain.com" ]; then
        read -p "Obtain SSL certificate from Let's Encrypt for ${DOMAIN}? (y/n): " GET_SSL
        if [ "${GET_SSL}" = "y" ] || [ "${GET_SSL}" = "Y" ]; then
            if command -v certbot &> /dev/null; then
                sudo certbot certonly --standalone -d "${DOMAIN}" --non-interactive --agree-tos --email "admin@${DOMAIN}"
                sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" nginx/ssl/
                sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" nginx/ssl/
                sudo chmod 644 nginx/ssl/*.pem
                log "SSL certificate obtained and configured"
            else
                warn "Certbot not installed. Install it with: sudo apt install certbot"
                info "Then run: sudo certbot certonly --standalone -d ${DOMAIN}"
            fi
        fi
    else
        info "Set DOMAIN in ${ENV_FILE} and run this script again, or manually place certificates in nginx/ssl/"
    fi
fi

# ---- Build and Deploy --------------------------------------------------------
header "Step 5: Building and Deploying"

log "Building Docker images (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml --env-file "${ENV_FILE}" build

log "Starting services..."
docker compose -f docker-compose.prod.yml --env-file "${ENV_FILE}" up -d

# ---- Wait for Services -------------------------------------------------------
header "Step 6: Waiting for Services to Start"

info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U nucleus > /dev/null 2>&1; then
        log "PostgreSQL is ready"
        break
    fi
    sleep 2
done

info "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log "Backend is healthy"
        break
    fi
    sleep 3
done

info "Waiting for frontend..."
for i in $(seq 1 20); do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log "Frontend is ready"
        break
    fi
    sleep 3
done

# ---- Run Migrations ----------------------------------------------------------
header "Step 7: Running Database Migrations"

docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head 2>/dev/null && \
    log "Backend migrations applied" || \
    warn "Alembic migrations skipped (may need initial setup)"

docker compose -f docker-compose.prod.yml exec -T frontend npx prisma migrate deploy 2>/dev/null && \
    log "Frontend migrations applied" || \
    warn "Prisma migrations skipped (may need initial setup)"

# ---- Setup Backups -----------------------------------------------------------
header "Step 8: Configuring Backups"

chmod +x scripts/deployment/backup.sh scripts/deployment/restore.sh 2>/dev/null || true

if ! crontab -l 2>/dev/null | grep -q "backup.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * ${INSTALL_DIR}/scripts/deployment/backup.sh") | crontab -
    log "Daily backup cron job configured (2:00 AM)"
else
    info "Backup cron job already exists"
fi

# ---- Final Status ------------------------------------------------------------
header "Deployment Complete!"

echo ""
echo -e "${BOLD}Service Status:${NC}"
docker compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

echo ""
DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2 || echo "yourdomain.com")
echo -e "${BOLD}Access URLs:${NC}"
echo "  Frontend:  https://${DOMAIN}"
echo "  API:       https://${DOMAIN}/api/v1/health"
echo "  Health:    https://${DOMAIN}/health"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo "  View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:       docker compose -f docker-compose.prod.yml restart"
echo "  Stop:          docker compose -f docker-compose.prod.yml down"
echo "  Backup:        ./scripts/deployment/backup.sh"
echo "  Update:        git pull && docker compose -f docker-compose.prod.yml up -d --build"
echo ""
warn "Remember to review .env.production and ensure all values are correctly set!"
