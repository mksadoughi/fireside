import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import * as api from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [serverName, setServerName] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const resp = await api.getInvite(token);
        const data = (await resp.json()) as {
          valid: boolean;
          server_name?: string;
        };
        setValid(data.valid);
        setServerName(data.server_name || "Fireside");
      } catch {
        setValid(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);

    const form = e.target as HTMLFormElement;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await register(token, username, password);
      navigate("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo className="w-10 h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">
            {serverName || "Fireside"}
          </h1>

          {valid === null && (
            <p className="text-muted text-sm mt-2">Checking invite...</p>
          )}

          {valid === false && (
            <div className="mt-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              This invite link has expired or already been used. Ask the
              server admin for a new one.
            </div>
          )}

          {valid === true && (
            <p className="text-subtle text-sm mt-1">
              You've been invited! Create your account.
            </p>
          )}
        </div>

        {valid === true && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Input
              id="username"
              name="username"
              label="Username"
              placeholder="Choose a username"
              autoComplete="username"
              autoFocus
              required
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Choose a password"
              autoComplete="new-password"
              required
            />

            <Input
              id="confirm"
              name="confirm"
              type="password"
              label="Confirm password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Join"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
