import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        "bg-card glass rounded-[14px] border border-border p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
