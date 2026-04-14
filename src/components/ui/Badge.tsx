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
        clsx("inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold tracking-wide", {
          "bg-primary/15 text-primary": variant === "high",
          "bg-secondary/15 text-secondary": variant === "medium",
          "bg-surface text-text-muted": variant === "low",
          "bg-surface text-text-secondary": variant === "default",
        }),
        className
      )}
    >
      {children}
    </span>
  );
}
