"use client";

import { useState, type KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";

interface ChipInputProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ChipInput({
  label,
  values,
  onChange,
  placeholder = "Digite e pressione Enter",
  className,
}: ChipInputProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) {
        onChange([...values, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const removeChip = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className={twMerge("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm text-text-secondary font-medium">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2 bg-surface border border-border rounded-md px-3 py-2 focus-within:border-primary transition-colors">
        {values.map((val, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-surface-light text-text-secondary text-sm px-2 py-1 rounded"
          >
            {val}
            <button
              type="button"
              onClick={() => removeChip(i)}
              className="text-text-muted hover:text-danger transition-colors"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-text placeholder:text-text-muted outline-none py-1"
        />
      </div>
    </div>
  );
}
