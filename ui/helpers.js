// ==========================================================
// Shared helpers
// ==========================================================

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

export function showSettingsMsg(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'settings-msg ' + type;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}
