import { twMerge } from "tailwind-merge";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] text-text-secondary font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={twMerge(
            "w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all appearance-none pr-10",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      </div>
    </div>
  );
}
