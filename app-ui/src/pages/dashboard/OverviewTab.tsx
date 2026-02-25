import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import * as api from "@/lib/api";
import type { AdminStats, HardwareInfo } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { Users, MessageSquare, Box, Activity, Cpu, MemoryStick, Monitor } from "lucide-react";

export function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);

  useEffect(() => {
    (async () => {
      const [statsResp, hwResp] = await Promise.all([
        api.getAdminStats(),
        api.getHardware(),
      ]);
      if (statsResp.ok) {
        setStats((await statsResp.json()) as AdminStats);
      }
      if (hwResp.ok) {
        setHardware((await hwResp.json()) as HardwareInfo);
      }
    })();
  }, []);

  const statItems = [
    { label: "Users", value: stats?.users ?? "—", icon: <Users size={18} />, color: "text-fire-orange" },
    { label: "Messages today", value: stats?.messages_today ?? "—", icon: <MessageSquare size={18} />, color: "text-cyan-glow" },
    { label: "Models", value: stats?.models ?? "—", icon: <Box size={18} />, color: "text-amber" },
    { label: "Active sessions", value: stats?.active_sessions ?? "—", icon: <Activity size={18} />, color: "text-success" },
  ];

  return (
    <div>
      <p className="text-sm text-muted mb-6">Your server at a glance — usage stats and hardware info.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <Card key={item.label}>
            <div className="flex items-center gap-3">
              <div className={`${item.color} opacity-70`}>{item.icon}</div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted">{item.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {hardware && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-4">System Hardware</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="text-fire-orange opacity-70"><Cpu size={18} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{hardware.cpu_model || "Unknown CPU"}</p>
                  <p className="text-xs text-muted">{hardware.cpu_cores} cores · {hardware.os}/{hardware.arch}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="text-cyan-glow opacity-70"><MemoryStick size={18} /></div>
                <div>
                  <p className="text-sm font-medium">{formatBytes(hardware.total_ram)} RAM</p>
                  <p className="text-xs text-muted">{formatBytes(hardware.available_ram)} available</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="text-amber opacity-70"><Monitor size={18} /></div>
                <div>
                  <p className="text-sm font-medium">{hardware.gpu_info || "No GPU detected"}</p>
                  <p className="text-xs text-muted">
                    {hardware.gpu_memory ? `${formatBytes(hardware.gpu_memory)} VRAM` : "Integrated / shared memory"}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
