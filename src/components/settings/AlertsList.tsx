"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AlertModal } from "./AlertModal";
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
        await fetch("/api/alerts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...data }),
        });
      } else {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, digest_config_id: configId }),
        });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Alertas</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Novo
        </Button>
      </div>
      {alerts.length === 0 && (
        <p className="text-text-muted text-sm">Nenhum alerta cadastrado.</p>
      )}
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 rounded-md bg-surface"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{alert.title}</span>
              <span className="text-xs text-text-muted">
                {alert.expires_at
                  ? `Expira em ${new Date(alert.expires_at).toLocaleDateString("pt-BR")}`
                  : "Sem expiracao"}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(alert);
                  setModalOpen(true);
                }}
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(alert.id)}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
      <AlertModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSave={handleSave}
        alert={editing}
        loading={loading}
      />
    </Card>
  );
}
