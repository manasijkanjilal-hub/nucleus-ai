#!/usr/bin/env bash
# =============================================================================
# Nucleus AI — Environment Variable Validator
# =============================================================================
# Usage:  bash scripts/validate-env.sh
#
# Checks that required .env variables are present and non-empty in both
# backend/.env and frontend/.env.local (or frontend/.env).
# =============================================================================

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ---- Helpers -----------------------------------------------------------------

check_var() {
  local file="$1" var="$2" required="$3"
  local value=""

  if [[ -f "$file" ]]; then
    # Extract value (handles KEY=VALUE, KEY="VALUE", KEY='VALUE')
    value=$(grep -E "^${var}=" "$file" 2>/dev/null | head -1 | sed "s/^${var}=//" | sed 's/^["'\'']//;s/["'\'']$//')
  fi

  if [[ -z "$value" || "$value" == *"CHANGE_ME"* || "$value" == *"your-"* || "$value" == *"sk-your"* ]]; then
    if [[ "$required" == "required" ]]; then
      echo -e "  ${RED}✗${NC} ${var} — missing or placeholder"
      ((ERRORS++))
    else
      echo -e "  ${YELLOW}⚠${NC} ${var} — not set (optional)"
      ((WARNINGS++))
    fi
  else
    echo -e "  ${GREEN}✓${NC} ${var}"
  fi
}

check_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo -e "${RED}✗ File not found: ${file}${NC}"
    echo "  Copy the corresponding .example file and fill in values."
    echo ""
    ((ERRORS++))
    return 1
  fi
  return 0
}

# ---- Resolve project root ----------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo " Nucleus AI — Environment Validator"
echo "============================================="
echo ""

# ---- Backend -----------------------------------------------------------------

BACKEND_ENV="$PROJECT_ROOT/backend/.env"
echo "▸ Backend ($BACKEND_ENV)"

if check_file "$BACKEND_ENV"; then
  check_var "$BACKEND_ENV" "DATABASE_URL"       required
  check_var "$BACKEND_ENV" "DATABASE_URL_SYNC"   required
  check_var "$BACKEND_ENV" "OPENAI_API_KEY"      required
  check_var "$BACKEND_ENV" "QDRANT_URL"          required
  check_var "$BACKEND_ENV" "QDRANT_COLLECTION"   required
  check_var "$BACKEND_ENV" "EMBEDDING_MODEL"     optional
  check_var "$BACKEND_ENV" "LLM_MODEL"           optional
  check_var "$BACKEND_ENV" "CORS_ORIGINS"        optional
  check_var "$BACKEND_ENV" "VECTOR_DIMENSION"    optional
  check_var "$BACKEND_ENV" "CHUNK_SIZE"          optional
  check_var "$BACKEND_ENV" "CHUNK_OVERLAP"       optional
fi
echo ""

# ---- Frontend ----------------------------------------------------------------

# Prefer .env.local, fall back to .env
FRONTEND_ENV="$PROJECT_ROOT/frontend/.env.local"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  FRONTEND_ENV="$PROJECT_ROOT/frontend/.env"
fi

echo "▸ Frontend ($FRONTEND_ENV)"

if check_file "$FRONTEND_ENV"; then
  check_var "$FRONTEND_ENV" "NEXTAUTH_SECRET"         required
  check_var "$FRONTEND_ENV" "NEXTAUTH_URL"             required
  check_var "$FRONTEND_ENV" "DATABASE_URL"             required
  check_var "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL"      required
  check_var "$FRONTEND_ENV" "NEXT_PUBLIC_BACKEND_URL"  optional
  check_var "$FRONTEND_ENV" "AWS_REGION"               optional
  check_var "$FRONTEND_ENV" "AWS_BUCKET_NAME"          optional
fi
echo ""

# ---- Summary -----------------------------------------------------------------

echo "---------------------------------------------"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}All required variables are set!${NC}"
else
  echo -e "${RED}${ERRORS} required variable(s) missing or using placeholders.${NC}"
fi
if [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}${WARNINGS} optional variable(s) not set.${NC}"
fi
echo "---------------------------------------------"

exit $ERRORS
