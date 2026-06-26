# Acadex Server

The REST API backend for **Acadex** — authentication, classrooms, note sharing with moderation, AI study assistant (RAG), real-time group chat, donations, and admin operations.

| | |
|---|---|
| **Live API** | [acadex-server.vercel.app/api/v1](https://acadex-server.vercel.app/api/v1) |
| **Client** | [acadex-client.vercel.app](https://acadex-client.vercel.app) |
| **Full docs** | [DOCUMENTATION.md](./DOCUMENTATION.md) |

---

## At a glance

- **Modular Express API** — 14 feature modules under `/api/v1`  
- **Dual auth** — Better Auth sessions + JWT (cookies & Bearer)  
- **Classroom permissions** — platform roles + per-classroom CR (Class Representative)  
- **Note workflow** — upload → CR approval → Cloudinary storage  
- **RAG chatbot** — pgvector + OpenRouter embeddings & LLM with streaming  
- **Real-time chat** — Pusher events on classroom channels  
- **Integrations** — Cloudinary, Stripe, Google OAuth, SMTP  

**Stack:** Express 5 · Prisma 7 · PostgreSQL (Neon) · TypeScript · Vercel

---

## Quick start

```bash
pnpm install
cp .env.example .env   # fill all required values

pnpm exec prisma generate
pnpm exec prisma db push

pnpm dev    # http://localhost:5000
```

See `.env.example` and [DOCUMENTATION.md](./DOCUMENTATION.md) for the complete environment variable list.

---

## API modules

| Prefix | Feature |
|--------|---------|
| `/api/v1/auth` | Login, register, OAuth, profile |
| `/api/v1/classrooms` | Classrooms, memberships, leaderboards |
| `/api/v1/subjects` · `/folders` · `/notes` | Curriculum & note sharing |
| `/api/v1/favorites` · `/comments` | Engagement |
| `/api/v1/chat` | Real-time group chat |
| `/api/v1/chatbot` | AI study assistant (RAG) |
| `/api/v1/donations` | Stripe donations |
| `/api/v1/admins` · `/notices` | Platform administration |

**Also:** `/api/auth` — Better Auth handler

---

## Documentation

| Document | Audience | Contents |
|----------|----------|----------|
| **[DOCUMENTATION.md](./DOCUMENTATION.md)** | Recruiters, developers, integrators | Architecture, permissions, flows, database, integrations, deployment |
| **Client docs** | Product & UI flows | [Acadex-client/DOCUMENTATION.md](../Acadex-client/DOCUMENTATION.md) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server (watch) |
| `pnpm build` | Prisma generate + TypeScript compile |
| `pnpm start` | Run production build |
| `pnpm vercel-build` | Vercel deployment build |

---

## Repository layout

```
src/app/
├── module/        # Feature modules (route, controller, service)
├── middleware/    # Auth, validation, errors
├── routes/        # Route index
└── lib/           # Prisma, auth, utilities
prisma/schema/     # Multi-file Prisma schema
```

See [DOCUMENTATION.md](./DOCUMENTATION.md) for architecture diagrams, permission matrices, and end-to-end flows.
