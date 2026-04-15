import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PROFILES, type OutputSection } from "./defaults";

export type BriefingProfile = {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  module_ids: string[];
  synth_prompt: string;
  output_sections: OutputSection[];
  is_builtin: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Ensures the user has the default profiles seeded. Idempotent — only inserts
 *  profiles whose slug isn't already present for the user. */
export async function ensureDefaultProfiles(
  // use unknown-typed client to avoid circular DB-schema import; we only rely on simple calls
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("briefing_profiles")
    .select("slug")
    .eq("user_id", userId);
  const have = new Set((existing ?? []).map((r) => r.slug as string));
  const missing = DEFAULT_PROFILES.filter((d) => !have.has(d.slug));
  if (missing.length === 0) return;
  const rows = missing.map((d) => ({
    user_id: userId,
    slug: d.slug,
    label: d.label,
    description: d.description,
    icon: d.icon,
    module_ids: d.module_ids,
    synth_prompt: d.synth_prompt,
    output_sections: d.output_sections,
    is_builtin: true,
    sort_order: d.sort_order,
  }));
  await supabase.from("briefing_profiles").insert(rows);
}

export async function listProfiles(supabase: SupabaseClient, userId: string): Promise<BriefingProfile[]> {
  await ensureDefaultProfiles(supabase, userId);
  const { data, error } = await supabase
    .from("briefing_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BriefingProfile[];
}

export async function getProfileById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<BriefingProfile | null> {
  const { data } = await supabase
    .from("briefing_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as BriefingProfile | null) ?? null;
}
