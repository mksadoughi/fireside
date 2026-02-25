import { useEffect, useState } from "react";

export function useHeartbeat(intervalMs = 10000) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const resp = await fetch("/health", {
          signal: AbortSignal.timeout(5000),
        });
        if (mounted && resp.ok && !online) {
          setOnline(true);
        }
        if (mounted) setOnline(resp.ok);
      } catch {
        if (mounted) setOnline(false);
      }
    };

    const id = setInterval(check, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [intervalMs, online]);

  return online;
}
