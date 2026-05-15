# Nucleus AI — Login Credentials & Setup

## Default Login Credentials

The database has been seeded with the following test accounts:

| Role       | Email                    | Password   |
|------------|--------------------------|------------|
| **Admin**  | `admin@nucleus-ai.com`   | `admin123` |
| Demo User  | `demo@nucleus-ai.com`    | `demo1234` |

> ⚠️ **Security Warning:** Change these passwords immediately in any production or publicly-accessible environment.

---

## Quick Start — First Login

1. **Start the application** (if not already running):
   ```bash
   cd /home/ubuntu/nucleus-ai/frontend
   npm run dev
   ```
2. **Open the login page** in your browser:
   ```
   http://localhost:3000/login
   ```
3. **Enter credentials:**
   - Email: `admin@nucleus-ai.com`
   - Password: `admin123`

---

## Database Setup & Seeding

### Prerequisites
- PostgreSQL running (via Docker Compose or external)
- `DATABASE_URL` configured in `frontend/.env` or `frontend/.env.local`

### Push Schema to Database
```bash
cd frontend
npx prisma db push
```

### Seed the Database (create default users)
```bash
cd frontend
npx prisma db seed
```
Or run directly:
```bash
cd frontend
npx tsx --require dotenv/config scripts/seed.ts
```

> The seed script is **idempotent** — running it multiple times will not create duplicate users.

### Run Migrations (production)
```bash
cd frontend
npx prisma migrate deploy
```

---

## Creating New Users

### Option 1 — Sign-up Page
Navigate to `http://localhost:3000/signup` and fill in the registration form.

### Option 2 — Prisma Studio (GUI)
```bash
cd frontend
npx prisma studio
```
This opens a web UI at `http://localhost:5555` where you can browse and edit database records.

### Option 3 — Script / CLI
```bash
cd frontend
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('YOUR_PASSWORD', 12);
  const user = await prisma.user.create({
    data: { name: 'New User', email: 'user@example.com', password: hash }
  });
  console.log('Created:', user.email);
  await prisma.\$disconnect();
})();
"
```

---

## Changing a Password

There is currently no password-change UI. Use one of these methods:

### Prisma Studio
```bash
cd frontend
npx prisma studio
```
Find the user, update the `password` field with a new bcrypt hash.

### CLI
```bash
cd frontend
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('NEW_PASSWORD', 12).then(h => console.log(h));
"
```
Then update via Prisma Studio or a database client.

---

## Authentication Details

| Component      | Technology              |
|----------------|------------------------|
| Auth Library   | NextAuth.js v4         |
| Strategy       | JWT (Credentials)      |
| Password Hash  | bcryptjs (12 rounds)   |
| Session        | JWT stored in cookie   |
| Login Page     | `/login`               |
| Signup Page    | `/signup`              |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid credentials" | Verify the seed script ran successfully. Re-run `npx prisma db seed`. |
| Database connection error | Check `DATABASE_URL` in `frontend/.env`. Ensure PostgreSQL is running. |
| Schema out of sync | Run `npx prisma db push` to sync schema. |
| Forgot password | Use Prisma Studio or the CLI method above to reset. |
| Seed script fails | Ensure dependencies are installed: `npm install --legacy-peer-deps` in `frontend/`. |
