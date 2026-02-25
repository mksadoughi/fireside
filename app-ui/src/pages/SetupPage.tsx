import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SetupPage() {
  const navigate = useNavigate();
  const setup = useAuthStore((s) => s.setup);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const form = e.target as HTMLFormElement;
    const serverName = (form.elements.namedItem("serverName") as HTMLInputElement).value.trim();
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await setup(serverName, username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {step === 1 ? (
          <div className="text-center">
            <Logo className="w-12 h-12 mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-2">Welcome to Fireside</h1>
            <p className="text-subtle mb-8">
              Your private AI server. Let's set things up.
            </p>
            <Button onClick={() => setStep(2)} className="w-full" size="lg">
              Get Started
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <Logo className="w-10 h-10 mx-auto mb-4" />
              <h1 className="text-2xl font-bold">Create your server</h1>
              <p className="text-muted text-sm mt-1">
                Set up your admin account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <Input
                id="serverName"
                name="serverName"
                label="Server name"
                placeholder="My AI Server"
                autoFocus
                required
              />

              <Input
                id="username"
                name="username"
                label="Admin username"
                placeholder="admin"
                autoComplete="username"
                required
              />

              <Input
                id="password"
                name="password"
                type="password"
                label="Password"
                placeholder="Choose a strong password"
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
                {loading ? "Creating..." : "Create Server"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
