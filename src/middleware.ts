import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// No-op middleware — Clerk auth removed for MVP testing
// See FUTURE_FEATURES.md for Clerk re-integration notes
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
