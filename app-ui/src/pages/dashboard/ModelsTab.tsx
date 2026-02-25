import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import type { Model, RunningModel, HardwareInfo } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { SettingCard } from "./components/SettingCard";
import { ModelBrowser } from "./components/ModelBrowser";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Trash2 } from "lucide-react";

export function ModelsTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [runningNames, setRunningNames] = useState<Set<string>>(new Set());
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const [pullProgress, setPullProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  const loadModels = useCallback(async () => {
    const [modelsResp, runningResp] = await Promise.all([
      api.getModels(),
      api.getRunningModels(),
    ]);
    if (modelsResp.ok) {
      const data = (await modelsResp.json()) as { models: Model[] };
      setModels(data.models || []);
    }
    if (runningResp.ok) {
      const data = (await runningResp.json()) as { models: RunningModel[] };
      setRunningNames(new Set((data.models || []).map((m) => m.name)));
    }
  }, []);

  useEffect(() => {
    loadModels();
    (async () => {
      const resp = await api.getHardware();
      if (resp.ok) {
        setHardware((await resp.json()) as HardwareInfo);
      }
    })();
  }, [loadModels]);

  const installedModelNames = new Set(models.map((m) => m.name));

  const handlePull = async (name: string) => {
    if (!name || pulling) return;

    setPulling(true);
    setShowProgress(true);
    setPullStatus("Starting download...");
    setPullProgress(0);

    try {
      const resp = await api.pullModel(name);
      if (!resp.body) return;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastStatus = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload) as {
              status?: string;
              total?: number;
              completed?: number;
              error?: string;
            };
            if (data.error) {
              setPullStatus(`Error: ${data.error}`);
              break;
            }
            if (data.status) {
              lastStatus = data.status;
              setPullStatus(data.status);
            }
            if (data.total && data.completed) {
              setPullProgress(Math.round((data.completed / data.total) * 100));
            }
          } catch {
            // skip
          }
        }
      }

      if (!lastStatus.startsWith("Error")) {
        setPullStatus("Download complete!");
        setPullProgress(100);
        loadModels();
      }
    } catch {
      setPullStatus("Download failed. Check the model name and try again.");
    }

    setPulling(false);
    setTimeout(() => setShowProgress(false), 3000);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete model "${name}"? This cannot be undone.`)) return;
    const resp = await api.deleteModel(name);
    if (resp.ok) loadModels();
  };

  return (
    <div>
      <p className="text-sm text-muted mb-6">Download AI models to run locally, or manage your installed models.</p>

      <div className="space-y-6">
        <SettingCard
          title="Download a model"
          description="Browse popular models or enter a custom name. Compatibility is based on your system hardware."
        >
          <ModelBrowser
            onPull={handlePull}
            pulling={pulling}
            installedModelNames={installedModelNames}
            hardware={hardware}
          />
          {showProgress && (
            <div className="mt-4 space-y-2">
              <ProgressBar value={pullProgress} />
              <p className="text-xs text-muted">{pullStatus}</p>
            </div>
          )}
        </SettingCard>

        <SettingCard
          title="Installed Models"
          description="View and manage the models currently downloaded to your local machine."
        >
          {models.length === 0 ? (
            <div className="text-sm text-muted">No models installed. Download one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Params</th>
                    <th className="pb-2 font-medium">Quant</th>
                    <th className="pb-2 font-medium">Size</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.name} className="border-b border-border/50">
                      <td className="py-2.5">
                        <div className="font-medium">{m.name}</div>
                        {m.details.family && (
                          <div className="text-xs text-muted">{m.details.family}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-muted">{m.details.parameter_size}</td>
                      <td className="py-2.5 text-muted font-mono text-xs">{m.details.quantization_level || "—"}</td>
                      <td className="py-2.5 text-muted">{m.size ? formatBytes(m.size) : "—"}</td>
                      <td className="py-2.5">
                        {runningNames.has(m.name) ? (
                          <Badge variant="success">Loaded</Badge>
                        ) : (
                          <span className="text-xs text-muted">Idle</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleDelete(m.name)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SettingCard>
      </div>
    </div>
  );
}
