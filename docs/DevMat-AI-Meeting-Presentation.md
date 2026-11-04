# DevMat AI — Project Overview & Meeting Presentation Guide

**Product:** DevMat AI (Developer Assistant)  
**Type:** AI-powered DevOps SaaS  
**Audience:** Engineering / product / stakeholder meeting  
**Demo account:** `demo@devmate.ai` / `demo1234`  
**Local URLs:** Frontend `http://localhost:3000` · Backend `http://localhost:4000`

Use this document to explain the product, walk architecture, and run a live demo.

---

## 1. Elevator pitch (30 seconds)

> **DevMat AI** is an AI-assisted DevOps platform that helps developers review code, debug failures, generate CI/CD and infrastructure configs, and ship fixes to GitHub — in one workspace instead of juggling ChatGPT, Docker docs, and Actions separately.

**Problem we solve**

- Code review and error diagnosis are slow and inconsistent without senior review.
- Writing Docker, GitHub Actions, and K8s configs is repetitive and easy to get wrong.
- Fixing a failing pipeline usually means jumping between GitHub logs, docs, and AI chat with no repo context.
- Teams lack a single place that connects **AI + GitHub + persisted project memory**.

**What we deliver**

- One SaaS app with JWT auth, usage history, and light/dark UI.
- Repo-aware analysis (not generic chat-only).
- Production-ready artifact bundles (Dockerfile, Compose, Actions, K8s, cost/security notes).
- GitHub-native ship loop: **diff → PR → Actions auto-debug → per-repo memory**.

---

## 2. Meeting agenda (suggested 20–25 min)

| Time | Topic |
|------|--------|
| 2 min | Problem & pitch |
| 5 min | Product walkthrough (modules) |
| 5 min | Architecture & stack |
| 8 min | Live demo |
| 3–5 min | Differentiators, roadmap Q&A |

---

## 3. Product modules (what to say)

### Dashboard
- Overview of AI usage (reviews, debugs, CI/CD runs).
- Recent activity history restored from the server.
- Quick jump into tools.

### Code Review
- Paste code in Monaco editor (multi-language).
- AI returns bugs, improvements, and optimizations.
- Works with LLM key; falls back to heuristics if no key.

### Debug Assistant
- Paste stack traces / error logs.
- Gets explanation, root cause, and step-by-step fixes.
- Sample presets for TypeError, DB connection, JWT errors.

### CI/CD Generator
- Connect GitHub, pick a repo, run readiness scan.
- Generate repo-aware GitHub Actions pipelines.
- **Ship to GitHub** panel: file diff, open PR, list Actions runs, AI-debug failed jobs, repo memory.

### DevOps Copilot (“DevMat DevOps Studio”)
- Full GitHub-native flow: OAuth, analyze, onboard.
- Generates infra bundle: Docker, Compose, Actions, Kubernetes, `.env.example`, cost & security docs.
- Log doctor + multi-cloud targets (local, Vercel, ECS, EKS, DigitalOcean, etc.).

### Auto Fix + Debug
- One-click “Fix my DevOps” for missing essentials.
- Live debug timeline from CI/error logs.
- Complements the Ship panel on CI/CD.

### Auth
- Email/password registration and login.
- Optional GitHub OAuth for repo access (`repo`, `read:org`, `workflow`).

---

## 4. Architecture (whiteboard talking points)

```
┌─────────────────┐     JWT + REST      ┌──────────────────┐
│  Next.js 16 UI  │ ──────────────────► │  NestJS 11 API   │
│  (port 3000)    │ ◄────────────────── │  (port 4000)     │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
             PostgreSQL                   OpenAI / OpenRouter            GitHub APIs
             (Prisma 7)                   (or heuristic fallback)        (OAuth, Diff, PR, Actions)
```

**Key ideas to emphasize**

1. **Frontend** owns UX (App Router pages, AppShell, theme, Monaco).
2. **Backend** owns AI orchestration, GitHub ops, and persistence.
3. **Shared AI service** powers review, debug, CI/CD, and DevOps — one place to swap models.
4. **Repo memory** stores per-user/per-repo timeline (analysis, diffs, PRs, Actions) in Postgres.
5. **Graceful degradation:** without an API key, modules still return useful heuristic/template output.

**Repo layout**

| Path | Role |
|------|------|
| `frontend/` | Next.js app, pages, shared UI |
| `backend/` | NestJS modules: auth, ai, review, debug, cicd, devops, history |
| `backend/prisma/` | Schema, migrations, seed |
| `docker-compose.yml` | Full stack (db + API + UI) |
| `.env` | Secrets: JWT, AI key, GitHub OAuth |

---

## 5. Tech stack (one slide)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, Framer Motion, Monaco |
| Backend | NestJS 11, Passport JWT, class-validator |
| Database | PostgreSQL + Prisma 7 |
| AI | OpenAI-compatible SDK · OpenAI or **OpenRouter** · default `gpt-4.1-mini` |
| Auth | bcrypt + JWT (7d local / 12h production) |
| Integrations | GitHub OAuth + REST (repos, diff, PR, Actions logs) |
| Deploy | Docker Compose or local embedded Postgres (`npm run db:local`) |

---

## 6. What makes this different

Say these out loud — they separate DevMat from “just another ChatGPT wrapper”:

1. **DevOps workflow, not chat-only** — package/repo analysis, readiness score, health checks.
2. **Ship loop** — Diff against remote → select files → open PR → debug failed Actions with AI.
3. **Per-repo memory** — Remembers last analysis, PR, and run context for that repository.
4. **Artifact bundle** — Real files teams can commit (Docker, Actions, K8s, security/cost notes).
5. **Works offline-ish** — Heuristic mode keeps demos and local use alive without a paid AI key.
6. **SaaS-ready** — Multi-user JWT auth, history stats, projects/versions persisted.

---

## 7. Live demo script (8 minutes)

**Prep**

- Frontend and backend running.
- Prefer: `OPENAI_API_KEY` (or OpenRouter) set.
- Optional but impressive: GitHub OAuth connected.

### Step 1 — Login & Dashboard (1 min)
1. Open `http://localhost:3000/auth`.
2. Sign in with `demo@devmate.ai` / `demo1234`.
3. Show usage stats and recent activity.
4. Toggle **light / dark mode** briefly (polish signal).

**Say:** “This is the workspace home — every AI action is tracked for the user.”

### Step 2 — Code Review (1–2 min)
1. Go to **Code Review**.
2. Keep or paste a short TypeScript snippet with an obvious smell (e.g. `eval`, hard-coded secret).
3. Run review; show bugs / improvements.

**Say:** “Language-aware static review in seconds — useful before a PR.”

### Step 3 — Debug Assistant (1–2 min)
1. Open **Debug Assistant**.
2. Click a sample (e.g. DB `ECONNREFUSED`).
3. Show root cause + fix steps.

**Say:** “Same AI core, specialized for incident-style logs.”

### Step 4 — DevOps / CI/CD + Ship (3–4 min) — *hero moment*
1. Open **DevOps Copilot** or **CI/CD Generator**.
2. If OAuth is set: **Continue with GitHub** → pick a repo.
3. Run analyze / readiness / generate pipeline.
4. On CI/CD, open **Ship to GitHub**:
   - Run **Diff**
   - Optionally **Apply PR**
   - Show Actions runs / **Debug latest** if a failure exists
5. Mention **repo memory** updates after ship actions.

**Fallback (no GitHub):** paste `package.json` analyze path, generate infra locally, show files — still a strong story.

### Step 5 — Auto Fix (optional, 1 min)
1. Open **Auto Fix + Debug**.
2. Analyze → **Fix my DevOps** → paste a failing log for the timeline.

**Close:** “From review → debug → generate → PR → Actions diagnosis — one product.”

---

## 8. Security & multi-tenancy (if asked)

- Passwords hashed with bcrypt (cost 12).
- API routes (except auth/health/OAuth callback) require JWT.
- GitHub tokens stored encrypted on the user record.
- History and repo memory scoped to the authenticated user.
- Do not demo with production secrets; use demo account + test repos.

---

## 9. How we run it locally (ops footnote)

```text
1. npm install in backend/ and frontend/
2. Configure .env (JWT, DATABASE_URL, OPENAI_*, optional GitHub OAuth)
3. backend: npm run db:local  →  prisma migrate  →  seed
4. backend: npm run start:dev
5. frontend: npm run dev
```

Or: `docker compose up --build`

Health check: `GET http://localhost:4000/health` (includes whether AI is configured).

---

## 10. Likely questions & short answers

| Question | Answer |
|----------|--------|
| Which AI model? | Configurable via env; default gpt-4.1-mini; OpenRouter supported. |
| Does it need GitHub? | Core AI tools work without it; ship/PR/Actions need OAuth. |
| Where is data stored? | PostgreSQL via Prisma (users, history, projects, repo memory). |
| Can it work without an AI key? | Yes — heuristic/template mode for demos and offline-ish use. |
| Is this production-ready? | Core flows are wired end-to-end; harden secrets, rate limits, and queue for scale. |
| Why not only Copilot / ChatGPT? | We own the DevOps workflow, artifacts, GitHub ship loop, and tenant history. |

---

## 11. Closing slide (suggested wording)

**DevMat AI** turns day-to-day DevOps pain — review, debug, pipelines, infra, and GitHub shipping — into one AI workspace with real repo context and memory.

**Ask for the room**

- Feedback on which module matters most for our users.
- Priority next: deeper Actions autofix PRs, team workspaces, or more cloud targets.

---

## Appendix A — Feature → route map

| Feature | UI route |
|---------|----------|
| Auth | `/auth` |
| Dashboard | `/dashboard` |
| Code Review | `/code-review` |
| Debug | `/debug` |
| CI/CD + GitHub Ship | `/cicd` |
| DevOps Copilot | `/devops` |
| Auto Fix + Debug | `/devops-autofix` |

## Appendix B — High-level API surface

| Area | Examples |
|------|----------|
| Auth | `POST /auth/register`, `POST /auth/login` |
| AI tools | `POST /review-code`, `/debug-error`, `/generate-cicd` |
| History | `GET /history`, delete one / clear all |
| DevOps | analyze, onboard, generate-infra, log-analyzer, projects |
| GitHub | oauth start/callback, repos, diff, apply-pr, actions runs/debug |
| Memory | `GET/PUT` repo-memory |
| Health | `GET /health` |

---

*Document generated for meeting use · Product brand: DevMat AI · Codename in repo: OpsMate*
