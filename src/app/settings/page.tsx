"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TopicsList } from "@/components/settings/TopicsList";
import { SourcesList } from "@/components/settings/SourcesList";
import { AlertsList } from "@/components/settings/AlertsList";
import { AdvancedOptions } from "@/components/settings/AdvancedOptions";
import { createClient } from "@/lib/supabase/client";
import type { Topic, RssSource, Alert, Exclusion, UserSettings } from "@/types";

const defaultSettings: UserSettings = {
  user_id: "",
  digest_time: "07:00",
  language: "pt-BR",
  summary_style: "executive",
  max_articles: 20,
  created_at: "",
  updated_at: "",
};

export default function SettingsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const [topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/sources").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/exclusions").then((r) => r.json()),
    ]);
    setTopics(topicsRes);
    setSources(sourcesRes);
    setAlerts(alertsRes);
    setExclusions(exclusionsRes);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) setSettings(data as UserSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSettingsChange(updates: Partial<UserSettings>) {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() });
  }

  async function handleAddExclusion(keyword: string) {
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    loadData();
  }

  async function handleRemoveExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
          Voltar
        </Button>
      </header>
      <div className="flex flex-col gap-6">
        <TopicsList topics={topics} onRefresh={loadData} />
        <SourcesList sources={sources} topics={topics} onRefresh={loadData} />
        <AlertsList alerts={alerts} onRefresh={loadData} />
        <AdvancedOptions
          settings={settings}
          exclusions={exclusions}
          onSettingsChange={handleSettingsChange}
          onAddExclusion={handleAddExclusion}
          onRemoveExclusion={handleRemoveExclusion}
        />
      </div>
    </div>
  );
}
