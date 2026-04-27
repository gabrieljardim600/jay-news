import { createClient, SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
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
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

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

async function mintAccountJwt(account_id: string, user_id: string | null): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT({
    role: "authenticated",
    account_id,
    external_user_id: user_id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setSubject(`service:social:${account_id}`)
    .setAudience("authenticated")
    .sign(secret);
}

export async function requireService(req: Request): Promise<ServiceCtx> {
  if (!JWT_SECRET) {
    throw new ServiceAuthError(500, "SUPABASE_JWT_SECRET not configured");
  }

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
 * Returns a Supabase client whose queries run as `authenticated` with
 * `account_id` claim — RLS policies on v1 tables filter using
 * `(auth.jwt() ->> 'account_id')::uuid`.
 */
export async function accountClient(ctx: ServiceCtx): Promise<SupabaseClient> {
  const jwt = await mintAccountJwt(ctx.account_id, ctx.user_id);
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}

/** Wrap a route handler with service auth + uniform error mapping. */
export function withService<T>(
  handler: (req: Request, ctx: ServiceCtx) => Promise<T>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const ctx = await requireService(req);
      const result = await handler(req, ctx);
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
