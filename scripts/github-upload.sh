#!/usr/bin/env bash
# ============================================================
# Nucleus AI — GitHub Repository Upload Helper
# ============================================================
# Usage:  ./scripts/github-upload.sh
#
# Prerequisites:
#   • git installed and configured
#   • GitHub CLI (gh) installed  —  https://cli.github.com
#   • Authenticated with:  gh auth login
# ============================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# ── Helper functions ─────────────────────────────────────────
info()    { echo -e "${BLUE}ℹ ${NC}$*"; }
success() { echo -e "${GREEN}✔ ${NC}$*"; }
warn()    { echo -e "${YELLOW}⚠ ${NC}$*"; }
error()   { echo -e "${RED}✖ ${NC}$*"; exit 1; }

# ── Pre-flight checks ───────────────────────────────────────
command -v git >/dev/null 2>&1 || error "git is not installed."
command -v gh  >/dev/null 2>&1 || error "GitHub CLI (gh) is not installed. Install it: https://cli.github.com"

# Check gh authentication
if ! gh auth status >/dev/null 2>&1; then
    warn "You are not logged in to GitHub CLI."
    echo "  Run:  gh auth login"
    exit 1
fi

GITHUB_USER=$(gh api user --jq '.login' 2>/dev/null || echo "")
if [ -z "$GITHUB_USER" ]; then
    error "Could not determine GitHub username. Run: gh auth login"
fi
success "Authenticated as: ${GITHUB_USER}"

# ── Gather info ──────────────────────────────────────────────
echo ""
read -rp "Repository name [nucleus-ai]: " REPO_NAME
REPO_NAME=${REPO_NAME:-nucleus-ai}

echo ""
echo "Visibility options:"
echo "  1) private  (default — recommended)"
echo "  2) public"
read -rp "Choose [1]: " VIS_CHOICE
VIS_CHOICE=${VIS_CHOICE:-1}

case "$VIS_CHOICE" in
    2)       VISIBILITY="public" ;;
    *)       VISIBILITY="private" ;;
esac

DESCRIPTION="Nucleus AI — Intelligent marketing platform with Context Vault, Multi-Agent Workflow Engine, and Attribution Engine"
read -rp "Description [${DESCRIPTION}]: " CUSTOM_DESC
DESCRIPTION=${CUSTOM_DESC:-$DESCRIPTION}

# ── Confirm ──────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Repository : ${GITHUB_USER}/${REPO_NAME}"
info "Visibility : ${VISIBILITY}"
info "Description: ${DESCRIPTION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -rp "Proceed? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-Y}
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    warn "Aborted."
    exit 0
fi

# ── Create repository ────────────────────────────────────────
echo ""
info "Creating GitHub repository…"

if gh repo view "${GITHUB_USER}/${REPO_NAME}" >/dev/null 2>&1; then
    warn "Repository ${GITHUB_USER}/${REPO_NAME} already exists."
    read -rp "Use existing repository and push? [Y/n]: " USE_EXISTING
    USE_EXISTING=${USE_EXISTING:-Y}
    if [[ ! "$USE_EXISTING" =~ ^[Yy]$ ]]; then
        error "Aborted."
    fi
else
    gh repo create "${REPO_NAME}" \
        --"${VISIBILITY}" \
        --description "${DESCRIPTION}" \
        --disable-wiki \
        --confirm 2>/dev/null || \
    gh repo create "${REPO_NAME}" \
        --"${VISIBILITY}" \
        --description "${DESCRIPTION}" \
        2>/dev/null || \
    error "Failed to create repository. Check your GitHub CLI permissions."

    success "Repository created: ${GITHUB_USER}/${REPO_NAME}"
fi

# ── Configure remote & push ──────────────────────────────────
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

# Remove existing 'origin' if it points somewhere else
CURRENT_ORIGIN=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$CURRENT_ORIGIN" ] && [ "$CURRENT_ORIGIN" != "$REMOTE_URL" ]; then
    git remote remove origin
    info "Replaced existing origin remote."
fi

if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "$REMOTE_URL"
fi

success "Remote set to: ${REMOTE_URL}"

# Determine default branch
DEFAULT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

info "Pushing branch '${DEFAULT_BRANCH}' to origin…"
git push -u origin "${DEFAULT_BRANCH}" 2>&1 || error "Push failed. Check your network and permissions."

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "🎉  Code uploaded successfully!"
echo ""
info "View your repo:  https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Next steps:"
echo "  1. Add collaborators:  gh repo edit ${REPO_NAME} --add-topic ai,marketing"
echo "  2. Set up secrets in GitHub Settings → Secrets for CI/CD"
echo "  3. Configure branch protection rules"
echo ""
