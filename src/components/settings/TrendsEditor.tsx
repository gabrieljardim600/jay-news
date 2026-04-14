"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TrendingUp } from "lucide-react";

export function TrendsEditor({
  topic: initialTopic,
  keywords: initialKeywords,
  onSave,
}: {
  topic: string;
  keywords: string[];
  onSave: (topic: string, keywords: string[]) => Promise<void>;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [keywordsRaw, setKeywordsRaw] = useState(initialKeywords.join(", "));

  useEffect(() => {
    setTopic(initialTopic);
    setKeywordsRaw(initialKeywords.join(", "));
  }, [initialTopic, initialKeywords]);

  async function commit() {
    const kw = keywordsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    await onSave(topic.trim(), kw);
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
        <h2 className="text-[15px] font-semibold">Configuração do tema</h2>
      </div>
      <p className="text-[12px] text-text-muted mb-4 leading-relaxed">
        Um digest Trends busca cobertura profunda de um único assunto. As queries de busca são geradas pela IA a partir desses campos.
      </p>
      <div className="flex flex-col gap-3">
        <Input
          label="Tema principal"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onBlur={commit}
          placeholder="Ex: Eleições EUA 2026"
        />
        <Input
          label="Palavras-chave extras (separadas por vírgula)"
          value={keywordsRaw}
          onChange={(e) => setKeywordsRaw(e.target.value)}
          onBlur={commit}
          placeholder="Ex: Trump, Biden, swing states, primárias"
        />
      </div>
    </Card>
  );
}
