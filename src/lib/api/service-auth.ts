import { createClient, SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export type ServiceCtx = {
  service: { slug: string; scopes: string[]; rate_limit_per_min: number };
  account_id: string;
  user_id: string | null;
  role: "viewer" | "editor" | "owner";
};

export class ServiceAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let adminClient: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

const VALID_ROLES = new Set(["viewer", "editor", "owner"]);
const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, owner: 2 };

function requireHeader(req: Request, name: string): string {
  const v = req.headers.get(name);
  if (!v) throw new ServiceAuthError(400, `Missing ${name}`);
  return v;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function requireService(req: Request): Promise<ServiceCtx> {
  const serviceSlug = requireHeader(req, "x-service");
  const serviceKey = requireHeader(req, "x-service-key");
  const accountId = requireHeader(req, "x-account-id");
  const userId = req.headers.get("x-user-id");
  const userRoleRaw = (req.headers.get("x-user-role") || "editor").toLowerCase();

  if (!isUuid(accountId)) {
    throw new ServiceAuthError(400, "Invalid x-account-id");
  }
  if (userId && !isUuid(userId)) {
    throw new ServiceAuthError(400, "Invalid x-user-id");
  }
  if (!VALID_ROLES.has(userRoleRaw)) {
    throw new ServiceAuthError(400, `Invalid x-user-role (got ${userRoleRaw})`);
  }
  const role = userRoleRaw as ServiceCtx["role"];

  const admin = getAdminClient();
  const { data: svc, error: svcErr } = await admin
    .from("news_services")
    .select("slug, key_hash, scopes, rate_limit_per_min, active")
    .eq("slug", serviceSlug)
    .maybeSingle();

  if (svcErr || !svc || !svc.active) {
    throw new ServiceAuthError(401, "Unknown or inactive service");
  }
  const ok = await bcrypt.compare(serviceKey, svc.key_hash);
  if (!ok) {
    throw new ServiceAuthError(401, "Invalid service key");
  }

  // Lazy upsert do mapping (audit-only)
  await admin
    .from("news_service_accounts")
    .upsert(
      {
        service_slug: svc.slug,
        external_account_id: accountId,
      },
      { onConflict: "service_slug,external_account_id", ignoreDuplicates: true }
    );

  return {
    service: { slug: svc.slug, scopes: svc.scopes, rate_limit_per_min: svc.rate_limit_per_min },
    account_id: accountId,
    user_id: userId,
    role,
  };
}

export function requireRole(ctx: ServiceCtx, minRole: ServiceCtx["role"]): void {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) {
    throw new ServiceAuthError(
      403,
      `Insufficient role: have '${ctx.role}', need '${minRole}'+`
    );
  }
}

/**
 * Returns the admin (service_role) Supabase client. Tenant isolation in v1
 * routes is application-level: every query MUST filter by `account_id`.
 *
 * Helper `byAccount(query, ctx)` enforces this. RLS column-policies (added
 * per-table in later migrations) provide defense-in-depth for any client
 * that does NOT use service_role.
 */
export function accountClient(_ctx: ServiceCtx): SupabaseClient {
  return getAdminClient();
}

/**
 * Apply the mandatory `account_id` filter to a Supabase query.
 *
 * Usage:
 *   const supabase = accountClient(ctx);
 *   const q = supabase.from('digests').select('*');
 *   const { data } = await byAccount(q, ctx);
 */
export function byAccount<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  ctx: ServiceCtx
): Q {
  return query.eq("account_id", ctx.account_id);
}

/**
 * Optional profile filter (Radar / Phase 12). Reads `profile_id` from the
 * request URL; if absent, returns the query unchanged (account-wide).
 *
 * Usage:
 *   const supabase = accountClient(ctx);
 *   const q = supabase.from('digests').select('*');
 *   const filtered = byProfile(byAccount(q, ctx), req);
 */
export function byProfile<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  req: Request
): Q {
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profile_id");
  if (profileId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    return query.eq("profile_id", profileId);
  }
  return query;
}

/**
 * Read `profile_id` from URL search params, validate as UUID. Returns null
 * if absent or invalid. Use for INSERTs that should associate a row with
 * the calling profile.
 */
export function readProfileId(req: Request): string | null {
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profile_id");
  if (profileId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    return profileId;
  }
  return null;
}

/** Wrap a route handler with service auth + uniform error mapping. Supports
 *  Next.js App Router second-arg `{ params }` for dynamic routes. */
export function withService<T, P = Record<string, never>>(
  handler: (
    req: Request,
    ctx: ServiceCtx,
    routeCtx: { params: Promise<P> }
  ) => Promise<T>
): (req: Request, routeCtx: { params: Promise<P> }) => Promise<Response> {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    try {
      const ctx = await requireService(req);
      const result = await handler(req, ctx, routeCtx);
      if (result instanceof Response) return result;
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ServiceAuthError) {
        return NextResponse.json({ error: { message: err.message } }, { status: err.status });
      }
      console.error("[v1] handler error:", err);
      return NextResponse.json(
        { error: { message: "Internal server error" } },
        { status: 500 }
      );
    }
  };
}
