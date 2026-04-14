"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
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
        <label className="text-[13px] text-text-secondary font-medium">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-1.5 bg-surface border border-border rounded-[10px] px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
        {values.map((val, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[13px] font-medium px-2.5 py-1 rounded-full"
          >
            {val}
            <button
              type="button"
              onClick={() => removeChip(i)}
              className="hover:text-danger transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-[15px] text-text placeholder:text-text-muted outline-none py-0.5"
        />
      </div>
    </div>
  );
}
