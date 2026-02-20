// ==========================================================
// Auth views: Setup, Login, Invite Registration
// ==========================================================

import * as api from './api.js';
import { showError } from './helpers.js';
import { state, navigate } from './app.js';

// --- Setup (2-step wizard) ---

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
        const { resp, data } = await api.postSetup({ server_name: serverName, username, password });
        if (!resp.ok) {
            showError('setup-error', data.error);
            return;
        }
        state.currentUser = data.user;
        state.setupComplete = true;
        state.serverInfo = { status: 'ok', server_name: serverName };
        navigate('/dashboard');
    } catch {
        showError('setup-error', 'Connection failed');
    }
});

// --- Login ---

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const { resp, data } = await api.postLogin({ username, password });
        if (!resp.ok) {
            if (data.error && data.error.includes('setup')) {
                state.setupComplete = false;
                navigate('/setup');
                return;
            }
            showError('login-error', data.error || 'Login failed');
            return;
        }
        state.currentUser = data.user;
        navigate(state.currentUser.is_admin ? '/dashboard' : '/chat');
    } catch {
        showError('login-error', 'Connection failed');
    }
});

// --- Invite Registration ---

export async function activateInvite(token) {
    const nameEl = document.getElementById('invite-server-name');
    const messageEl = document.getElementById('invite-message');
    const formContainer = document.getElementById('invite-form-container');
    const invalidEl = document.getElementById('invite-invalid');

    formContainer.classList.add('hidden');
    invalidEl.classList.add('hidden');
    messageEl.textContent = 'Checking invite...';
    nameEl.textContent = '';

    try {
        const resp = await api.getInvite(token);
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
        const { resp, data } = await api.postRegister({ token, username, password });
        if (!resp.ok) {
            showError('invite-error', data.error || 'Registration failed');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Join';
            return;
        }
        state.currentUser = data.user;
        window.location.replace('/#/chat');
    } catch {
        showError('invite-error', 'Connection failed');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join';
    }
});
