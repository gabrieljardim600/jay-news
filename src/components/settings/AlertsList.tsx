"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { AlertModal } from "./AlertModal";
import { Plus, Pencil, Trash2, Bell } from "lucide-react";
import type { Alert } from "@/types";

interface AlertsListProps {
  alerts: Alert[];
  onRefresh: () => void;
  configId: string;
}

export function AlertsList({ alerts, onRefresh, configId }: AlertsListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Alert | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { title: string; query: string; expires_at: string | null }) {
    setLoading(true);
    try {
      if (editing) {
        await fetch("/api/alerts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) });
      } else {
        await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, digest_config_id: configId }) });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold">Alertas</h2>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>
      {alerts.length === 0 && <p className="text-text-muted text-[13px]">Nenhum alerta cadastrado.</p>}
      <div className="flex flex-col gap-1.5">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 bg-warning/10">
                <Bell className="w-3.5 h-3.5 text-warning" />
              </div>
              <div>
                <span className="text-[14px] font-medium block">{alert.title}</span>
                <span className="text-[11px] text-text-muted">
                  {alert.expires_at ? `Expira em ${new Date(alert.expires_at).toLocaleDateString("pt-BR")}` : "Permanente"}
                </span>
              </div>
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button onClick={() => { setEditing(alert); setModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(alert.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <AlertModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(undefined); }} onSave={handleSave} alert={editing} loading={loading} />
    </Card>
  );
}
