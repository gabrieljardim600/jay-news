import { createClient } from "@/lib/supabase/server";
import { generateDigest } from "@/lib/digest/generator";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users } = await supabase.from("user_settings").select("user_id").limit(1);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "No users found" }, { status: 404 });
    }

    const digestId = await generateDigest(users[0].user_id, "scheduled");
    return NextResponse.json({ digestId, status: "processing" });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const digestId = await generateDigest(user.id, "on_demand");
    return NextResponse.json({ digestId, status: "processing" });
  } catch (error) {
    return NextResponse.json({ error: `Generation failed: ${error}` }, { status: 500 });
  }
}
