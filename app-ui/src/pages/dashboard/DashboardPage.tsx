import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./OverviewTab";
import { ModelsTab } from "./ModelsTab";
import { UsersTab } from "./UsersTab";
import { ApiKeysTab } from "./ApiKeysTab";
import { SettingsTab } from "./SettingsTab";
import {
  BarChart3,
  Box,
  Key,
  Settings,
  Users,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PauseToggle } from "@/components/PauseToggle";

type Tab = "overview" | "models" | "users" | "api" | "settings";

const tabs: { id: Tab; label: string; icon: React.ReactNode; section?: string }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 size={16} /> },
  { id: "models", label: "Models", icon: <Box size={16} /> },
  { id: "users", label: "Users", icon: <Users size={16} /> },
  { id: "api", label: "API Keys", icon: <Key size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

export function DashboardPage() {
  const serverInfo = useAuthStore((s) => s.serverInfo);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  let lastSection = "";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col w-64 bg-background border-r border-border shrink-0",
          "fixed inset-y-0 left-0 z-40 md:static md:z-auto",
          "transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">
          <Logo className="w-5 h-5 text-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">
            {serverInfo?.server_name || "Fireside"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <PauseToggle />
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-muted hover:text-foreground cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {tabs.map((tab) => {
            const showSection = tab.section && tab.section !== lastSection;
            if (tab.section) lastSection = tab.section;
            return (
              <div key={tab.id}>
                {showSection && (
                  <div className="px-3 pt-4 pb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                    {tab.section}
                  </div>
                )}
                <button
                  onClick={() => switchTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer",
                    activeTab === tab.id
                      ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  )}
                >
                  <div className={cn("flex-shrink-0", activeTab === tab.id ? "text-foreground" : "text-subtle")}>{tab.icon}</div>
                  {tab.label}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer with User Dropdown */}
        <div className="p-4 border-t border-border/50">
          <UserDropdown />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Mobile header (or desktop top bar) */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-muted hover:text-foreground cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <span className="font-medium text-sm text-foreground capitalize">
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => window.open("/chat", "_blank")}
              className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Launch Chat
              <ExternalLink size={14} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-5xl">
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "models" && <ModelsTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "api" && <ApiKeysTab />}
            {activeTab === "settings" && <SettingsTab />}
          </div>
        </div>
      </main>
    </div>
  );
}
