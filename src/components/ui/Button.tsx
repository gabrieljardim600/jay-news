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
          "inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-200 active:scale-[0.97]",
          {
            "bg-primary text-white hover:bg-primary-hover shadow-sm": variant === "primary",
            "bg-secondary text-white hover:bg-secondary-hover shadow-sm": variant === "secondary",
            "border border-border text-text hover:bg-surface-light": variant === "outline",
            "text-text-secondary hover:text-text hover:bg-surface": variant === "ghost",
            "px-3 py-1.5 text-[13px]": size === "sm",
            "px-5 py-2.5 text-[15px]": size === "md",
            "px-6 py-3 text-[17px]": size === "lg",
            "opacity-40 pointer-events-none": disabled || loading,
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
