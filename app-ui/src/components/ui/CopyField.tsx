import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyFieldProps {
  value: string;
  label?: string;
}

export function CopyField({ value, label }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-subtle">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={value}
          className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm text-foreground font-mono select-all outline-none"
        />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-subtle hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
