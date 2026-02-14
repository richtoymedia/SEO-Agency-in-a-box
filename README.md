# SEO Agency In A Box

Full-stack SEO content generation and optimization platform built with Next.js, tRPC, Prisma, and AI services.

## Features

- **Content Pipeline** (7 steps): Research, Image Specs, Image Generation, Article Writing, Meta Tags, Thumbnail, Repurpose (LinkedIn + YouTube)
- **Optimization Pipeline** (5 steps): Scrape, Keyword Detection, Competitor Research, SEO Audit, Optimized Rewrite
- **Multi-brand support** with per-brand voice/style, SEO settings, and internal linking
- **Real-time progress** via SSE (Server-Sent Events)
- **Mock mode** for testing without API keys — all AI services return deterministic fake data

## Deploy to Vercel

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USER/SEO-Agency-in-a-box.git
git push -u origin main
```

### 2. Create a Postgres database

Use one of these free providers:
- [Neon](https://neon.tech) (recommended, generous free tier)
- [Supabase](https://supabase.com)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)

Copy the connection string (it will look like `postgresql://user:pass@host/dbname?sslmode=require`).

### 3. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo
2. Set the **Environment Variable**:
   - `DATABASE_URL` = your Postgres connection string
3. Click **Deploy**

Vercel will automatically run `prisma generate` (via postinstall) and `next build`.

### 4. Initialize the database

After the first deploy, run the Prisma migration against your database:

```bash
# From your local machine with DATABASE_URL set to your cloud Postgres
npx prisma db push
```

Or use the Vercel CLI:
```bash
vercel env pull .env.local
npx prisma db push
```

### 5. (Optional) Enable AI services

Set these environment variables in Vercel to switch from mock mode to real AI:

| Variable | Service |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (article writing, audit, repurpose) |
| `GEMINI_API_KEY` | Gemini (research, structured outputs) |
| `SERPAPI_API_KEY` | SerpAPI (Google search) |
| `FIRECRAWL_API_KEY` | Firecrawl (web scraping) |
| `FAL_KEY` | FAL AI (image generation) |

Without these keys, the app runs in **mock mode** with deterministic fake data — perfect for testing the UI and workflows.

## Local Development

```bash
# Install dependencies
pnpm install

# Start Postgres + Redis (optional, for queue mode)
docker compose up -d

# Push schema to database
npx prisma db push

# Start dev server
pnpm dev
```

The app runs at `http://localhost:3000`.

### With Redis (queue mode)

If `REDIS_URL` is set, jobs run via BullMQ workers in a separate process:

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Queue worker
pnpm worker
```

### Without Redis (sync mode)

If `REDIS_URL` is not set, pipelines run inline in the API request handler. This is the default for Vercel deployments and local development without Docker.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **API**: tRPC v11
- **Database**: PostgreSQL + Prisma 5
- **Queue**: BullMQ + Redis (optional)
- **AI**: Claude, Gemini, SerpAPI, Firecrawl, FAL
- **UI**: Tailwind CSS + shadcn-style components
- **Validation**: Zod v4

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # App routes
│   │   ├── dashboard/      # Job listing + filters
│   │   ├── jobs/           # Job create + detail
│   │   ├── brands/         # Brand CRUD + settings
│   │   └── optimizations/  # Optimization jobs
│   ├── api/
│   │   ├── trpc/           # tRPC handler
│   │   └── sse/            # SSE streaming endpoint
├── components/             # React components
│   ├── ui/                 # shadcn-style UI primitives
│   ├── nav.tsx             # Navigation
│   └── providers.tsx       # tRPC + React Query providers
├── lib/
│   ├── schemas/            # Zod schemas (shared contracts)
│   ├── hooks/              # React hooks (useJobStream)
│   ├── trpc.ts             # tRPC React client
│   └── utils.ts            # Utilities (cn helper)
└── server/
    ├── auth/               # Auth helpers
    ├── db/                 # Prisma client singleton
    ├── queue/              # BullMQ queues + worker (with sync fallback)
    ├── services/           # AI/API wrappers + pipelines
    └── trpc/               # tRPC routers + context
prisma/
├── schema.prisma           # Database schema
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm worker` | Start BullMQ worker process (requires Redis) |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed database |
