// ==========================================================
// Lightweight markdown renderer for LLM output
// ==========================================================

// Renders markdown string to sanitized HTML.
// Handles: code blocks, inline code, bold, italic, headers,
// lists, links, blockquotes, paragraphs.

export function renderMarkdown(src) {
    const lines = src.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Fenced code block: ```lang ... ```
        if (line.trimStart().startsWith('```')) {
            const indent = line.indexOf('```');
            const lang = line.slice(indent + 3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            const code = escapeHtml(codeLines.join('\n'));
            const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
            const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
            out.push(
                `<div class="code-block"${langAttr}>` +
                `<div class="code-header">${langLabel}<button class="code-copy-btn">Copy</button></div>` +
                `<pre><code>${code}</code></pre></div>`
            );
            continue;
        }

        // Header: # ## ### etc
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            out.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
            i++;
            continue;
        }

        // Blockquote: > text
        if (line.startsWith('> ')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].startsWith('> ')) {
                quoteLines.push(lines[i].slice(2));
                i++;
            }
            out.push(`<blockquote>${renderInline(quoteLines.join('\n'))}</blockquote>`);
            continue;
        }

        // Unordered list: - item or * item
        if (/^[\s]*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^[\s]*[-*]\s+/, ''));
                i++;
            }
            out.push('<ul>' + items.map(item => `<li>${renderInline(item)}</li>`).join('') + '</ul>');
            continue;
        }

        // Ordered list: 1. item
        if (/^[\s]*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ''));
                i++;
            }
            out.push('<ol>' + items.map(item => `<li>${renderInline(item)}</li>`).join('') + '</ol>');
            continue;
        }

        // Horizontal rule: --- or ***
        if (/^([-*_])\1{2,}\s*$/.test(line.trim())) {
            out.push('<hr>');
            i++;
            continue;
        }

        // Empty line
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Paragraph: collect consecutive non-empty, non-special lines
        const paraLines = [];
        while (i < lines.length &&
               lines[i].trim() !== '' &&
               !lines[i].trimStart().startsWith('```') &&
               !lines[i].match(/^#{1,6}\s/) &&
               !lines[i].startsWith('> ') &&
               !/^[\s]*[-*]\s+/.test(lines[i]) &&
               !/^[\s]*\d+\.\s+/.test(lines[i]) &&
               !/^([-*_])\1{2,}\s*$/.test(lines[i].trim())) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            out.push(`<p>${renderInline(paraLines.join('\n'))}</p>`);
        }
    }

    return out.join('\n');
}

// Render inline markdown: bold, italic, code, links, line breaks
function renderInline(text) {
    let s = escapeHtml(text);

    // Inline code: `code` (must be before bold/italic to avoid conflicts)
    s = s.replace(/`([^`]+?)`/g, '<code class="inline-code">$1</code>');

    // Bold+Italic: ***text*** or ___text___
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

    // Bold: **text** or __text__
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (not inside words for _)
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

    // Strikethrough: ~~text~~
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Line breaks within paragraphs
    s = s.replace(/\n/g, '<br>');

    return s;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
