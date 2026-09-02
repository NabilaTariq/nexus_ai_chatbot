/**
 * Markdown & Code Syntax Parser for Nexus AI
 * Converts Markdown string into safe, beautiful HTML elements with copyable code blocks
 */

export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  let html = String(markdownText);

  // Auto-close open code fence during streaming or incomplete responses
  const fenceMatches = html.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    html += '\n```';
  }

  // 1. Extract and protect code blocks with unique tokens (no underscores/asterisks)
  const codeBlocks = [];
  const tokenPrefix = '@@@NXCODEBLOCK';
  const tokenSuffix = 'NXCODEBLOCK@@@';

  html = html.replace(/```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({
      lang: (lang || '').trim() || 'code',
      code: code.trimEnd()
    });
    return `\n\n${tokenPrefix}${index}${tokenSuffix}\n\n`;
  });

  // 2. Escape basic HTML entities in remaining text to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Process Tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableMatch) => {
    const lines = tableMatch.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return tableMatch;

    let tableHtml = '<div class="table-responsive"><table class="markdown-table">';
    let isHeader = true;

    lines.forEach((line, index) => {
      // Check for separator row | --- | --- |
      if (/^\|(?:\s*[:-]+-+\s*\|)+$/.test(line)) {
        isHeader = false;
        return;
      }

      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (isHeader && index === 0) {
        tableHtml += '<thead><tr>';
        cells.forEach(cell => {
          tableHtml += `<th>${cell}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      }
    });

    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // 4. Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 5. Blockquotes (handle multi-line blockquotes)
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 6. Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 7. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 8. Unordered Lists
  html = html.replace(/(?:^[ \t]*[-*+][ \t]+.*(?:\r?\n|$))+/gm, (listMatch) => {
    const items = listMatch.trim().split('\n').map(line => {
      return line.replace(/^[ \t]*[-*+][ \t]+/, '');
    });
    return '<ul>' + items.map(item => `<li>${item}</li>`).join('') + '</ul>';
  });

  // 9. Ordered Lists
  html = html.replace(/(?:^[ \t]*\d+\.[ \t]+.*(?:\r?\n|$))+/gm, (listMatch) => {
    const items = listMatch.trim().split('\n').map(line => {
      return line.replace(/^[ \t]*\d+\.[ \t]+/, '');
    });
    return '<ol>' + items.map(item => `<li>${item}</li>`).join('') + '</ol>';
  });

  // 10. Paragraphs (lines separated by double newlines, ignoring existing HTML tags or block tokens)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h1') || 
      trimmed.startsWith('<h2') || 
      trimmed.startsWith('<h3') || 
      trimmed.startsWith('<ul') || 
      trimmed.startsWith('<ol') || 
      trimmed.startsWith('<blockquote') || 
      trimmed.startsWith('<div') || 
      trimmed.includes(tokenPrefix)
    ) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // 11. Restore Code Blocks with Copy button and styling
  codeBlocks.forEach((block, index) => {
    const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const highlightedCode = applySyntaxHighlighting(escapedCode, block.lang);

    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-language">${block.lang}</span>
          <button class="btn-copy-code" data-code="${encodeURIComponent(block.code)}" title="Copy code">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        </div>
        <div class="code-block-content">
          <pre><code>${highlightedCode}</code></pre>
        </div>
      </div>
    `;

    const token = `${tokenPrefix}${index}${tokenSuffix}`;
    html = html.split(token).join(blockHtml);
  });

  return html;
}

/**
 * Lightweight syntax highlighter for Python, JavaScript, HTML, CSS, SQL, and Bash
 */
function applySyntaxHighlighting(code, lang) {
  if (!code) return '';

  const tokens = [];
  const P = '§§TOK';
  const S = 'TOK§§';

  let res = code;

  // 1. Comments (#, //, --)
  res = res.replace(/(#|\/\/|--).*$/gm, (match) => {
    const idx = tokens.length;
    tokens.push(`<span class="tok-comment">${match}</span>`);
    return `${P}${idx}${S}`;
  });

  // 2. Strings (double quotes, single quotes, backticks)
  res = res.replace(/(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g, (match) => {
    const idx = tokens.length;
    tokens.push(`<span class="tok-str">${match}</span>`);
    return `${P}${idx}${S}`;
  });

  // 3. Numbers
  res = res.replace(/\b\d+(\.\d+)?\b/g, '<span class="tok-num">$&</span>');

  // 4. Keywords
  const keywords = /\b(def|class|import|from|return|if|elif|else|for|while|in|try|except|finally|as|with|async|await|const|let|var|function|new|throw|export|default|type|interface|select|where|insert|into|update|delete|table|create|drop|alter)\b/g;
  res = res.replace(keywords, '<span class="tok-kw">$&</span>');

  // 5. Function calls: name(...)
  res = res.replace(/\b([a-zA-Z_]\w*)(?=\s*\()/g, (match) => {
    if (['if', 'for', 'while', 'catch', 'switch', 'in'].includes(match)) return match;
    return `<span class="tok-fn">${match}</span>`;
  });

  // 6. Restore protected comments and strings
  tokens.forEach((t, i) => {
    res = res.split(`${P}${i}${S}`).join(t);
  });

  return res;
}
