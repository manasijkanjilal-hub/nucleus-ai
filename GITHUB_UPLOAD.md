# 🚀 Uploading Nucleus AI to GitHub

This guide provides three easy ways to upload the Nucleus AI codebase to your GitHub account.

---

## Prerequisites

- **Git** installed and configured with your name/email
- A **GitHub account** (https://github.com)

```bash
# Configure git (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

---

## Option A — Manual Method (GitHub.com UI)

Best if you prefer using the browser and don't have GitHub CLI installed.

### Step 1: Create a New Repository on GitHub

1. Go to **https://github.com/new**
2. Fill in the details:
   - **Repository name:** `nucleus-ai`
   - **Description:** `Nucleus AI — Intelligent marketing platform with Context Vault, Multi-Agent Workflow Engine, and Attribution Engine`
   - **Visibility:** Private (recommended) or Public
   - ⚠️ **Do NOT** initialize with README, .gitignore, or license (the repo already has these)
3. Click **Create repository**

### Step 2: Push the Code

After creating the repo, GitHub will show setup instructions. Run these commands in your terminal from the project root:

```bash
cd /path/to/nucleus-ai

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/nucleus-ai.git

# Push all code
git push -u origin master
```

> **Note:** If your default branch is `main` instead of `master`, use:
> ```bash
> git branch -M main
> git push -u origin main
> ```

### Step 3: Verify

Visit `https://github.com/YOUR_USERNAME/nucleus-ai` to confirm all files are uploaded.

---

## Option B — Automated Script (Recommended)

The easiest method — a single script handles everything.

### Prerequisites

Install GitHub CLI: https://cli.github.com

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Windows
winget install GitHub.cli
```

Then authenticate:
```bash
gh auth login
```

### Run the Script

```bash
cd /path/to/nucleus-ai
./scripts/github-upload.sh
```

The script will:
1. ✅ Verify you're authenticated
2. 📝 Ask for repository name (default: `nucleus-ai`)
3. 🔒 Ask for visibility (default: private)
4. 🏗️ Create the repository on GitHub
5. 🚀 Push all code automatically

---

## Option C — GitHub CLI One-Liner

If you have `gh` installed and just want a quick upload:

```bash
cd /path/to/nucleus-ai

# Create repo and push in one go
gh repo create nucleus-ai --private --source=. --remote=origin --push \
  --description "Nucleus AI — Intelligent marketing platform"
```

**Options:**
- Replace `--private` with `--public` for a public repo
- Add `--disable-wiki` to disable the wiki tab

---

## After Upload — Recommended Next Steps

### 1. Set Up Repository Secrets (for CI/CD)

Go to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `DATABASE_URL` | Production database URL |
| `NEXTAUTH_SECRET` | NextAuth.js secret |
| `DOCKER_USERNAME` | Docker Hub username (for image publishing) |
| `DOCKER_PASSWORD` | Docker Hub access token |

### 2. Branch Protection (Recommended)

Go to **Settings → Branches → Add rule:**
- Branch name pattern: `main` or `master`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

### 3. Add Collaborators

```bash
# Via CLI
gh repo edit nucleus-ai --add-topic ai,marketing,fastapi,nextjs

# Add a collaborator
gh api repos/YOUR_USERNAME/nucleus-ai/collaborators/COLLABORATOR_USERNAME -X PUT
```

### 4. Enable GitHub Pages (Optional)

For hosting documentation from the `docs/` folder.

---

## Troubleshooting

### "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/nucleus-ai.git
git push -u origin master
```

### "Permission denied"
- Ensure you're authenticated: `gh auth status` or check SSH keys
- For HTTPS, you may need a [Personal Access Token](https://github.com/settings/tokens)

### "Repository not found" on push
- Double-check the repository was created on GitHub
- Verify the remote URL: `git remote -v`

### "Updates were rejected" (non-fast-forward)
This happens if the remote has content you don't have locally:
```bash
git pull --rebase origin master
git push -u origin master
```

### Large file errors
If you get errors about file size limits:
```bash
# Check for large files
find . -type f -size +50M -not -path "./.git/*" -not -path "*/node_modules/*"

# Consider using Git LFS for large files
git lfs install
git lfs track "*.pdf"
```

---

## What Gets Uploaded

The repository includes:

| Directory | Contents |
|---|---|
| `backend/` | FastAPI application (Python) — API, agents, database |
| `frontend/` | Next.js application (TypeScript) — UI, auth, dashboard |
| `docker/` | Production Dockerfiles |
| `nginx/` | Reverse proxy configuration |
| `scripts/` | Deployment & utility scripts |
| `docs/` | Deployment guides (AWS, GCP, Azure, DigitalOcean, self-hosted) |
| `monitoring/` | Prometheus configuration |
| `.github/` | CI/CD workflows |

**Excluded** (via `.gitignore`):
- `.env` files with secrets
- `node_modules/`
- `__pycache__/`
- `.next/` build output
- Docker volume data
- SSL certificates
- Log files

---

*For detailed project documentation, see [README.md](README.md).*
