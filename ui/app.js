// --- State ---
let currentUser = null;
let setupComplete = null;
let serverInfo = null;
let currentConversationId = null;
let isStreaming = false;
let conversations = [];

// --- DOM refs ---
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const convoList = document.getElementById('conversation-list');
const modelSelect = document.getElementById('model-select');
const displayName = document.getElementById('display-name');
const serverNameEl = document.getElementById('server-name');
const footerText = document.getElementById('footer-text');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

// ==========================================================
// Router
// ==========================================================

function navigate(path) {
    if (window.location.pathname !== '/') {
        window.location.href = '/#' + path;
        return;
    }
    window.location.hash = path;
}

async function handleRoute() {
    if (window.location.pathname.startsWith('/invite/')) {
        const token = window.location.pathname.slice('/invite/'.length);
        if (currentUser) {
            window.location.replace('/#/chat');
            return;
        }
        showPage('invite');
        await activateInvite(token);
        return;
    }

    const hash = window.location.hash.slice(1) || '';

    if (!currentUser) {
        if (!setupComplete) {
            showPage('setup');
            history.replaceState(null, '', '#/setup');
            return;
        }
        showPage('login');
        history.replaceState(null, '', '#/login');
        updateLoginServerName();
        return;
    }

    if (hash === '/chat') {
        showPage('chat');
        await activateChat();
        return;
    }

    if (hash === '/dashboard') {
        if (!currentUser.is_admin) {
            history.replaceState(null, '', '#/chat');
            showPage('chat');
            await activateChat();
            return;
        }
        showPage('admin');
        await activateAdmin();
        return;
    }

    const defaultPath = currentUser.is_admin ? '/dashboard' : '/chat';
    history.replaceState(null, '', '#' + defaultPath);
    if (defaultPath === '/dashboard') {
        showPage('admin');
        await activateAdmin();
    } else {
        showPage('chat');
        await activateChat();
    }
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const map = {
        login: 'login-page',
        setup: 'setup-page',
        chat: 'chat-page',
        admin: 'admin-page',
        invite: 'invite-page',
    };
    const el = document.getElementById(map[page]);
    if (el) el.classList.remove('hidden');
}

function updateLoginServerName() {
    const el = document.getElementById('login-server-name');
    if (el && serverInfo?.server_name) {
        el.textContent = serverInfo.server_name;
    }
}

// ==========================================================
// Init
// ==========================================================

async function init() {
    try {
        const resp = await fetch('/api/auth/me');
        if (resp.ok) {
            currentUser = (await resp.json()).user;
        }
    } catch {}

    if (!currentUser) {
        try {
            const resp = await fetch('/api/setup/status');
            setupComplete = (await resp.json()).setup_complete;
        } catch {
            setupComplete = true;
        }
    } else {
        setupComplete = true;
    }

    try {
        const resp = await fetch('/health');
        if (resp.ok) serverInfo = await resp.json();
    } catch {}

    await handleRoute();
}

// ==========================================================
// Setup (2-step wizard)
// ==========================================================

document.getElementById('setup-get-started').addEventListener('click', () => {
    document.getElementById('setup-step-1').classList.add('hidden');
    document.getElementById('setup-step-2').classList.remove('hidden');
});

document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverName = document.getElementById('setup-server-name').value.trim();
    const username = document.getElementById('setup-username').value.trim();
    const password = document.getElementById('setup-password').value;

    try {
        const resp = await fetch('/api/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server_name: serverName, username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError('setup-error', data.error);
            return;
        }
        currentUser = data.user;
        setupComplete = true;
        serverInfo = { status: 'ok', server_name: serverName };
        navigate('/dashboard');
    } catch {
        showError('setup-error', 'Connection failed');
    }
});

// ==========================================================
// Login
// ==========================================================

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            if (data.error && data.error.includes('setup')) {
                setupComplete = false;
                navigate('/setup');
                return;
            }
            showError('login-error', data.error || 'Login failed');
            return;
        }
        currentUser = data.user;
        navigate(currentUser.is_admin ? '/dashboard' : '/chat');
    } catch {
        showError('login-error', 'Connection failed');
    }
});

// ==========================================================
// Invite Registration
// ==========================================================

async function activateInvite(token) {
    const nameEl = document.getElementById('invite-server-name');
    const messageEl = document.getElementById('invite-message');
    const formContainer = document.getElementById('invite-form-container');
    const invalidEl = document.getElementById('invite-invalid');

    formContainer.classList.add('hidden');
    invalidEl.classList.add('hidden');
    messageEl.textContent = 'Checking invite...';
    nameEl.textContent = '';

    try {
        const resp = await fetch(`/api/invite/${encodeURIComponent(token)}`);
        const data = await resp.json();

        if (!data.valid) {
            nameEl.textContent = 'Fireside';
            messageEl.textContent = '';
            invalidEl.classList.remove('hidden');
            return;
        }

        nameEl.textContent = data.server_name || 'Fireside';
        messageEl.textContent = "You've been invited! Create your account.";
        formContainer.classList.remove('hidden');
        document.getElementById('invite-form').dataset.token = token;
    } catch {
        nameEl.textContent = 'Fireside';
        messageEl.textContent = 'Failed to validate invite. Please try again.';
    }
}

document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = e.target.dataset.token;
    const username = document.getElementById('invite-username').value.trim();
    const password = document.getElementById('invite-password').value;

    const submitBtn = document.getElementById('invite-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
        const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError('invite-error', data.error || 'Registration failed');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Join';
            return;
        }
        currentUser = data.user;
        window.location.replace('/#/chat');
    } catch {
        showError('invite-error', 'Connection failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join';
    }
});

// ==========================================================
// Chat
// ==========================================================

async function activateChat() {
    displayName.textContent = currentUser.display_name || currentUser.username;

    const adminBtn = document.getElementById('admin-btn');
    adminBtn.classList.toggle('hidden', !currentUser.is_admin);

    if (serverInfo?.server_name) {
        serverNameEl.textContent = serverInfo.server_name;
        footerText.textContent = `Private AI · ${serverInfo.server_name}`;
    }

    await loadModels();
    await loadConversations();
    chatInput.focus();
}

async function loadModels() {
    try {
        const resp = await fetch('/api/models');
        const data = await resp.json();
        modelSelect.innerHTML = '';
        for (const m of data.models || []) {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = `${m.name} (${m.details.parameter_size})`;
            modelSelect.appendChild(opt);
        }
    } catch {}
}

async function loadConversations() {
    try {
        const resp = await fetch('/api/conversations');
        const data = await resp.json();
        conversations = data.conversations || [];
        renderConversations();
    } catch {}
}

function renderConversations() {
    convoList.innerHTML = '';
    for (const c of conversations) {
        const div = document.createElement('div');
        div.className = 'convo-item' + (c.id === currentConversationId ? ' active' : '');
        div.innerHTML = `
            <span class="convo-title">${escapeHtml(c.title)}</span>
            <button class="convo-delete" data-id="${c.id}" title="Delete">✕</button>
        `;
        div.querySelector('.convo-title').addEventListener('click', () => openConversation(c.id));
        div.querySelector('.convo-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(c.id);
        });
        convoList.appendChild(div);
    }
}

async function openConversation(id) {
    currentConversationId = id;
    renderConversations();
    messagesDiv.innerHTML = '';
    document.getElementById('welcome-msg')?.remove();

    try {
        const resp = await fetch(`/api/conversations/${id}`);
        const data = await resp.json();
        for (const msg of data.messages || []) {
            appendMessage(msg.role, msg.content);
        }
        scrollToBottom();
    } catch {}
}

async function deleteConversation(id) {
    try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        if (currentConversationId === id) {
            currentConversationId = null;
            messagesDiv.innerHTML = '';
            showWelcome();
        }
        await loadConversations();
    } catch {}
}

function startNewChat() {
    currentConversationId = null;
    messagesDiv.innerHTML = '';
    showWelcome();
    renderConversations();
    chatInput.focus();
}

function showWelcome() {
    const welcome = document.createElement('div');
    welcome.id = 'welcome-msg';
    welcome.className = 'welcome-message';
    welcome.innerHTML = '<div class="welcome-icon">🔥</div><h2>How can I help you?</h2>';
    messagesDiv.appendChild(welcome);
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isStreaming) return;

    document.getElementById('welcome-msg')?.remove();
    appendMessage('user', text);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    scrollToBottom();

    const body = { model: modelSelect.value, message: text };
    if (currentConversationId) body.conversation_id = currentConversationId;

    isStreaming = true;
    sendBtn.disabled = true;

    const { textEl } = appendMessage('assistant', '');
    textEl.classList.add('streaming-cursor');

    try {
        const resp = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

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
                    if (data.conversation_id && !currentConversationId) {
                        currentConversationId = data.conversation_id;
                        continue;
                    }
                    if (data.content) {
                        fullText += data.content;
                        textEl.textContent = fullText;
                        scrollToBottom();
                    }
                } catch {}
            }
        }

        textEl.classList.remove('streaming-cursor');
        await loadConversations();
    } catch {
        textEl.textContent = 'Error: Failed to get response';
        textEl.classList.remove('streaming-cursor');
    }

    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.focus();
}

// ==========================================================
// Logout (from chat sidebar and dashboard sidebar)
// ==========================================================

async function doLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    currentConversationId = null;
    conversations = [];
    navigate('/login');
}

document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('dash-logout-btn').addEventListener('click', doLogout);

// ==========================================================
// Navigation buttons
// ==========================================================

document.getElementById('new-chat-btn').addEventListener('click', startNewChat);
document.getElementById('admin-btn').addEventListener('click', () => navigate('/dashboard'));

// ==========================================================
// Admin Dashboard
// ==========================================================

let currentDashTab = 'overview';

// Dashboard sidebar nav
document.querySelectorAll('.dash-nav-item').forEach(item => {
    item.addEventListener('click', () => {
        switchDashTab(item.dataset.tab);
    });
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

async function activateAdmin() {
    document.getElementById('dash-server-name').textContent = serverInfo?.server_name || 'Fireside';
    document.getElementById('dash-display-name').textContent = currentUser.display_name || currentUser.username;
    switchDashTab(currentDashTab);
}

// --- Dashboard mobile sidebar toggle ---
const dashSidebar = document.getElementById('dash-sidebar');
const dashSidebarToggle = document.getElementById('dash-sidebar-toggle');

dashSidebarToggle.addEventListener('click', () => {
    dashSidebar.classList.toggle('open');
});

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
        const resp = await fetch('/api/admin/stats');
        const data = await resp.json();

        document.getElementById('stat-users').textContent = data.users;
        document.getElementById('stat-messages').textContent = data.messages_today;
        document.getElementById('stat-models').textContent = data.models;
        document.getElementById('stat-sessions').textContent = data.active_sessions;

        // Update getting started checklist
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
            fetch('/api/models'),
            fetch('/api/admin/models/running'),
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
                        <button class="btn-danger-sm" onclick="confirmDeleteModel('${escapeHtml(m.name)}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch {
        listEl.innerHTML = '<p class="admin-empty">Failed to load models. Is Ollama running?</p>';
    }
}

async function confirmDeleteModel(name) {
    if (!confirm(`Delete model "${name}"? This cannot be undone.`)) return;

    try {
        const resp = await fetch('/api/admin/models', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (resp.ok) {
            await loadAdminModels();
        }
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
        const resp = await fetch('/api/admin/models/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });

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
// Invites Tab
// ==========================================================

document.getElementById('create-invite-btn').addEventListener('click', async () => {
    const maxUses = 1;
    const expiresIn = document.getElementById('invite-expires').value;

    try {
        const resp = await fetch('/api/admin/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_uses: maxUses, expires_in: expiresIn }),
        });
        const data = await resp.json();
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

async function loadInvites() {
    try {
        const resp = await fetch('/api/admin/invites');
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
                    <td>${!used && !expired ? `<button class="btn-danger-sm" onclick="deleteInvite(${inv.id})">Revoke</button>` : ''}</td>
                </tr>
            `;
        }).join('');
    } catch {}
}

async function deleteInvite(id) {
    await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
    await loadInvites();
}

// ==========================================================
// API Keys Tab
// ==========================================================

document.getElementById('create-apikey-btn').addEventListener('click', async () => {
    const name = document.getElementById('apikey-name').value.trim() || 'default';

    try {
        const resp = await fetch('/api/admin/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const data = await resp.json();
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

async function loadAPIKeys() {
    try {
        const resp = await fetch('/api/admin/api-keys');
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
                <td><button class="btn-danger-sm" onclick="deleteAPIKey(${k.id})">Revoke</button></td>
            </tr>
        `).join('');
    } catch {}
}

async function deleteAPIKey(id) {
    await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    await loadAPIKeys();
}

// ==========================================================
// Users Tab
// ==========================================================

async function loadUsers() {
    try {
        const resp = await fetch('/api/admin/users');
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

// ==========================================================
// Settings Tab
// ==========================================================

async function loadSettings() {
    try {
        const resp = await fetch('/api/admin/settings');
        const data = await resp.json();
        document.getElementById('settings-server-name').value = data.server_name || '';
        document.getElementById('settings-tunnel-url').value = data.tunnel_url || '';
    } catch {}
}

function showSettingsMsg(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'settings-msg ' + type;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

document.getElementById('save-server-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('settings-server-name').value.trim();
    if (!name) return;
    try {
        const resp = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server_name: name }),
        });
        if (resp.ok) {
            serverInfo = { ...serverInfo, server_name: name };
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
        const resp = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tunnel_url: url }),
        });
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
        const resp = await fetch('/api/admin/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: newPw }),
        });
        const data = await resp.json();
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

// ==========================================================
// Chat sidebar toggle (mobile)
// ==========================================================

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle) {
        sidebar.classList.remove('open');
    }
});

// ==========================================================
// Helpers
// ==========================================================

function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;

    const avatar = role === 'user' ? '👤' : '🔥';
    const label = role === 'user' ? (currentUser?.display_name || 'You') : 'AI';

    div.innerHTML = `
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
            <div class="msg-role">${label}</div>
            <div class="msg-text"></div>
        </div>
    `;

    const textEl = div.querySelector('.msg-text');
    textEl.textContent = content;
    messagesDiv.appendChild(div);
    return { div, textEl };
}

function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ==========================================================
// Hash change listener + start
// ==========================================================

window.addEventListener('hashchange', () => handleRoute());
init();
