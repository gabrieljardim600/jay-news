import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        "bg-card rounded-md border border-border/20 p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
