import { twMerge } from "tailwind-merge";
import clsx from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-semibold rounded-md transition-all duration-300",
          {
            "bg-primary text-white hover:bg-primary-hover": variant === "primary",
            "bg-secondary text-white hover:bg-secondary-hover": variant === "secondary",
            "border border-border text-text hover:bg-surface-light": variant === "outline",
            "text-text-secondary hover:text-text hover:bg-surface-light": variant === "ghost",
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-3 text-base": size === "md",
            "px-6 py-4 text-lg": size === "lg",
            "opacity-50 cursor-not-allowed": disabled || loading,
          }
        ),
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
