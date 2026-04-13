"use client";

interface WeightStarsProps {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
}

export function WeightStars({ value, onChange, size = "md", readOnly = false }: WeightStarsProps) {
  const starSize = size === "sm" ? "text-sm" : "text-xl";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange(star)}
          disabled={readOnly}
          className={`${starSize} transition-colors ${
            star <= value ? "text-primary" : "text-text-muted"
          } ${!readOnly ? "hover:text-primary-hover cursor-pointer" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
