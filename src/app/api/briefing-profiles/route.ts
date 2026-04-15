import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/markets/briefing-profiles/service";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const profiles = await listProfiles(supabase, user.id);
    return NextResponse.json(profiles);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.slug !== "string" || typeof body.label !== "string" || typeof body.synth_prompt !== "string") {
    return NextResponse.json({ error: "slug, label, synth_prompt são obrigatórios" }, { status: 400 });
  }
  const row = {
    user_id: user.id,
    slug: body.slug.trim(),
    label: body.label.trim(),
    description: body.description ?? null,
    icon: body.icon ?? null,
    module_ids: Array.isArray(body.module_ids) ? body.module_ids : [],
    synth_prompt: body.synth_prompt,
    output_sections: Array.isArray(body.output_sections) ? body.output_sections : [],
    is_builtin: false,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : 100,
  };
  const { data, error } = await supabase.from("briefing_profiles").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
