import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import type { APIKey } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, Copy, Check } from "lucide-react";

export function ApiKeysTab() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    const resp = await api.getAdminAPIKeys();
    if (resp.ok) {
      const data = (await resp.json()) as { api_keys: APIKey[] };
      setKeys(data.api_keys || []);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    const name = keyName.trim() || "default";
    const { resp, data } = await api.createAPIKey({ name });
    if (resp.ok) {
      setNewKey(data.api_key);
      setKeyName("");
      loadKeys();
    }
  };

  const handleRevoke = async (id: number) => {
    await api.deleteAPIKey(id);
    if (newKey) setNewKey("");
    loadKeys();
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div>
      <p className="text-sm text-muted mb-6">
        API keys let external apps (like Open WebUI) connect to your Fireside server using the OpenAI-compatible API.
      </p>

      {/* Create section — compact inline */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Your Keys</h2>
        <div className="flex items-center gap-2">
          <Input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="w-44 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <Button onClick={handleCreate} size="sm">
            <Plus size={14} />
            Create Key
          </Button>
        </div>
      </div>

      {/* New key banner — shows only once after creation */}
      {newKey && (
        <div className="mb-4 flex items-center gap-2 bg-amber/10 border border-amber/20 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber mb-1">Save this key — it won't be shown again</p>
            <code className="text-xs font-mono text-foreground break-all">{newKey}</code>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => handleCopyKey(newKey)}
          >
            {copiedKey === newKey ? (
              <><Check size={12} className="text-success" /> Copied</>
            ) : (
              <><Copy size={12} /> Copy</>
            )}
          </Button>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-muted text-sm">No API keys yet. Create one to connect external apps.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Key</th>
                <th className="pb-2 font-medium">Last used</th>
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isNewKey = newKey && newKey.startsWith(k.key_prefix);
                return (
                  <tr key={k.id} className="border-b border-border/50">
                    <td className="py-2.5">{k.name}</td>
                    <td className="py-2.5 font-mono text-xs text-muted">
                      {isNewKey ? (
                        <button
                          onClick={() => handleCopyKey(newKey)}
                          className="inline-flex items-center gap-1.5 text-fire-orange hover:text-fire-orange/80 cursor-pointer transition-colors"
                        >
                          {copiedKey === newKey ? (
                            <><Check size={12} className="text-success" /><span className="text-success">Copied!</span></>
                          ) : (
                            <><Copy size={12} />{k.key_prefix}… · Copy</>
                          )}
                        </button>
                      ) : (
                        <span>{k.key_prefix}…</span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted">
                      {k.last_used_at ? formatDate(k.last_used_at) : "Never"}
                    </td>
                    <td className="py-2.5 text-muted">{formatDate(k.created_at)}</td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:text-danger"
                        onClick={() => handleRevoke(k.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
