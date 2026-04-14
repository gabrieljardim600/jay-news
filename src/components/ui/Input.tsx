import { twMerge } from "tailwind-merge";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[13px] text-text-secondary font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge(
            "bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200",
            error && "border-danger focus:ring-danger/30",
            className
          )}
          {...props}
        />
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
