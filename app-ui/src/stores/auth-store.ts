import { create } from "zustand";
import type { User, ServerInfo } from "@/lib/types";
import * as api from "@/lib/api";
import { saveKey, clearKey } from "@/lib/keystore";

interface AuthState {
  user: User | null;
  serverInfo: ServerInfo | null;
  setupComplete: boolean | null;
  loading: boolean;

  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (
    serverName: string,
    username: string,
    password: string
  ) => Promise<void>;
  register: (
    token: string,
    username: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  setServerInfo: (info: ServerInfo) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  serverInfo: null,
  setupComplete: null,
  loading: true,

  init: async () => {
    try {
      const [meResp, setupResp, statusResp] = await Promise.all([
        api.getMe(),
        api.getSetupStatus(),
        api.getServerStatus(),
      ]);

      let user: User | null = null;
      if (meResp.ok) {
        const meData = (await meResp.json()) as { user: User };
        user = meData.user;
      }

      let setupComplete = false;
      if (setupResp.ok) {
        const setupData = (await setupResp.json()) as {
          setup_complete: boolean;
        };
        setupComplete = setupData.setup_complete;
      }

      let serverInfo: ServerInfo | null = null;
      if (statusResp.ok) {
        serverInfo = (await statusResp.json()) as ServerInfo;
      }

      set({ user, setupComplete, serverInfo, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  login: async (username, password) => {
    const { resp, data } = await api.postLogin({ username, password });
    if (!resp.ok) {
      const msg =
        (data as { error?: string }).error || "Login failed";
      throw new Error(msg);
    }
    const user = data.user;
    if (user.encryption_key) {
      await saveKey(user.encryption_key);
    }
    set({ user, setupComplete: true });
  },

  setup: async (serverName, username, password) => {
    const { resp, data } = await api.postSetup({
      server_name: serverName,
      username,
      password,
    });
    if (!resp.ok) {
      const msg =
        (data as { error?: string }).error || "Setup failed";
      throw new Error(msg);
    }
    const user = data.user;
    if (user.encryption_key) {
      await saveKey(user.encryption_key);
    }

    // Refresh server info
    const statusResp = await api.getServerStatus();
    let serverInfo: ServerInfo | null = null;
    if (statusResp.ok) {
      serverInfo = (await statusResp.json()) as ServerInfo;
    }

    set({ user, setupComplete: true, serverInfo });
  },

  register: async (token, username, password) => {
    const { resp, data } = await api.postRegister({
      token,
      username,
      password,
    });
    if (!resp.ok) {
      const msg =
        (data as { error?: string }).error || "Registration failed";
      throw new Error(msg);
    }
    const user = data.user;
    if (user.encryption_key) {
      await saveKey(user.encryption_key);
    }
    set({ user, setupComplete: true });
  },

  logout: async () => {
    await api.postLogout();
    await clearKey();
    set({ user: null });
  },

  setServerInfo: (info) => set({ serverInfo: info }),
}));
