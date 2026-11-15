import type { SubmissionSummary, TestResultItem } from '../../../api/judge';
import { Badge } from '../../ui/Badge';
import { VERDICT_META } from './meta';

export function VerdictBadge({ verdict, className }: { verdict: string | null; className?: string }) {
  if (!verdict) return <Badge tone="neutral" className={className}>评测中</Badge>;
  const meta = VERDICT_META[verdict as keyof typeof VERDICT_META];
  if (!meta) return <Badge tone="neutral" className={className}>{verdict}</Badge>;
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.short}
      <span className="font-normal">{meta.label}</span>
    </Badge>
  );
}

export function TestResultTable({ tests }: { tests: TestResultItem[] }) {
  if (tests.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-control border border-line">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-canvas text-2xs uppercase tracking-wide text-subtle">
          <tr>
            <th className="px-3 py-2 text-left font-medium">测试点</th>
            <th className="px-3 py-2 text-left font-medium">结果</th>
            <th className="px-3 py-2 text-right font-medium">得分</th>
            <th className="px-3 py-2 text-right font-medium">用时</th>
            <th className="px-3 py-2 text-left font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => {
            const meta = VERDICT_META[test.verdict];
            return (
              <tr key={test.index} className="border-t border-line">
                <td className="px-3 py-1.5 text-muted">{test.name || `测试点 ${test.index}`}</td>
                <td className="px-3 py-1.5">
                  <span className={meta.tone === 'mint' ? 'text-mint' : meta.tone === 'danger' ? 'text-danger' : 'text-amber'}>
                    {meta.short}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                  {test.score}/{test.maxScore}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">{test.timeMs} ms</td>
                <td className="max-w-[280px] truncate px-3 py-1.5 text-muted" title={test.message}>{test.message || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 评测结果摘要 */
export function SubmissionResultPanel({ submission }: { submission: SubmissionSummary }) {
  const meta = submission.verdict ? VERDICT_META[submission.verdict] : null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={submission.verdict} />
        <span className="text-xs text-muted">
          得分 <span className="font-medium tabular-nums text-ink">{submission.score}</span> / {submission.maxScore}
        </span>
        <span className="text-xs text-muted">总用时 {submission.timeMs} ms</span>
        <span className="ml-auto text-2xs text-subtle">#{submission.id}</span>
      </div>
      {submission.message ? (
        <p className={meta?.tone === 'danger' ? 'text-xs text-danger' : 'text-xs text-muted'}>{submission.message}</p>
      ) : null}
      {submission.compileOutput && submission.compileOutput.trim() !== '' ? (
        <div>
          <p className="mb-1 text-2xs font-medium text-subtle">{submission.verdict === 'CE' ? '编译输出' : '编译器提示'}</p>
          <pre className="max-h-40 overflow-auto rounded-control bg-canvas p-2.5 text-2xs leading-5 text-muted">{submission.compileOutput.trim()}</pre>
        </div>
      ) : null}
      <TestResultTable tests={submission.tests ?? []} />
    </div>
  );
}
