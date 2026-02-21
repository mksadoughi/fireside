// ==========================================================
// App entry point — state, router, init
// ==========================================================

import * as api from './api.js';
import { activateInvite } from './auth.js';
import { activateChat } from './chat.js';
import { activateAdmin } from './dashboard.js';

// --- Shared state (imported by other modules) ---
export const state = {
    currentUser: null,
    setupComplete: null,
    serverInfo: null,
    currentConversationId: null,
};

// ==========================================================
// Router
// ==========================================================

export function navigate(path) {
    if (window.location.pathname !== '/') {
        window.location.href = '/#' + path;
        return;
    }
    window.location.hash = path;
}

async function handleRoute() {
    if (window.location.pathname.startsWith('/invite/')) {
        const token = window.location.pathname.slice('/invite/'.length);
        if (state.currentUser) {
            window.location.replace('/#/chat');
            return;
        }
        showPage('invite');
        await activateInvite(token);
        return;
    }

    const hash = window.location.hash.slice(1) || '';

    if (!state.currentUser) {
        if (!state.setupComplete) {
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
        if (!state.currentUser.is_admin) {
            history.replaceState(null, '', '#/chat');
            showPage('chat');
            await activateChat();
            return;
        }
        showPage('admin');
        await activateAdmin();
        return;
    }

    const defaultPath = state.currentUser.is_admin ? '/dashboard' : '/chat';
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
    if (el && state.serverInfo?.server_name) {
        el.textContent = state.serverInfo.server_name;
    }
}

// ==========================================================
// Logout
// ==========================================================

async function doLogout() {
    await api.postLogout();
    state.currentUser = null;
    state.currentConversationId = null;
    navigate('/login');
}

document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('dash-logout-btn').addEventListener('click', doLogout);

// ==========================================================
// Navigation buttons
// ==========================================================

document.getElementById('admin-btn').addEventListener('click', () => navigate('/dashboard'));

// ==========================================================
// Chat sidebar toggle (mobile)
// ==========================================================

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle) {
        sidebar.classList.remove('open');
    }
});

// ==========================================================
// Init
// ==========================================================

async function init() {
    try {
        const resp = await api.getMe();
        if (resp.ok) {
            state.currentUser = (await resp.json()).user;
        }
    } catch {}

    if (!state.currentUser) {
        try {
            const resp = await api.getSetupStatus();
            state.setupComplete = (await resp.json()).setup_complete;
        } catch {
            state.setupComplete = true;
        }
    } else {
        state.setupComplete = true;
    }

    try {
        const resp = await api.getHealth();
        if (resp.ok) state.serverInfo = await resp.json();
    } catch {}

    await handleRoute();
}

window.addEventListener('hashchange', () => handleRoute());
init();

// ==========================================================
// Server heartbeat — detect offline, auto-reconnect
// ==========================================================

let serverOnline = true;
const banner = document.getElementById('offline-banner');

async function heartbeat() {
    try {
        const resp = await fetch('/health', { signal: AbortSignal.timeout(5000) });
        if (resp.ok && !serverOnline) {
            serverOnline = true;
            banner.classList.add('hidden');
            await handleRoute();
        }
        serverOnline = resp.ok;
    } catch {
        if (serverOnline) {
            serverOnline = false;
            banner.classList.remove('hidden');
        }
    }
}

setInterval(heartbeat, 10000);
