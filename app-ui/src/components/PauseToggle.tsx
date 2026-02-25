import { useState, useEffect } from "react";
import * as api from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Power } from "lucide-react";

export function PauseToggle() {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await api.getPauseState();
        if (resp.ok) {
          const data = (await resp.json()) as { paused: boolean };
          setPaused(data.paused);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const resp = await api.setPauseState(!paused);
      if (resp.ok) {
        const data = (await resp.json()) as { paused: boolean };
        setPaused(data.paused);
      }
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  if (loading && paused === false) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        <span>...</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border group",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          paused
            ? "bg-amber/10 text-amber border-amber/20 hover:bg-amber/20"
            : "bg-success/10 text-success border-success/20 hover:bg-success/20"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0 transition-colors",
            paused ? "bg-amber" : "bg-success"
          )}
        />
        {paused ? "Paused" : "Online"}
        <Power size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={paused ? "Resume Server" : "Pause Server"}
      >
        <div className="space-y-4">
          {paused ? (
            <>
              <p className="text-sm text-muted">
                Your server is currently <strong className="text-amber">paused</strong>. Users are unable to start new conversations or send messages.
              </p>
              <p className="text-sm text-muted">
                Resuming will immediately allow all users to interact with the AI again.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Pausing will <strong className="text-foreground">temporarily prevent all users</strong> from sending new messages. This is useful if you need to perform maintenance, save resources, or limit usage.
              </p>
              <ul className="text-sm text-muted space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  Existing conversations and history are preserved
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  Downloaded models stay on disk
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  You can resume at any time
                </li>
              </ul>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant={paused ? "primary" : "danger"}
              className="flex-1"
              onClick={toggle}
              disabled={loading}
            >
              {paused ? "Resume Server" : "Pause Server"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
