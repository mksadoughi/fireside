import { useState, useMemo } from "react";
import catalogData from "@/data/ollama-models.json";
import type { CatalogModel, CatalogModelVariant, HardwareInfo } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Search, Download, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const catalog = catalogData as CatalogModel[];

const categories = [
  { id: "all", label: "All", disabled: false },
  { id: "general", label: "General", disabled: false },
  { id: "code", label: "Code", disabled: false },
  { id: "reasoning", label: "Reasoning", disabled: true },
  { id: "vision", label: "Vision", disabled: true },
  { id: "embedding", label: "Embedding", disabled: true },
];

interface ModelBrowserProps {
  onPull: (fullName: string) => void;
  pulling: boolean;
  installedModelNames: Set<string>;
  hardware: HardwareInfo | null;
}

function getCompatibility(
  variant: CatalogModelVariant,
  hardware: HardwareInfo | null
): "green" | "yellow" | "red" | "unknown" {
  if (!hardware || !hardware.total_ram) return "unknown";
  const totalRamGB = hardware.total_ram / (1024 * 1024 * 1024);
  if (totalRamGB >= variant.ram_gb * 1.2) return "green";
  if (totalRamGB >= variant.ram_gb) return "yellow";
  return "red";
}

const compatColors = {
  green: "bg-success",
  yellow: "bg-amber",
  red: "bg-danger",
  unknown: "bg-muted",
};

const compatLabels = {
  green: "Good fit for your hardware",
  yellow: "May run slowly — tight on RAM",
  red: "Likely too large for your RAM",
  unknown: "Hardware info unavailable",
};

function CompatDot({ level }: { level: "green" | "yellow" | "red" | "unknown" }) {
  return (
    <span
      className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", compatColors[level])}
      title={compatLabels[level]}
    />
  );
}

export function ModelBrowser({ onPull, pulling, installedModelNames, hardware }: ModelBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [fitsOnly, setFitsOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) return false;
      // If "fits my hardware" is on, only show models with at least one compatible variant
      if (fitsOnly && hardware) {
        const availableGb = hardware.available_ram / (1024 * 1024 * 1024);
        const hasCompatible = m.variants.some((v) => v.ram_gb <= availableGb);
        if (!hasCompatible) return false;
      }
      return true;
    });
  }, [search, category, fitsOnly, hardware]);

  const isInstalled = (modelName: string, tag: string) => {
    const fullName = `${modelName}:${tag}`;
    for (const installed of installedModelNames) {
      if (installed === fullName || installed === `${modelName}:${tag}` || installed.startsWith(`${modelName}:${tag}-`)) {
        return true;
      }
    }
    // Also check without tag for "latest"
    if (tag === "latest" && installedModelNames.has(modelName)) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Search + hardware filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="pl-9"
          />
        </div>
        {hardware && (
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer whitespace-nowrap select-none shrink-0">
            <input
              type="checkbox"
              checked={fitsOnly}
              onChange={(e) => setFitsOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-fire-orange cursor-pointer"
            />
            Fits my hardware
          </label>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => !cat.disabled && setCategory(cat.id)}
            disabled={cat.disabled}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              cat.disabled
                ? "bg-transparent text-muted/50 border-dashed border-border/50 cursor-not-allowed"
                : category === cat.id
                  ? "bg-fire-orange/15 text-fire-orange border-fire-orange/30 cursor-pointer"
                  : "bg-surface text-muted border-border hover:text-foreground hover:bg-surface-hover cursor-pointer"
            )}
          >
            {cat.label}
            {cat.disabled && <span className="ml-1 text-[10px] font-normal text-muted/40">· Coming Soon</span>}
          </button>
        ))}
      </div>

      {/* Model list */}
      <div className="max-h-[280px] overflow-y-auto divide-y divide-border/50 border border-border/50 rounded-xl">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No models found. Try a different search or category.
          </div>
        ) : (
          filtered.map((model) => {
            const isExpanded = expandedModel === model.name;
            return (
              <div key={model.name} className="bg-surface/30">
                {/* Model header */}
                <button
                  onClick={() => setExpandedModel(isExpanded ? null : model.name)}
                  className="flex items-center justify-between w-full px-4 py-3 text-left cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{model.name}</span>
                      <Badge variant="default">{model.category}</Badge>
                    </div>
                    <p className="text-xs text-muted truncate">{model.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-xs text-muted">
                      {model.variants.length} variant{model.variants.length > 1 ? "s" : ""}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </button>

                {/* Expanded variants */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="rounded-lg border border-border/50 bg-surface/30">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-border/50 text-muted">
                            <th className="text-left px-3 py-1.5 font-medium">Variant</th>
                            <th className="text-left px-3 py-1.5 font-medium">Params</th>
                            <th className="text-left px-3 py-1.5 font-medium">Size</th>
                            <th className="text-left px-3 py-1.5 font-medium">RAM Needed</th>
                            <th className="text-center px-3 py-1.5 font-medium">Fit</th>
                            <th className="text-right px-3 py-1.5 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 max-h-48 overflow-y-auto">
                          {model.variants.map((v) => {
                            const compat = getCompatibility(v, hardware);
                            const installed = isInstalled(model.name, v.tag);
                            const fullName = `${model.name}:${v.tag}`;
                            return (
                              <tr key={v.tag} className="hover:bg-surface-hover/50">
                                <td className="px-3 py-1.5 font-mono text-foreground font-medium">{v.tag}</td>
                                <td className="px-3 py-1.5 text-muted">{v.parameters}</td>
                                <td className="px-3 py-1.5 text-muted">{v.size_gb < 1 ? `${Math.round(v.size_gb * 1024)} MB` : `${v.size_gb} GB`}</td>
                                <td className="px-3 py-1.5 text-muted">{v.ram_gb} GB</td>
                                <td className="px-3 py-1.5 text-center">
                                  <CompatDot level={compat} />
                                </td>
                                <td className="px-3 py-1.5 text-right flex justify-end">
                                  {installed ? (
                                    <Badge variant="success" className="text-[10px] px-1.5 py-0 h-5 border-none">Installed</Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPull(fullName);
                                      }}
                                      disabled={pulling}
                                      className="text-[10px] h-5 px-2 py-0 border-none shadow-none text-muted hover:text-foreground bg-surface-hover/50 hover:bg-surface-hover hover:ring-1 hover:ring-border transition-all"
                                      variant="secondary"
                                    >
                                      <Download size={10} className="mr-1" />
                                      Pull
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Custom model input — always visible */}
      <div className="pt-3 border-t border-border/30">
        <p className="text-xs text-muted mb-2">
          Don't see your model? Enter the exact name from{" "}
          <a
            href="https://ollama.com/library"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fire-orange hover:underline inline-flex items-center gap-0.5"
          >
            ollama.com/library <ExternalLink size={10} />
          </a>
        </p>
        <div className="flex gap-2">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. llama3.2:3b or hf.co/user/model"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customName.trim()) {
                onPull(customName.trim());
                setCustomName("");
              }
            }}
          />
          <Button
            onClick={() => {
              if (customName.trim()) {
                onPull(customName.trim());
                setCustomName("");
              }
            }}
            disabled={pulling || !customName.trim()}
          >
            <Download size={14} />
            Pull
          </Button>
        </div>
      </div>
    </div>
  );
}
