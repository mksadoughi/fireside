import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-subtle">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-foreground",
          "outline-none focus:border-fire-orange/50 focus:ring-1 focus:ring-fire-orange/25",
          "transition-colors cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
