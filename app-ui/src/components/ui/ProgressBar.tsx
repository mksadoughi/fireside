import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-surface overflow-hidden",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-fire-orange transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
