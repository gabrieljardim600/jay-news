"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { GossipSource, GossipPlatform, GossipSourceTier } from "@/lib/gossip/types";

interface SourceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: GossipSource;
}

const PLATFORM_OPTIONS: Array<{ value: GossipPlatform; label: string }> = [
  { value: "rss", label: "RSS" },
  { value: "twitter", label: "Twitter / X" },
  { value: "youtube", label: "YouTube" },
  { value: "reddit", label: "Reddit" },
];

const TIER_OPTIONS: Array<{ value: GossipSourceTier; label: string }> = [
  { value: "primary", label: "Primary (fonte direta)" },
  { value: "proxy", label: "Proxy (intermediário)" },
  { value: "aggregator", label: "Aggregator (agregador)" },
];

function placeholderFor(platform: GossipPlatform): string {
  switch (platform) {
    case "rss":
      return "https://exemplo.com/feed.xml";
    case "twitter":
      return "@handle";
    case "youtube":
      return "@canal ou UCxxxxx";
    case "reddit":
      return "r/subreddit";
  }
}

export function SourceFormModal({ open, onClose, onSaved, existing }: SourceFormModalProps) {
  const [platform, setPlatform] = useState<GossipPlatform>("rss");
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState<GossipSourceTier>("primary");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existing) {
      setPlatform(existing.platform);
      setHandle(existing.handle);
      setLabel(existing.label);
      setTier(existing.tier);
    } else {
      setPlatform("rss");
      setHandle("");
      setLabel("");
      setTier("primary");
    }
  }, [existing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || !label.trim()) return;
    setLoading(true);
    try {
      let res: Response;
      if (existing) {
        res = await fetch(`/api/gossip/sources/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), tier }),
        });
      } else {
        res = await fetch("/api/gossip/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            handle: handle.trim(),
            label: label.trim(),
            tier,
          }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Erro ao salvar: ${j?.error || `HTTP ${res.status}`}`);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Editar fonte" : "Nova fonte"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Plataforma"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as GossipPlatform)}
          options={PLATFORM_OPTIONS}
          disabled={!!existing}
        />
        <Input
          label="Handle / URL"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={placeholderFor(platform)}
          required
          disabled={!!existing}
        />
        <Input
          label="Nome"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Hugo Gloss"
          required
        />
        <Select
          label="Tier"
          value={tier}
          onChange={(e) => setTier(e.target.value as GossipSourceTier)}
          options={TIER_OPTIONS}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
