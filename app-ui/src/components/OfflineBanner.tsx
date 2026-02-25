import { useHeartbeat } from "@/hooks/useHeartbeat";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const online = useHeartbeat();

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-danger/90 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2">
      <WifiOff size={14} />
      Server unreachable — reconnecting...
    </div>
  );
}
