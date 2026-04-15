import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/markets/research/modules";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    icon: m.icon ?? null,
    always_on: !!m.always_on,
    required_fields: m.required_fields ?? [],
    optional_fields: m.optional_fields ?? [],
    provider_count: m.providers.length,
  }));

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
  });
}
