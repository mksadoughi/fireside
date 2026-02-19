// --- State ---
let currentUser = null;
let currentConversationId = null;
let isStreaming = false;
let conversations = [];

// --- DOM refs ---
const loginPage = document.getElementById('login-page');
const setupPage = document.getElementById('setup-page');
const chatPage = document.getElementById('chat-page');
const loginForm = document.getElementById('login-form');
const setupForm = document.getElementById('setup-form');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const welcomeMsg = document.getElementById('welcome-msg');
const convoList = document.getElementById('conversation-list');
const modelSelect = document.getElementById('model-select');
const displayName = document.getElementById('display-name');
const serverNameEl = document.getElementById('server-name');
const loginServerName = document.getElementById('login-server-name');
const footerText = document.getElementById('footer-text');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

// --- Init ---
async function init() {
    try {
        // Check if already logged in
        const meResp = await fetch('/api/auth/me');
        if (meResp.ok) {
            const data = await meResp.json();
            currentUser = data.user;
            await enterChat();
            return;
        }

        // Check if setup is needed
        const setupResp = await fetch('/api/setup/status');
        const setupData = await setupResp.json();
        if (!setupData.setup_complete) {
            showPage('setup');
        } else {
            showPage('login');
        }
    } catch {
        showPage('login');
    }
}

function showPage(page) {
    loginPage.classList.add('hidden');
    setupPage.classList.add('hidden');
    chatPage.classList.add('hidden');
    document.getElementById('admin-page').classList.add('hidden');

    if (page === 'login') loginPage.classList.remove('hidden');
    else if (page === 'setup') setupPage.classList.remove('hidden');
    else if (page === 'chat') chatPage.classList.remove('hidden');
    else if (page === 'admin') document.getElementById('admin-page').classList.remove('hidden');
}

// --- Setup ---
setupForm.addEventListener('submit', async (e) => {
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
        await enterChat();
    } catch {
        showError('setup-error', 'Connection failed');
    }
});

// --- Login ---
loginForm.addEventListener('submit', async (e) => {
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
                showPage('setup');
                return;
            }
            showError('login-error', data.error || 'Login failed');
            return;
        }
        currentUser = data.user;
        await enterChat();
    } catch {
        showError('login-error', 'Connection failed');
    }
});

// --- Enter chat ---
async function enterChat() {
    showPage('chat');
    displayName.textContent = currentUser.display_name || currentUser.username;

    // Show admin button if user is admin
    const adminBtn = document.getElementById('admin-btn');
    if (currentUser.is_admin) {
        adminBtn.classList.remove('hidden');
    } else {
        adminBtn.classList.add('hidden');
    }

    // Load server name
    try {
        const resp = await fetch('/health');
        if (resp.ok) {
            const data = await resp.json();
            if (data.server_name) {
                serverNameEl.textContent = data.server_name;
                footerText.textContent = `Private AI · ${data.server_name}`;
            }
        }
    } catch {}

    await loadModels();
    await loadConversations();
    chatInput.focus();
}

// --- Models ---
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

// --- Conversations ---
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
    welcomeMsg?.remove();

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

// --- Chat ---
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

// Auto-resize textarea
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isStreaming) return;

    // Remove welcome message
    document.getElementById('welcome-msg')?.remove();

    // Show user message
    appendMessage('user', text);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    scrollToBottom();

    // Prepare request
    const body = {
        model: modelSelect.value,
        message: text,
    };
    if (currentConversationId) {
        body.conversation_id = currentConversationId;
    }

    isStreaming = true;
    sendBtn.disabled = true;

    // Create assistant message placeholder
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
    } catch (err) {
        textEl.textContent = 'Error: Failed to get response';
        textEl.classList.remove('streaming-cursor');
    }

    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.focus();
}

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    currentConversationId = null;
    conversations = [];
    showPage('login');
});

// --- New chat ---
document.getElementById('new-chat-btn').addEventListener('click', startNewChat);

// --- Admin Dashboard ---
const adminPage = document.getElementById('admin-page');
const adminBtn = document.getElementById('admin-btn');
const adminBackBtn = document.getElementById('admin-back-btn');

adminBtn.addEventListener('click', () => openAdmin());
adminBackBtn.addEventListener('click', () => {
    showPage('chat');
});

// Admin tabs
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
});

async function openAdmin() {
    showPage('admin');
    await Promise.all([loadInvites(), loadAPIKeys(), loadUsers()]);
}

// --- Invites ---
document.getElementById('create-invite-btn').addEventListener('click', async () => {
    const maxUses = parseInt(document.getElementById('invite-max-uses').value) || 1;
    const expiresIn = document.getElementById('invite-expires').value;

    try {
        const resp = await fetch('/api/admin/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_uses: maxUses, expires_in: expiresIn }),
        });
        const data = await resp.json();
        if (!resp.ok) return;

        const urlDisplay = document.getElementById('invite-url-display');
        urlDisplay.value = data.url;
        document.getElementById('invite-created').classList.remove('hidden');

        await loadInvites();
    } catch {}
});

document.getElementById('copy-invite-btn').addEventListener('click', () => {
    const urlDisplay = document.getElementById('invite-url-display');
    navigator.clipboard.writeText(urlDisplay.value);
    document.getElementById('copy-invite-btn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copy-invite-btn').textContent = 'Copy', 2000);
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
        tbody.innerHTML = invites.map(inv => `
            <tr>
                <td class="mono">${escapeHtml(inv.token.substring(0, 12))}...</td>
                <td>${inv.uses} / ${inv.max_uses}</td>
                <td>${inv.expires_at ? formatDate(inv.expires_at) : 'Never'}</td>
                <td>${formatDate(inv.created_at)}</td>
                <td><button class="btn-danger-sm" onclick="deleteInvite(${inv.id})">Revoke</button></td>
            </tr>
        `).join('');
    } catch {}
}

async function deleteInvite(id) {
    await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
    await loadInvites();
}

// --- API Keys ---
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

        const keyDisplay = document.getElementById('apikey-display');
        keyDisplay.value = data.api_key;
        document.getElementById('apikey-created').classList.remove('hidden');

        await loadAPIKeys();
    } catch {}
});

document.getElementById('copy-apikey-btn').addEventListener('click', () => {
    const keyDisplay = document.getElementById('apikey-display');
    navigator.clipboard.writeText(keyDisplay.value);
    document.getElementById('copy-apikey-btn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copy-apikey-btn').textContent = 'Copy', 2000);
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

// --- Users ---
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

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Sidebar toggle (mobile) ---
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle) {
        sidebar.classList.remove('open');
    }
});

// --- Helpers ---
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

// --- Start ---
init();
