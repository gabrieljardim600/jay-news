import { NextResponse } from "next/server";
import { MODULES } from "@/lib/markets/research/modules";

export async function GET() {
  const payload = MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    icon: m.icon,
    always_on: !!m.always_on,
    providers: m.providers.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description ?? null,
    })),
  }));
  return NextResponse.json(payload);
}
