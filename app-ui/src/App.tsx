import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Logo } from "@/components/Logo";
import { LoginPage } from "@/pages/LoginPage";
import { SetupPage } from "@/pages/SetupPage";
import { InvitePage } from "@/pages/InvitePage";
import { ChatPage } from "@/pages/chat/ChatPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ThemeProvider } from "@/components/ThemeProvider";

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center">
        <Logo className="w-10 h-10 mx-auto mb-4 animate-pulse" />
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AuthGuard({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const setupComplete = useAuthStore((s) => s.setupComplete);

  if (!setupComplete) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/chat" replace />;

  return <>{children}</>;
}

export function App() {
  const init = useAuthStore((s) => s.init);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const setupComplete = useAuthStore((s) => s.setupComplete);

  useEffect(() => {
    init();
  }, [init]);

  if (loading) return <LoadingScreen />;

  const defaultRoute = user
    ? user.is_admin
      ? "/dashboard"
      : "/chat"
    : setupComplete === false
      ? "/setup"
      : "/login";

  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <div className="min-h-dvh bg-background text-foreground transition-colors duration-200">
        <OfflineBanner />
        <Routes>
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route
            path="/setup"
            element={
              setupComplete === false ? (
                <SetupPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={user.is_admin ? "/dashboard" : "/chat"} replace />
              ) : setupComplete === false ? (
                <Navigate to="/setup" replace />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/chat"
            element={
              <AuthGuard>
                <ChatPage />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthGuard adminOnly>
                <DashboardPage />
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}
