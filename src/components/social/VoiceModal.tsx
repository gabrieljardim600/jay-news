"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { SocialVoice, VoicePlatform, VoiceCategory } from "@/types";

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { platform: VoicePlatform; handle: string; label: string; category: VoiceCategory }) => void;
  voice?: SocialVoice;
  loading?: boolean;
}

const PLATFORM_OPTIONS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "youtube", label: "YouTube" },
  { value: "reddit_user", label: "Reddit user" },
];

const CATEGORY_OPTIONS = [
  { value: "analyst", label: "Analista" },
  { value: "economist", label: "Economista" },
  { value: "trader", label: "Trader" },
  { value: "institution", label: "Instituição" },
  { value: "other", label: "Outro" },
];

export function VoiceModal({ open, onClose, onSave, voice, loading }: VoiceModalProps) {
  const [platform, setPlatform] = useState<VoicePlatform>("twitter");
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<VoiceCategory>("analyst");

  useEffect(() => {
    if (voice) {
      setPlatform(voice.platform);
      setHandle(voice.handle);
      setLabel(voice.label);
      setCategory(voice.category);
    } else {
      setPlatform("twitter");
      setHandle("");
      setLabel("");
      setCategory("analyst");
    }
  }, [voice, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || !label.trim()) return;
    onSave({ platform, handle: handle.trim(), label: label.trim(), category });
  }

  const placeholder =
    platform === "twitter"
      ? "@stuhlberger"
      : platform === "youtube"
      ? "@nomedocanal ou UCxxxxx"
      : "u/usuario";

  return (
    <Modal open={open} onClose={onClose} title={voice ? "Editar voz" : "Nova voz"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Plataforma"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as VoicePlatform)}
          options={PLATFORM_OPTIONS}
        />
        <Input
          label="Handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={placeholder}
          required
        />
        <Input
          label="Nome"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Luis Stuhlberger"
          required
        />
        <Select
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value as VoiceCategory)}
          options={CATEGORY_OPTIONS}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
