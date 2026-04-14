"use client";

interface WeightStarsProps {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
}

export function WeightStars({ value, onChange, size = "md", readOnly = false }: WeightStarsProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange(star)}
          disabled={readOnly}
          className={`transition-all duration-150 ${
            size === "sm" ? "text-[14px]" : "text-[20px]"
          } ${
            star <= value ? "text-primary" : "text-text-muted/30"
          } ${!readOnly ? "hover:text-primary hover:scale-110 cursor-pointer" : "cursor-default"}`}
        >
          ●
        </button>
      ))}
    </div>
  );
}
