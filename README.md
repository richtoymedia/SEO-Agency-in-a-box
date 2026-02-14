# SEO Agency In A Box

Full-stack AI-powered SEO content creation and optimization platform built with Next.js, tRPC, Prisma, BullMQ, and Clerk authentication.

## Stack

- **Frontend:** Next.js (App Router), Tailwind CSS, shadcn/ui components
- **API:** tRPC with Zod validation
- **Database:** PostgreSQL via Prisma ORM
- **Queue:** Redis + BullMQ (separate worker process)
- **Auth:** Clerk (multi-tenant via Organizations)
- **AI:** Claude (Anthropic), Gemini (Google), SerpAPI, Firecrawl, FAL
- **Real-time:** SSE with polling fallback

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Clerk keys (required) and API keys (optional for mock mode)
```

### 3. Install dependencies and set up database

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
```

### 4. Run the app

```bash
# Terminal 1: Web app
pnpm dev

# Terminal 2: Worker process
pnpm worker
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `ANTHROPIC_API_KEY` | No | Claude API key (mock if empty) |
| `GEMINI_API_KEY` | No | Gemini API key (mock if empty) |
| `SERPAPI_API_KEY` | No | SerpAPI key (mock if empty) |
| `FIRECRAWL_API_KEY` | No | Firecrawl key (mock if empty) |
| `FAL_KEY` | No | FAL AI key (mock if empty) |

**Mock mode:** If AI/API keys are not set, the system returns deterministic mock data that validates against all Zod schemas, allowing full end-to-end testing without API costs.

## Features

### Content Pipeline (7 steps)
1. **Research** — Gemini tool loop with SERP + scraping
2. **Image Specs** — Gemini structured output for image placements
3. **Image Generation** — FAL AI image generation
4. **Article Writing** — Claude long-form SEO article with internal links
5. **Meta Tags** — Gemini structured output (title, description, slug)
6. **Thumbnail** — Claude spec + FAL generation
7. **Repurpose** — LinkedIn post + YouTube script via Claude

### Optimization Pipeline (5 steps)
1. **Scrape** — Firecrawl URL scraping
2. **Detect Keyword** — Gemini keyword analysis
3. **Competitor Research** — Gemini tool loop with SERP
4. **SEO Audit** — Claude audit report with scoring
5. **Optimized Rewrite** — Claude rewrite implementing recommendations

### Multi-tenant Architecture
- Clerk Organizations map to tenants
- All data scoped by `tenantId`
- Auto-provisioning of tenant on first org access
- Org switcher in navigation

### Real-time Progress
- SSE streaming for live job updates
- Automatic fallback to polling if SSE fails
- Step-by-step timeline visualization

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm worker` | Start BullMQ worker process |
| `pnpm build` | Production build |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database |

## Demo Checklist

1. Sign in with Clerk
2. Create or select an organization
3. Create a brand (with sitemap URL)
4. Sync sitemap
5. Create content jobs (single + batch)
6. Enqueue generate (or "Generate All Idle")
7. Watch live progress on job detail page (SSE)
8. Confirm article, images, meta, thumbnail, and repurpose outputs
9. Create an optimization job with a source URL
10. Run the optimization and view audit + rewrite outputs

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated routes
│   │   ├── dashboard/      # Job listing + filters
│   │   ├── jobs/           # Job create + detail
│   │   ├── brands/         # Brand CRUD + settings
│   │   └── optimizations/  # Optimization jobs
│   ├── api/
│   │   ├── trpc/           # tRPC handler
│   │   └── sse/            # SSE streaming endpoint
│   ├── sign-in/            # Clerk sign-in
│   ├── sign-up/            # Clerk sign-up
│   └── org-required/       # Org selection prompt
├── components/             # React components
│   ├── ui/                 # shadcn-style UI primitives
│   ├── nav.tsx             # Navigation with org switcher
│   └── providers.tsx       # tRPC + React Query providers
├── lib/
│   ├── schemas/            # Zod schemas (shared contracts)
│   ├── hooks/              # React hooks (useJobStream)
│   ├── trpc.ts             # tRPC React client
│   └── utils.ts            # Utilities (cn helper)
└── server/
    ├── auth/               # Clerk auth helpers
    ├── db/                 # Prisma client singleton
    ├── queue/              # BullMQ queues + worker
    ├── services/           # AI/API wrappers + pipelines
    └── trpc/               # tRPC routers + context
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed script
```
