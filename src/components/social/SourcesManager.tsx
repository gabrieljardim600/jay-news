"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { VoiceModal } from "./VoiceModal";
import { CrowdModal } from "./CrowdModal";
import type { SocialVoice, CrowdSource, VoicePlatform, VoiceCategory, CrowdPlatform } from "@/types";

interface SourcesManagerProps {
  open: boolean;
  onClose: () => void;
  voices: SocialVoice[];
  crowd: CrowdSource[];
  onRefresh: () => void;
}

const PLATFORM_LABEL: Record<string, string> = {
  twitter: "Twitter",
  youtube: "YouTube",
  reddit_user: "Reddit user",
  reddit: "Reddit",
};

export function SourcesManager({ open, onClose, voices, crowd, onRefresh }: SourcesManagerProps) {
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<SocialVoice | undefined>();
  const [crowdModalOpen, setCrowdModalOpen] = useState(false);
  const [editingCrowd, setEditingCrowd] = useState<CrowdSource | undefined>();
  const [loading, setLoading] = useState(false);

  async function saveVoice(data: { platform: VoicePlatform; handle: string; label: string; category: VoiceCategory }) {
    setLoading(true);
    try {
      if (editingVoice) {
        await fetch("/api/social/voices", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingVoice.id, ...data }),
        });
      } else {
        await fetch("/api/social/voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setVoiceModalOpen(false);
      setEditingVoice(undefined);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteVoice(id: string) {
    await fetch(`/api/social/voices?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function saveCrowd(data: { platform: CrowdPlatform; identifier: string; label: string }) {
    setLoading(true);
    try {
      if (editingCrowd) {
        await fetch("/api/social/crowd", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingCrowd.id, ...data }),
        });
      } else {
        await fetch("/api/social/crowd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setCrowdModalOpen(false);
      setEditingCrowd(undefined);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteCrowd(id: string) {
    await fetch(`/api/social/crowd?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Gerenciar fontes sociais">
        <div className="flex flex-col gap-6">
          {/* Voices */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[14px] font-semibold">Vozes</h3>
                <p className="text-[12px] text-text-muted leading-tight">Especialistas e perfis curados</p>
              </div>
              <button
                onClick={() => { setEditingVoice(undefined); setVoiceModalOpen(true); }}
                className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
            </div>
            {voices.length === 0 && <p className="text-text-muted text-[13px]">Nenhuma voz adicionada.</p>}
            <div className="flex flex-col gap-1.5">
              {voices.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate">{v.label}</span>
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">{PLATFORM_LABEL[v.platform] || v.platform}</span>
                    </div>
                    <span className="text-[11px] text-text-muted truncate">{v.handle}</span>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => { setEditingVoice(v); setVoiceModalOpen(true); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteVoice(v.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                      aria-label="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Crowd */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[14px] font-semibold">Pulso</h3>
                <p className="text-[12px] text-text-muted leading-tight">Comunidades e termômetro do crowd</p>
              </div>
              <button
                onClick={() => { setEditingCrowd(undefined); setCrowdModalOpen(true); }}
                className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
            </div>
            {crowd.length === 0 && <p className="text-text-muted text-[13px]">Nenhuma fonte adicionada.</p>}
            <div className="flex flex-col gap-1.5">
              {crowd.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate">{c.label}</span>
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">{PLATFORM_LABEL[c.platform] || c.platform}</span>
                    </div>
                    <span className="text-[11px] text-text-muted truncate">{c.identifier}</span>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => { setEditingCrowd(c); setCrowdModalOpen(true); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCrowd(c.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                      aria-label="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>

      <VoiceModal
        open={voiceModalOpen}
        onClose={() => { setVoiceModalOpen(false); setEditingVoice(undefined); }}
        onSave={saveVoice}
        voice={editingVoice}
        loading={loading}
      />
      <CrowdModal
        open={crowdModalOpen}
        onClose={() => { setCrowdModalOpen(false); setEditingCrowd(undefined); }}
        onSave={saveCrowd}
        source={editingCrowd}
        loading={loading}
      />
    </>
  );
}
