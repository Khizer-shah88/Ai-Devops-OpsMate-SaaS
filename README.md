# DevMat AI

AI-assisted DevOps SaaS for code review, error debugging, CI/CD generation, and repository infrastructure onboarding.

## Stack

- **Frontend:** Next.js 16 (App Router) on port `3000`
- **Backend:** NestJS 11 API on port `4000`
- **Database:** PostgreSQL (Docker Compose or embedded local Postgres)

## Features

- Auth (register / login + JWT)
- Code review with real heuristic analysis (LLM when `OPENAI_API_KEY` is set)
- Error / log debugging
- CI/CD + Docker / Compose / Actions / Kubernetes generation
- DevOps workspace: analyze package/repo, readiness scan, onboard, infra generate, GitHub connect
- Request history + usage stats

## Quick start (local, no Docker)

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Environment

Copy `.env.example` to `.env` (root) and `backend/.env`.  
Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3) Start embedded Postgres (keep this terminal open)

```bash
cd backend
npm run db:local
```

### 4) Migrate + seed

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

Demo account:

- Email: `demo@devmate.ai`
- Password: `demo1234`

### 5) Run API + UI

```bash
# terminal A
cd backend && npm run start:dev

# terminal B
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Docker Compose

Requires Docker Desktop:

```bash
cp .env.example .env
docker compose up --build
```

## Optional LLM

Set `OPENAI_API_KEY` (OpenAI or OpenRouter `sk-or-v1-...`) for richer AI output.  
Without a key, modules still return accurate heuristic / template results from the real input.

## GitHub OAuth (optional)

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:4000/devops/github/oauth/callback
```

## Health

- API: `GET http://localhost:4000/health`
- UI: `http://localhost:3000`
