// API layer — all fetch calls in one place

async function fetchJSON<T = unknown>(
  url: string,
  opts: RequestInit = {}
): Promise<{ resp: Response; data: T }> {
  const resp = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  const data = (await resp.json()) as T;
  return { resp, data };
}

// Auth
export const getMe = () => fetch("/api/auth/me");
export const getSetupStatus = () => fetch("/api/setup/status");

export const postSetup = (body: {
  server_name: string;
  username: string;
  password: string;
}) =>
  fetchJSON<{ user: import("./types").User }>("/api/setup", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postLogin = (body: { username: string; password: string }) =>
  fetchJSON<{ user: import("./types").User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postLogout = () => fetch("/api/auth/logout", { method: "POST" });

export const postRegister = (body: {
  token: string;
  username: string;
  password: string;
}) =>
  fetchJSON<{ user: import("./types").User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getInvite = (token: string) =>
  fetch(`/api/invite/${encodeURIComponent(token)}`);

// Chat
export const getModels = () => fetch("/api/models");
export const getConversations = () => fetch("/api/conversations");
export const getConversation = (id: number) =>
  fetch(`/api/conversations/${id}`);
export const deleteConversation = (id: number) =>
  fetch(`/api/conversations/${id}`, { method: "DELETE" });

export const postChatStream = (body: {
  model: string;
  message: string;
  conversation_id?: number | null;
  encrypted?: boolean;
  iv?: string;
}) =>
  fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Server status (public)
export const getServerStatus = () => fetch("/api/status");

// Admin
export const getAdminStats = () => fetch("/api/admin/stats");
export const getHardware = () => fetch("/api/admin/hardware");
export const getRunningModels = () => fetch("/api/admin/models/running");

// Admin: Pause
export const getPauseState = () => fetch("/api/admin/pause");
export const setPauseState = (paused: boolean) =>
  fetch("/api/admin/pause", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused }),
  });

export const pullModel = (name: string) =>
  fetch("/api/admin/models/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteModel = (name: string) =>
  fetch("/api/admin/models", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const getAdminInvites = () => fetch("/api/admin/invites");
export const createInvite = (body: { max_uses: number; expires_in: string }) =>
  fetchJSON<{ url: string }>("/api/admin/invites", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const deleteInvite = (id: number) =>
  fetch(`/api/admin/invites/${id}`, { method: "DELETE" });

export const getAdminUsers = () => fetch("/api/admin/users");
export const deleteUser = (id: number) =>
  fetch(`/api/admin/users/${id}`, { method: "DELETE" });
export const resetUserPassword = (id: number, newPassword: string) =>
  fetchJSON(`/api/admin/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ new_password: newPassword }),
  });

export const getAdminAPIKeys = () => fetch("/api/admin/api-keys");
export const createAPIKey = (body: { name: string }) =>
  fetchJSON<{ api_key: string }>("/api/admin/api-keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const deleteAPIKey = (id: number) =>
  fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });

export const getSettings = () => fetch("/api/admin/settings");
export const putSettings = (body: Record<string, string>) =>
  fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const changeAdminPassword = (body: {
  current_password: string;
  new_password: string;
}) =>
  fetchJSON("/api/admin/password", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const postResetServer = () =>
  fetchJSON("/api/admin/reset", { method: "POST" });

export const tunnelCheck = (name: string) =>
  fetchJSON<{ available: boolean; suggestions?: string[] }>("/api/admin/tunnel/check", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const tunnelClaim = (name: string) =>
  fetchJSON<{ subdomain: string; tunnel_token: string; tunnel_name: string }>("/api/admin/tunnel/claim", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
