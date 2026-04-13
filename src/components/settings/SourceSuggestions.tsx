"use client";

import { useState } from "react";

interface Suggestion {
  name: string;
  url: string;
  description: string;
  topic_name: string | null;
}

interface SourceSuggestionsProps {
  digestConfigId?: string;
  interests?: string[];
  onAdd: (suggestion: { name: string; url: string; topic_name: string | null }) => void;
}

export function SourceSuggestions({
  digestConfigId,
  interests,
  onAdd,
}: SourceSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sources/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          digestConfigId ? { digestConfigId } : { interests }
        ),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setFetched(true);
    } catch {
      setError("Não foi possível buscar sugestões. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function dismiss(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdd(s: Suggestion, index: number) {
    onAdd({ name: s.name, url: s.url, topic_name: s.topic_name });
    dismiss(index);
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin">⟳</span>
            <span>Buscando sugestões...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>Sugerir fontes com IA</span>
          </>
        )}
      </button>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {fetched && !error && suggestions.length === 0 && (
        <p className="text-sm text-text-muted mt-2">Nenhuma sugestão encontrada.</p>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 p-3 bg-surface rounded-md border border-border"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-medium text-sm text-text">{s.name}</span>
                <span className="text-xs text-text-muted truncate">{s.url}</span>
                <span className="text-xs text-text-secondary mt-0.5">{s.description}</span>
                {s.topic_name && (
                  <span className="text-xs text-primary mt-0.5">{s.topic_name}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAdd(s, i)}
                  className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                >
                  + Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(i)}
                  className="text-xs px-2 py-1 text-text-muted hover:text-text transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
