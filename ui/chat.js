// ==========================================================
// Chat view
// ==========================================================

import * as api from './api.js';
import { escapeHtml } from './helpers.js';
import { renderMarkdown } from './markdown.js';
import { state } from './app.js';
import { getKey } from './keystore.js';
import { encryptMessage, decryptMessage } from './crypto.js';

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const convoList = document.getElementById('conversation-list');
const modelSelect = document.getElementById('model-select');
const displayName = document.getElementById('display-name');
const serverNameEl = document.getElementById('server-name');
const footerText = document.getElementById('footer-text');

let conversations = [];
let isStreaming = false;

export async function activateChat() {
    displayName.textContent = state.currentUser.display_name || state.currentUser.username;

    const adminBtn = document.getElementById('admin-btn');
    adminBtn.classList.toggle('hidden', !state.currentUser.is_admin);

    if (state.serverInfo?.server_name) {
        serverNameEl.textContent = state.serverInfo.server_name;
        footerText.textContent = `Private AI · ${state.serverInfo.server_name}`;
    }

    await loadModels();
    await loadConversations();
    chatInput.focus();
}

async function loadModels() {
    try {
        const resp = await api.getModels();
        const data = await resp.json();
        modelSelect.innerHTML = '';
        for (const m of data.models || []) {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = `${m.name} (${m.details.parameter_size})`;
            modelSelect.appendChild(opt);
        }
    } catch { }
}

async function loadConversations() {
    try {
        const resp = await api.getConversations();
        const data = await resp.json();
        conversations = data.conversations || [];
        renderConversations();
    } catch { }
}

function renderConversations() {
    convoList.innerHTML = '';
    for (const c of conversations) {
        const div = document.createElement('div');
        div.className = 'convo-item' + (c.id === state.currentConversationId ? ' active' : '');
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
    state.currentConversationId = id;
    renderConversations();
    messagesDiv.innerHTML = '';
    document.getElementById('welcome-msg')?.remove();

    try {
        const resp = await api.getConversation(id);
        const data = await resp.json();

        const key = await getKey();
        for (const msg of data.messages || []) {
            let content = msg.content;
            if (msg.encrypted && key) {
                content = await decryptMessage(key, msg.iv, content);
            }
            appendMessage(msg.role, content);
        }
        scrollToBottom();
    } catch { }
}

async function deleteConversation(id) {
    try {
        await api.deleteConversationAPI(id);
        if (state.currentConversationId === id) {
            state.currentConversationId = null;
            messagesDiv.innerHTML = '';
            showWelcome();
        }
        await loadConversations();
    } catch { }
}

function startNewChat() {
    state.currentConversationId = null;
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
    if (state.currentConversationId) body.conversation_id = state.currentConversationId;

    const key = await getKey();
    if (key) {
        try {
            const { ciphertextB64, ivB64 } = await encryptMessage(key, text);
            body.message = ciphertextB64;
            body.iv = ivB64;
            body.encrypted = true;
        } catch (err) {
            console.error("Encryption failed:", err);
        }
    }

    isStreaming = true;
    sendBtn.disabled = true;

    const { textEl } = appendMessage('assistant', '');
    textEl.classList.add('streaming-cursor');

    try {
        const resp = await api.postChatStream(body);
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
                    if (data.conversation_id && !state.currentConversationId) {
                        state.currentConversationId = data.conversation_id;
                        continue;
                    }
                    if (data.content) {
                        let textChunk = data.content;
                        if (data.encrypted && key) {
                            textChunk = await decryptMessage(key, data.iv, data.content);
                        }
                        fullText += textChunk;
                        textEl.textContent = fullText;
                        scrollToBottom();
                    }
                } catch { }
            }
        }

        textEl.classList.remove('streaming-cursor');
        textEl.innerHTML = renderMarkdown(fullText);
        scrollToBottom();
        await loadConversations();
    } catch {
        textEl.textContent = 'Error: Failed to get response';
        textEl.classList.remove('streaming-cursor');
    }

    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.focus();
}

export function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;

    const avatar = role === 'user' ? '👤' : '🔥';
    const label = role === 'user' ? (state.currentUser?.display_name || 'You') : 'AI';

    div.innerHTML = `
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
            <div class="msg-role">${label}</div>
            <div class="msg-text"></div>
        </div>
    `;

    const textEl = div.querySelector('.msg-text');
    if (role === 'assistant' && content) {
        textEl.innerHTML = renderMarkdown(content);
    } else {
        textEl.textContent = content;
    }
    messagesDiv.appendChild(div);
    return { div, textEl };
}

function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- Event listeners ---
document.getElementById('new-chat-btn').addEventListener('click', startNewChat);

// --- Change Password Modal ---
const pwModal = document.getElementById('password-modal');

document.getElementById('change-pw-btn').addEventListener('click', () => {
    pwModal.classList.remove('hidden');
});

document.getElementById('password-modal-close').addEventListener('click', () => {
    pwModal.classList.add('hidden');
});

pwModal.addEventListener('click', (e) => {
    if (e.target === pwModal) pwModal.classList.add('hidden');
});

document.getElementById('user-change-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('user-pw-error');
    const successEl = document.getElementById('user-pw-success');
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const current = document.getElementById('user-current-pw').value;
    const newPw = document.getElementById('user-new-pw').value;
    const confirm = document.getElementById('user-confirm-pw').value;

    if (newPw !== confirm) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const resp = await fetch('/api/auth/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: newPw }),
        });
        const data = await resp.json();
        if (resp.ok) {
            successEl.textContent = 'Password updated.';
            successEl.classList.remove('hidden');
            document.getElementById('user-current-pw').value = '';
            document.getElementById('user-new-pw').value = '';
            document.getElementById('user-confirm-pw').value = '';
            setTimeout(() => pwModal.classList.add('hidden'), 1500);
        } else {
            errorEl.textContent = data.error || 'Failed to update password.';
            errorEl.classList.remove('hidden');
        }
    } catch {
        errorEl.textContent = 'Connection failed.';
        errorEl.classList.remove('hidden');
    }
});

// Delegated click handler for code block copy buttons
messagesDiv.addEventListener('click', (e) => {
    const btn = e.target.closest('.code-copy-btn');
    if (!btn) return;
    const codeBlock = btn.closest('.code-block');
    const code = codeBlock?.querySelector('code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1500);
        });
    }
});
