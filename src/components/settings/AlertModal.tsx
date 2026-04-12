"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Alert } from "@/types";

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; query: string; expires_at: string | null }) => void;
  alert?: Alert;
  loading?: boolean;
}

export function AlertModal({ open, onClose, onSave, alert, loading }: AlertModalProps) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (alert) {
      setTitle(alert.title);
      setQuery(alert.query);
      setExpiresAt(alert.expires_at ? alert.expires_at.split("T")[0] : "");
    } else {
      setTitle("");
      setQuery("");
      setExpiresAt("");
    }
  }, [alert, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ title, query, expires_at: expiresAt || null });
  }

  return (
    <Modal open={open} onClose={onClose} title={alert ? "Editar Alerta" : "Novo Alerta"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Crise economica"
          required
        />
        <Input
          label="Consulta"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: inflacao OR juros OR selic"
          required
        />
        <Input
          label="Expira em"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
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
