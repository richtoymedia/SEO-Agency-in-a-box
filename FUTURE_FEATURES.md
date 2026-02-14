# Future Features — Clerk Auth + Multi-Tenancy

This file documents the Clerk authentication and multi-tenant organization features
that were stripped out for MVP testing. They can be re-added when ready.

## What was removed

- `@clerk/nextjs` dependency
- Clerk middleware protecting app routes
- ClerkProvider wrapping the app layout
- OrganizationSwitcher and UserButton in the nav header
- Sign-in / Sign-up / Org-required pages
- Clerk env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, etc.

## What replaced it (MVP mode)

- A `getDefaultTenant()` helper in `src/server/auth/index.ts` that auto-provisions
  a single default tenant ("My Agency") on first request
- All tRPC and SSE endpoints use this default tenant — no login required
- The landing page (`/`) redirects straight to `/dashboard`

## How to re-add Clerk

1. Install: `pnpm add @clerk/nextjs`
2. Add Clerk env vars to `.env`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
   ```
3. Enable Organizations in the Clerk dashboard
4. Restore `src/middleware.ts`:
   ```ts
   import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
   const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/", "/api/trpc(.*)"]);
   export default clerkMiddleware(async (auth, req) => {
     if (!isPublicRoute(req)) await auth.protect();
   });
   ```
5. Wrap root layout with `<ClerkProvider>`
6. Restore `src/server/auth/index.ts` to use `auth()` from `@clerk/nextjs/server`
   and map `session.orgId` → Tenant
7. Add `<OrganizationSwitcher>` and `<UserButton>` to nav
8. Re-add sign-in, sign-up, org-required pages
9. Update tRPC handler and SSE route to use Clerk `auth()` instead of `getDefaultTenant()`

## DB schema note

The `Tenant` model still has `clerkOrgId` (used as "default-org" in MVP mode).
When Clerk is re-added, real Clerk org IDs will be stored here. No schema change needed.
