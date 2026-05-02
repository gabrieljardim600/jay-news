#!/usr/bin/env node
/**
 * Cria/recupera o service user "global@jnews.internal" usado pelo cron
 * /api/cron/trading-global pra gerar o brief global de trading consumido
 * pelo whitelabel-v1 e outras integrações.
 *
 * Uso (uma vez por ambiente):
 *   node scripts/seed-trading-global-user.mjs
 *
 * Requer:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Imprime o user_id — copie pro env var TRADING_GLOBAL_USER_ID (Vercel + .env.local).
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const EMAIL = "global@jnews.internal";
const PASSWORD = `wl-svc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const admin = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findExisting() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === EMAIL) || null;
}

async function main() {
  const existing = await findExisting();
  if (existing) {
    console.log("Service user already exists:");
    console.log(`  email:   ${existing.email}`);
    console.log(`  user_id: ${existing.id}`);
    console.log("");
    console.log(`Set: TRADING_GLOBAL_USER_ID=${existing.id}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { kind: "service", purpose: "trading-global-brief" },
  });
  if (error) throw error;
  if (!data.user) throw new Error("createUser returned no user");

  console.log("Service user created:");
  console.log(`  email:   ${data.user.email}`);
  console.log(`  user_id: ${data.user.id}`);
  console.log("");
  console.log(`Set: TRADING_GLOBAL_USER_ID=${data.user.id}`);
  console.log("(password is randomized and not used — auth is via service role only)");
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
