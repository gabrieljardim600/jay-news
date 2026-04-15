import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip: Next internals, image optimizer, static assets, manifest/sw, and ALL /api routes
    // (API routes do their own Supabase auth — no need to pay the getUser() round-trip twice).
    "/((?!api/|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
