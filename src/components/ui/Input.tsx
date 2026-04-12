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
          <label className="text-sm text-text-secondary font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge(
            "bg-surface border border-border rounded-md px-4 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors",
            error && "border-danger",
            className
          )}
          {...props}
        />
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
