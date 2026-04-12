import { twMerge } from "tailwind-merge";
import clsx from "clsx";

interface BadgeProps {
  variant?: "high" | "medium" | "low" | "default";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", {
          "bg-primary/20 text-primary": variant === "high",
          "bg-secondary/20 text-secondary": variant === "medium",
          "bg-border/30 text-text-secondary": variant === "low",
          "bg-surface-light text-text-secondary": variant === "default",
        }),
        className
      )}
    >
      {children}
    </span>
  );
}
