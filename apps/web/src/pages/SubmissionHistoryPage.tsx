import { useQuery } from '@tanstack/react-query';
import { History, ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi, type SubmissionSummary } from '../api/judge';
import { LANGUAGE_META } from '../components/pages/practice/meta';
import { SubmissionResultPanel, VerdictBadge } from '../components/pages/practice/ResultPanels';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';

function languageName(key: string): string {
  if (key === 'text') return '填空';
  return LANGUAGE_META.find((item) => item.key === key)?.name ?? key;
}

interface ProblemRecord {
  problemId: string;
  problemTitle: string;
  attempts: number;
  bestScore: number;
  maxScore: number;
  solved: boolean;
  lastVerdict: string | null;
  lastAt: string;
}

/** 提交记录：既看「每道题练到什么程度」，也能翻单次评测的细节。 */
export default function SubmissionHistoryPage() {
  const [view, setView] = useState<'problem' | 'timeline'>('problem');
  const [activeId, setActiveId] = useState<number | null>(null);

  const listQuery = useQuery({ queryKey: ['judge', 'submissions', 'all'], queryFn: () => judgeApi.submissions(undefined, 200) });
  const detailQuery = useQuery({
    queryKey: ['judge', 'submission', activeId],
    queryFn: () => judgeApi.submission(activeId as number),
    enabled: activeId !== null,
  });

  const submissions: SubmissionSummary[] = listQuery.data?.submissions ?? [];

  const records = useMemo<ProblemRecord[]>(() => {
    const map = new Map<string, ProblemRecord>();
    for (const item of submissions) {
      const existing = map.get(item.problemId);
      if (!existing) {
        map.set(item.problemId, {
          problemId: item.problemId,
          problemTitle: item.problemTitle,
          attempts: 1,
          bestScore: item.score,
          maxScore: item.maxScore,
          solved: item.verdict === 'AC',
          lastVerdict: item.verdict,
          lastAt: item.createdAt,
        });
        continue;
      }
      existing.attempts += 1;
      existing.bestScore = Math.max(existing.bestScore, item.score);
      existing.maxScore = Math.max(existing.maxScore, item.maxScore);
      existing.solved = existing.solved || item.verdict === 'AC';
      if (new Date(item.createdAt) > new Date(existing.lastAt)) {
        existing.lastVerdict = item.verdict;
        existing.lastAt = item.createdAt;
      }
    }
    return [...map.values()].sort((a, b) => Number(a.solved) - Number(b.solved) || b.attempts - a.attempts);
  }, [submissions]);

  const solved = records.filter((item) => item.solved).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="刷题训练"
        title="做题记录"
        description={
          submissions.length === 0
            ? '每次提交都会自动记录评测结果，可回看代码、测试点与得分。'
            : `练过 ${records.length} 道题，通过 ${solved} 道；共 ${submissions.length} 次提交。`
        }
        actions={
          <>
            <SegmentedControl
              options={[
                { value: 'problem', label: '按题目' },
                { value: 'timeline', label: '时间线' },
              ]}
              value={view}
              onChange={setView}
              size="sm"
              ariaLabel="切换视图"
            />
            <Button variant="secondary" size="sm" onClick={() => void listQuery.refetch()} loading={listQuery.isFetching}>
              刷新
            </Button>
          </>
        }
      />

      {listQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" aria-hidden />}
          title="还没有提交记录"
          description="去题库挑一道题写写看，提交后这里会自动记录每次评测。"
          action={
            <Link to="/practice">
              <Button size="sm">前往题库</Button>
            </Link>
          }
        />
      ) : view === 'problem' ? (
        <Card className="overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-canvas text-2xs text-subtle">
              <tr>
                <th className="px-3 py-2 text-left font-medium">题目</th>
                <th className="px-3 py-2 text-right font-medium">提交次数</th>
                <th className="px-3 py-2 text-right font-medium">最好成绩</th>
                <th className="px-3 py-2 text-left font-medium">最近一次</th>
                <th className="px-3 py-2 text-right font-medium">最后提交</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.problemId} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs tabular-nums text-subtle">{record.problemId}</span>
                      <span className="truncate text-ink">{record.problemTitle}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{record.attempts}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={record.solved ? 'font-medium text-mint' : 'text-muted'}>
                      {record.bestScore}/{record.maxScore}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <VerdictBadge verdict={(record.lastVerdict ?? null) as never} />
                  </td>
                  <td className="px-3 py-2 text-right text-subtle">{new Date(record.lastAt).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={'/practice/' + encodeURIComponent(record.problemId)} className="text-brand hover:underline">
                      {record.solved ? '回顾' : '继续做'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-canvas text-2xs text-subtle">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">题目</th>
                  <th className="px-3 py-2 text-left font-medium">语言</th>
                  <th className="px-3 py-2 text-left font-medium">结果</th>
                  <th className="px-3 py-2 text-right font-medium">得分</th>
                  <th className="px-3 py-2 text-right font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={
                      'cursor-pointer border-t border-line hover:bg-canvas ' + (activeId === item.id ? 'bg-brand-soft/40' : '')
                    }
                  >
                    <td className="px-3 py-2 tabular-nums text-subtle">{item.id}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-ink" title={item.problemTitle}>
                      {item.problemTitle}
                    </td>
                    <td className="px-3 py-2 text-muted">{languageName(item.language)}</td>
                    <td className="px-3 py-2">
                      <VerdictBadge verdict={item.verdict} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {item.score}/{item.maxScore}
                    </td>
                    <td className="px-3 py-2 text-right text-subtle">{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
              <ListChecks className="h-3.5 w-3.5 text-brand" aria-hidden />
              提交详情
            </h2>
            {activeId === null ? (
              <p className="py-6 text-xs text-subtle">从左侧选择一条记录查看详情。</p>
            ) : detailQuery.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : detailQuery.data ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone="outline">{detailQuery.data.submission.problemId}</Badge>
                  <span className="truncate text-xs text-ink">{detailQuery.data.submission.problemTitle}</span>
                </div>
                <SubmissionResultPanel submission={detailQuery.data.submission} />
                <div>
                  <p className="mb-1 text-2xs font-medium text-subtle">提交的代码</p>
                  <pre className="max-h-72 overflow-auto rounded-control bg-canvas p-2.5 font-mono text-2xs leading-5 text-ink">
                    {detailQuery.data.submission.code || '（空）'}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="py-6 text-xs text-danger">无法加载该提交。</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
