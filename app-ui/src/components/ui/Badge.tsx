import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info";

const variantStyles: Record<Variant, string> = {
  default: "bg-surface text-subtle border-border",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-amber/10 text-amber border-amber/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
