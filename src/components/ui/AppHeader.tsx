"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, HelpCircle, Sparkles, Star } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ModeNav } from "@/components/ui/ModeNav";
import { useEffect } from "react";
import { useOnboarding } from "@/context/OnboardingContext";
import { useAskJay } from "@/context/AskJayContext";

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
}

export function AppHeader({ rightSlot }: AppHeaderProps) {
  const router = useRouter();
  const { open: openOnboarding } = useOnboarding();
  const askJay = useAskJay();

  useEffect(() => {
    router.prefetch("/manage");
    router.prefetch("/watchlist");
  }, [router]);

  return (
    <header className="flex flex-col gap-5 mb-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" prefetch className="flex items-center gap-3 min-w-0 group">
          <Image
            src="/icons/logo.jpeg"
            alt="JNews"
            width={40}
            height={40}
            priority
            className="rounded-lg group-hover:opacity-90 transition-opacity"
          />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold font-heading tracking-tight leading-tight truncate">
              JNews
            </h1>
            <p className="text-[12px] text-text-muted leading-tight truncate">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
          </div>
        </Link>
        <div className="flex gap-1 items-center shrink-0">
          <ThemeToggle />
          <button
            onClick={() => askJay.open({ type: "freeform" })}
            aria-label="Ask Jay"
            title="Ask Jay — chat com contexto"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-primary"
          >
            <Sparkles className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => router.push("/watchlist")}
            aria-label="Watchlist"
            title="Watchlist"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          >
            <Star className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => openOnboarding()}
            aria-label="Ajuda"
            title="Ajuda — como usar esta tela"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          >
            <HelpCircle className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => router.push("/manage")}
            aria-label="Configurações"
            title="Configurações"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
          {rightSlot}
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto no-scrollbar">
        <ModeNav />
      </div>
    </header>
  );
}
