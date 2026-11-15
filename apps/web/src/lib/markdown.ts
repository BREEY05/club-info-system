/**
 * 极简 Markdown 渲染：先转义 HTML，再处理标题 / 代码块 / 行内代码 / 加粗 / 列表，
 * 保证题面里的任何内容都不会被当成 HTML 执行（本地工具不做 XSS 面）。
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-canvas px-1 py-0.5 text-[0.92em] text-ink">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
}

export function renderMarkdown(source: string): string {
  const text = escapeHtml(source.replace(/\r\n/g, '\n'));
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false;
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      closeList();
      out.push(inCode ? '</code></pre>' : '<pre class="mt-2 overflow-x-auto rounded-control bg-canvas p-3 text-xs leading-5"><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(raw + '\n');
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(raw);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      const size = level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs';
      out.push(`<h${level} class="mt-3 mb-1.5 ${size} font-semibold text-ink">${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    const item = /^\s*[-*+]\s+(.*)$/.exec(raw);
    if (item) {
      if (!listOpen) {
        out.push('<ul class="my-1.5 ml-4 list-disc space-y-1">');
        listOpen = true;
      }
      out.push(`<li class="text-xs leading-6">${inline(item[1]!)}</li>`);
      continue;
    }
    closeList();
    if (raw.trim() === '') continue;
    out.push(`<p class="my-1.5 text-xs leading-6">${inline(raw)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}
