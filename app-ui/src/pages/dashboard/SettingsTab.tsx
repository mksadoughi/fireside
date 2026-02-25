import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AlertTriangle, Save, Check, Globe, Loader } from "lucide-react";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function SettingsTab() {
  const navigate = useNavigate();
  const setServerInfo = useAuthStore((s) => s.setServerInfo);
  const serverInfo = useAuthStore((s) => s.serverInfo);

  const [serverName, setServerName] = useState("");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [tunnelSubdomain, setTunnelSubdomain] = useState("");
  const [savedField, setSavedField] = useState<string | null>(null);

  // Claim state
  const [claimName, setClaimName] = useState("");
  const [claimStatus, setClaimStatus] = useState<"idle" | "checking" | "available" | "taken" | "claiming" | "claimed" | "error">("idle");
  const [claimSuggestions, setClaimSuggestions] = useState<string[]>([]);
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    (async () => {
      const resp = await api.getSettings();
      if (resp.ok) {
        const data = (await resp.json()) as {
          server_name: string;
          tunnel_url: string;
          tunnel_mode: string;
          tunnel_subdomain: string;
        };
        setServerName(data.server_name || "");
        setTunnelUrl(data.tunnel_url || "");
        setTunnelSubdomain(data.tunnel_subdomain || "");
        // Auto-generate a suggested slug from the server name
        if (!data.tunnel_subdomain && data.server_name) {
          setClaimName(slugify(data.server_name));
        }
      }
    })();
  }, []);

  const showSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  const saveServerName = async () => {
    if (!serverName.trim()) return;
    const resp = await api.putSettings({ server_name: serverName.trim() });
    if (resp.ok) {
      setServerInfo({ ...serverInfo!, server_name: serverName.trim() });
      showSaved("name");
      // Auto-update the claim slug if no subdomain is claimed yet
      if (!tunnelSubdomain) {
        setClaimName(slugify(serverName.trim()));
      }
    }
  };

  const checkName = async () => {
    const name = claimName.trim();
    if (!name || name.length < 3) {
      setClaimError("Name must be at least 3 characters.");
      setClaimStatus("error");
      return;
    }
    setClaimStatus("checking");
    setClaimError("");
    try {
      const { data } = await api.tunnelCheck(name);
      if (data.available) {
        setClaimStatus("available");
      } else {
        setClaimStatus("taken");
        setClaimSuggestions(data.suggestions || []);
      }
    } catch {
      setClaimStatus("error");
      setClaimError("Could not reach the registration service.");
    }
  };

  const claimSubdomain = async () => {
    const name = claimName.trim();
    setClaimStatus("claiming");
    setClaimError("");
    try {
      const { resp, data } = await api.tunnelClaim(name);
      if (resp.ok && data.subdomain) {
        setTunnelSubdomain(data.subdomain);
        setTunnelUrl("https://" + data.subdomain);
        setClaimStatus("claimed");
      } else {
        setClaimStatus("error");
        setClaimError((data as unknown as { error?: string }).error || "Claim failed.");
      }
    } catch {
      setClaimStatus("error");
      setClaimError("Could not reach the registration service.");
    }
  };

  const handleReset = async () => {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      alert("Server reset can only be performed from the host machine directly (localhost).");
      return;
    }
    if (!confirm("WARNING: This will permanently delete ALL data on this server (users, messages, settings). Are you absolutely sure?"))
      return;
    const { resp, data } = await api.postResetServer();
    if (resp.ok) {
      navigate("/setup");
      window.location.reload();
    } else {
      alert(`Reset failed: ${(data as { error?: string }).error}`);
    }
  };

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  return (
    <div>
      <p className="text-sm text-muted mb-6">Configure your server name and admin credentials.</p>

      <div className="space-y-5">
        {/* Server name */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Server name</label>
          <p className="text-xs text-muted mb-2">Appears to users in the top left of their chat interface.</p>
          <div className="flex gap-2">
            <Input value={serverName} onChange={(e) => setServerName(e.target.value)} className="max-w-xs" />
            <Button variant="secondary" size="sm" onClick={saveServerName}>
              {savedField === "name" ? <><Check size={14} className="text-success" /> Saved</> : <><Save size={14} /> Save</>}
            </Button>
          </div>
        </div>

        {/* Tunnel / Public access */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            <Globe size={14} className="inline mr-1" />
            Public access
          </label>

          {tunnelSubdomain ? (
            /* Permanent subdomain claimed */
            <div className="space-y-1 mt-2">
              <code className="px-3 py-1.5 text-sm bg-success/10 text-success rounded-md inline-block">
                https://{tunnelSubdomain}
              </code>
              <p className="text-xs text-muted">
                Your server is always accessible at this address. Invite links use it automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Current temporary URL */}
              {tunnelUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted mb-1">Current URL <span className="text-warning">(temporary, changes on restart)</span></p>
                  <code className="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-md inline-block break-all">
                    {tunnelUrl}
                  </code>
                </div>
              )}

              {/* Claim a permanent subdomain */}
              <div className="p-4 border border-dashed border-foreground/10 rounded-lg">
                <p className="text-sm font-medium text-foreground mb-1">Claim a permanent address</p>
                <p className="text-xs text-muted mb-3">
                  Pick a name and your server will always be available at <strong>name.fireside.run</strong>.
                </p>

                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={claimName}
                    onChange={(e) => {
                      setClaimName(slugify(e.target.value));
                      setClaimStatus("idle");
                    }}
                    placeholder="my-server"
                    className="max-w-[200px] font-mono text-sm"
                  />
                  <span className="text-sm text-muted">.fireside.run</span>
                  <Button variant="secondary" size="sm" onClick={checkName} disabled={claimStatus === "checking"}>
                    {claimStatus === "checking" ? <Loader size={14} className="animate-spin" /> : "Check"}
                  </Button>
                </div>

                {claimStatus === "available" && (
                  <div className="space-y-2">
                    <p className="text-xs text-success">✓ {claimName}.fireside.run is available!</p>
                    <Button size="sm" onClick={claimSubdomain}>
                      Claim {claimName}.fireside.run
                    </Button>
                  </div>
                )}

                {claimStatus === "taken" && (
                  <div className="space-y-1">
                    <p className="text-xs text-danger">✗ {claimName}.fireside.run is already taken.</p>
                    {claimSuggestions.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {claimSuggestions.map((s) => (
                          <button
                            key={s}
                            className="text-xs text-accent hover:underline cursor-pointer"
                            onClick={() => { setClaimName(s); setClaimStatus("idle"); }}
                          >
                            {s}.fireside.run
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {claimStatus === "claiming" && (
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Loader size={12} className="animate-spin" /> Setting up your tunnel...
                  </p>
                )}

                {claimStatus === "claimed" && (
                  <p className="text-xs text-success">✓ Claimed! Your server is now live at https://{tunnelSubdomain}</p>
                )}

                {claimStatus === "error" && claimError && (
                  <p className="text-xs text-danger">{claimError}</p>
                )}
              </div>
            </div>
          )}

          {!tunnelUrl && !tunnelSubdomain && (
            <p className="text-xs text-muted mt-2">
              No tunnel active. Install <code>cloudflared</code> and restart for remote access.
            </p>
          )}
        </div>

        {/* Danger zone */}
        {isLocalhost && (
          <div className="pt-5 mt-5 border-t border-danger/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-danger">Reset server</h3>
                <p className="text-xs text-muted mt-1 max-w-lg">
                  Permanently wipe all data — users, messages, API keys, and settings. You'll be returned to the initial setup.
                </p>
              </div>
              <Button variant="danger" size="sm" className="shrink-0" onClick={handleReset}>
                <AlertTriangle size={14} />
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
