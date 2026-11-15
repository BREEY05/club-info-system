import { useRef, type KeyboardEvent, type UIEvent } from 'react';
import { cn } from '../../../lib/cn';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  minRows?: number;
}

/** 轻量代码编辑器：行号 + Tab 缩进 + 滚动同步，不引入额外依赖，纯本地可用。 */
export function CodeEditor({ value, onChange, disabled, className, minRows = 16 }: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const target = event.currentTarget;
    const { selectionStart, selectionEnd } = target;
    const next = value.slice(0, selectionStart) + '    ' + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      target.selectionStart = selectionStart + 4;
      target.selectionEnd = selectionStart + 4;
    });
  }

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  return (
    <div className={cn('flex overflow-hidden rounded-control border border-line bg-surface focus-within:border-brand', className)}>
      <div
        ref={gutterRef}
        aria-hidden
        className="select-none overflow-hidden border-r border-line bg-canvas px-2 py-3 text-right font-mono text-xs leading-5 text-subtle"
        style={{ minWidth: 44 }}
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        wrap="off"
        rows={minRows}
        className="min-h-0 flex-1 resize-y whitespace-pre bg-transparent px-3 py-3 font-mono text-xs leading-5 text-ink outline-none disabled:bg-canvas disabled:text-muted"
        aria-label="代码编辑区"
      />
    </div>
  );
}
