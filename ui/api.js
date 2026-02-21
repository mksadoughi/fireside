// ==========================================================
// API layer — all fetch calls in one place
// ==========================================================

export async function fetchJSON(url, opts = {}) {
    const resp = await fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    const data = await resp.json();
    return { resp, data };
}

// Auth
export const getMe = () => fetch('/api/auth/me');
export const getSetupStatus = () => fetch('/api/setup/status');
export const getHealth = () => fetch('/health');
export const postSetup = (body) => fetchJSON('/api/setup', { method: 'POST', body: JSON.stringify(body) });
export const postLogin = (body) => fetchJSON('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
export const postLogout = () => fetch('/api/auth/logout', { method: 'POST' });
export const postRegister = (body) => fetchJSON('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
export const getInvite = (token) => fetch(`/api/invite/${encodeURIComponent(token)}`);

// Chat
export const getModels = () => fetch('/api/models');
export const getConversations = () => fetch('/api/conversations');
export const getConversation = (id) => fetch(`/api/conversations/${id}`);
export const deleteConversationAPI = (id) => fetch(`/api/conversations/${id}`, { method: 'DELETE' });
export const postChatStream = (body) => fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// Admin
export const getAdminStats = () => fetch('/api/admin/stats');
export const getAdminModels = () => fetch('/api/models');
export const getRunningModels = () => fetch('/api/admin/models/running');
export const pullModel = (name) => fetch('/api/admin/models/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
});
export const deleteModel = (name) => fetch('/api/admin/models', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
});
export const getAdminInvites = () => fetch('/api/admin/invites');
export const createInvite = (body) => fetchJSON('/api/admin/invites', { method: 'POST', body: JSON.stringify(body) });
export const deleteInviteAPI = (id) => fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
export const getAdminUsers = () => fetch('/api/admin/users');
export const getAdminAPIKeys = () => fetch('/api/admin/api-keys');
export const createAPIKey = (body) => fetchJSON('/api/admin/api-keys', { method: 'POST', body: JSON.stringify(body) });
export const deleteAPIKeyAPI = (id) => fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
export const getSettings = () => fetch('/api/admin/settings');
export const putSettings = (body) => fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
export const putAdminPassword = (body) => fetchJSON('/api/admin/password', {
    method: 'PUT',
    body: JSON.stringify(body),
});
export const postResetServer = () => fetchJSON('/api/admin/reset', { method: 'POST' });
