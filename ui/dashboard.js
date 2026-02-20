// ==========================================================
// Admin Dashboard
// ==========================================================

import * as api from './api.js';
import { escapeHtml, formatDate, showSettingsMsg } from './helpers.js';
import { state } from './app.js';

let currentDashTab = 'overview';

// --- Tab navigation ---

document.querySelectorAll('.dash-nav-item').forEach(item => {
    item.addEventListener('click', () => switchDashTab(item.dataset.tab));
});

function switchDashTab(tab) {
    currentDashTab = tab;
    document.querySelectorAll('.dash-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.dash-nav-item[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('dash-tab-' + tab)?.classList.add('active');

    if (tab === 'overview') loadOverview();
    else if (tab === 'models') loadAdminModels();
    else if (tab === 'chat') { loadUsers(); loadInvites(); }
    else if (tab === 'api') loadAPIKeys();
    else if (tab === 'settings') loadSettings();
}

export async function activateAdmin() {
    document.getElementById('dash-server-name').textContent = state.serverInfo?.server_name || 'Fireside';
    document.getElementById('dash-display-name').textContent = state.currentUser.display_name || state.currentUser.username;
    switchDashTab(currentDashTab);
}

// --- Mobile sidebar toggle ---

const dashSidebar = document.getElementById('dash-sidebar');
const dashSidebarToggle = document.getElementById('dash-sidebar-toggle');

dashSidebarToggle.addEventListener('click', () => dashSidebar.classList.toggle('open'));

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        dashSidebar.classList.contains('open') &&
        !dashSidebar.contains(e.target) &&
        e.target !== dashSidebarToggle) {
        dashSidebar.classList.remove('open');
    }
});

// ==========================================================
// Overview Tab
// ==========================================================

async function loadOverview() {
    try {
        const resp = await api.getAdminStats();
        const data = await resp.json();

        document.getElementById('stat-users').textContent = data.users;
        document.getElementById('stat-messages').textContent = data.messages_today;
        document.getElementById('stat-models').textContent = data.models;
        document.getElementById('stat-sessions').textContent = data.active_sessions;

        const gs = document.getElementById('getting-started');
        const allDone = data.has_models && data.has_messages && data.has_api_keys && data.has_invites;

        if (allDone) {
            gs.classList.add('hidden');
        } else {
            gs.classList.remove('hidden');
            updateCheckItem('check-model', data.has_models);
            updateCheckItem('check-message', data.has_messages);
            updateCheckItem('check-apikey', data.has_api_keys);
            updateCheckItem('check-invite', data.has_invites);
        }
    } catch {}
}

function updateCheckItem(id, done) {
    const el = document.getElementById(id);
    if (!el) return;
    if (done) {
        el.classList.add('done');
        el.querySelector('.check-icon').textContent = '✓';
    } else {
        el.classList.remove('done');
        el.querySelector('.check-icon').textContent = '○';
    }
}

// ==========================================================
// Models Tab
// ==========================================================

async function loadAdminModels() {
    const listEl = document.getElementById('models-list');

    try {
        const [modelsResp, runningResp] = await Promise.all([
            api.getAdminModels(),
            api.getRunningModels(),
        ]);
        const modelsData = await modelsResp.json();
        const runningData = await runningResp.json();

        const models = modelsData.models || [];
        const runningNames = new Set((runningData.models || []).map(m => m.name));

        if (models.length === 0) {
            listEl.innerHTML = '<p class="admin-empty">No models installed. Download one above.</p>';
            return;
        }

        listEl.innerHTML = models.map(m => {
            const size = (m.size / (1024 * 1024 * 1024)).toFixed(1);
            const loaded = runningNames.has(m.name);
            return `
                <div class="model-card">
                    <div class="model-info">
                        <div class="model-name">
                            ${escapeHtml(m.name)}
                            ${loaded ? '<span class="model-badge model-badge-loaded">Loaded</span>' : ''}
                        </div>
                        <div class="model-details">
                            ${m.details.parameter_size} · ${m.details.quantization_level} · ${size} GB · ${m.details.family}
                        </div>
                    </div>
                    <div class="model-actions">
                        <button class="btn-danger-sm" data-delete-model="${escapeHtml(m.name)}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach delete handlers
        listEl.querySelectorAll('[data-delete-model]').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteModel(btn.dataset.deleteModel));
        });
    } catch {
        listEl.innerHTML = '<p class="admin-empty">Failed to load models. Is Ollama running?</p>';
    }
}

async function confirmDeleteModel(name) {
    if (!confirm(`Delete model "${name}"? This cannot be undone.`)) return;
    try {
        const resp = await api.deleteModel(name);
        if (resp.ok) await loadAdminModels();
    } catch {}
}

// Pull model
document.getElementById('pull-model-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('model-pull-name');
    const name = nameInput.value.trim();
    if (!name) return;

    const progressEl = document.getElementById('pull-progress');
    const statusEl = document.getElementById('pull-status');
    const barEl = document.getElementById('pull-bar');
    const btn = document.getElementById('pull-model-btn');

    btn.disabled = true;
    progressEl.classList.remove('hidden');
    statusEl.textContent = 'Starting download...';
    barEl.style.width = '0%';

    try {
        const resp = await api.pullModel(name);
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') continue;

                try {
                    const data = JSON.parse(payload);
                    if (data.error) {
                        statusEl.textContent = `Error: ${data.error}`;
                        break;
                    }
                    statusEl.textContent = data.status || 'Downloading...';
                    if (data.total && data.completed) {
                        const pct = Math.round((data.completed / data.total) * 100);
                        barEl.style.width = pct + '%';
                    }
                } catch {}
            }
        }

        if (!statusEl.textContent.startsWith('Error')) {
            statusEl.textContent = 'Download complete!';
            barEl.style.width = '100%';
            nameInput.value = '';
            await loadAdminModels();
        }
    } catch {
        statusEl.textContent = 'Download failed. Check the model name and try again.';
    }

    btn.disabled = false;
    setTimeout(() => progressEl.classList.add('hidden'), 3000);
});

// ==========================================================
// Chat Tab (Users + Invites)
// ==========================================================

async function loadUsers() {
    try {
        const resp = await api.getAdminUsers();
        const data = await resp.json();
        const users = data.users || [];
        const tbody = document.getElementById('users-tbody');
        const empty = document.getElementById('users-empty');

        if (users.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${escapeHtml(u.display_name || u.username)}</td>
                <td>${u.is_admin ? '<span class="badge-admin">Admin</span>' : '<span class="badge-user">User</span>'}</td>
                <td>${formatDate(u.created_at)}</td>
            </tr>
        `).join('');
    } catch {}
}

async function loadInvites() {
    try {
        const resp = await api.getAdminInvites();
        const data = await resp.json();
        const invites = data.invites || [];
        const tbody = document.getElementById('invites-tbody');
        const empty = document.getElementById('invites-empty');

        if (invites.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = invites.map(inv => {
            const used = inv.uses >= inv.max_uses;
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const status = used ? 'Used' : expired ? 'Expired' : 'Pending';
            const statusClass = used || expired ? 'text-muted' : '';
            return `
                <tr class="${statusClass}">
                    <td class="mono">${escapeHtml(inv.token.substring(0, 8))}...</td>
                    <td>${status}</td>
                    <td>${inv.expires_at ? formatDate(inv.expires_at) : 'Never'}</td>
                    <td>${formatDate(inv.created_at)}</td>
                    <td>${!used && !expired ? `<button class="btn-danger-sm" data-revoke-invite="${inv.id}">Revoke</button>` : ''}</td>
                </tr>
            `;
        }).join('');

        // Attach revoke handlers
        tbody.querySelectorAll('[data-revoke-invite]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await api.deleteInviteAPI(btn.dataset.revokeInvite);
                await loadInvites();
            });
        });
    } catch {}
}

document.getElementById('create-invite-btn').addEventListener('click', async () => {
    const expiresIn = document.getElementById('invite-expires').value;

    try {
        const { resp, data } = await api.createInvite({ max_uses: 1, expires_in: expiresIn });
        if (!resp.ok) return;

        document.getElementById('invite-url-display').value = data.url;
        document.getElementById('invite-created').classList.remove('hidden');
        await loadInvites();
    } catch {}
});

document.getElementById('copy-invite-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('invite-url-display').value);
    const btn = document.getElementById('copy-invite-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
});

// ==========================================================
// API Keys Tab
// ==========================================================

async function loadAPIKeys() {
    try {
        const resp = await api.getAdminAPIKeys();
        const data = await resp.json();
        const keys = data.api_keys || [];
        const tbody = document.getElementById('apikeys-tbody');
        const empty = document.getElementById('apikeys-empty');

        if (keys.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>${escapeHtml(k.name)}</td>
                <td class="mono">${escapeHtml(k.key_prefix)}...</td>
                <td>${k.last_used_at ? formatDate(k.last_used_at) : 'Never'}</td>
                <td>${formatDate(k.created_at)}</td>
                <td><button class="btn-danger-sm" data-revoke-key="${k.id}">Revoke</button></td>
            </tr>
        `).join('');

        // Attach revoke handlers
        tbody.querySelectorAll('[data-revoke-key]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await api.deleteAPIKeyAPI(btn.dataset.revokeKey);
                await loadAPIKeys();
            });
        });
    } catch {}
}

document.getElementById('create-apikey-btn').addEventListener('click', async () => {
    const name = document.getElementById('apikey-name').value.trim() || 'default';

    try {
        const { resp, data } = await api.createAPIKey({ name });
        if (!resp.ok) return;

        document.getElementById('apikey-display').value = data.api_key;
        document.getElementById('apikey-created').classList.remove('hidden');
        await loadAPIKeys();
    } catch {}
});

document.getElementById('copy-apikey-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('apikey-display').value);
    const btn = document.getElementById('copy-apikey-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
});

// ==========================================================
// Settings Tab
// ==========================================================

async function loadSettings() {
    try {
        const resp = await api.getSettings();
        const data = await resp.json();
        document.getElementById('settings-server-name').value = data.server_name || '';
        document.getElementById('settings-tunnel-url').value = data.tunnel_url || '';
    } catch {}
}

document.getElementById('save-server-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('settings-server-name').value.trim();
    if (!name) return;
    try {
        const resp = await api.putSettings({ server_name: name });
        if (resp.ok) {
            state.serverInfo = { ...state.serverInfo, server_name: name };
            document.getElementById('dash-server-name').textContent = name;
            showSettingsMsg('settings-name-msg', 'Server name updated.', 'success');
        }
    } catch {
        showSettingsMsg('settings-name-msg', 'Failed to save.', 'error');
    }
});

document.getElementById('save-tunnel-url-btn').addEventListener('click', async () => {
    const url = document.getElementById('settings-tunnel-url').value.trim();
    try {
        const resp = await api.putSettings({ tunnel_url: url });
        if (resp.ok) {
            showSettingsMsg('settings-tunnel-msg', 'Tunnel URL updated.', 'success');
        }
    } catch {
        showSettingsMsg('settings-tunnel-msg', 'Failed to save.', 'error');
    }
});

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('settings-current-pw').value;
    const newPw = document.getElementById('settings-new-pw').value;

    try {
        const { resp, data } = await api.putAdminPassword({ current_password: current, new_password: newPw });
        if (resp.ok) {
            showSettingsMsg('settings-pw-msg', 'Password updated.', 'success');
            document.getElementById('settings-current-pw').value = '';
            document.getElementById('settings-new-pw').value = '';
        } else {
            showSettingsMsg('settings-pw-msg', data.error || 'Failed to update.', 'error');
        }
    } catch {
        showSettingsMsg('settings-pw-msg', 'Connection failed.', 'error');
    }
});
