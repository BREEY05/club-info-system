import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi } from '../api/judge';
import { LANGUAGE_META } from '../components/pages/practice/meta';
import { SubmissionResultPanel, VerdictBadge } from '../components/pages/practice/ResultPanels';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

function languageName(key: string): string {
  if (key === 'text') return '填空';
  return LANGUAGE_META.find((item) => item.key === key)?.name ?? key;
}

/** 提交记录：本机全部评测历史 */
export default function SubmissionHistoryPage() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const listQuery = useQuery({ queryKey: ['judge', 'submissions', 'all'], queryFn: () => judgeApi.submissions(undefined, 60) });
  const detailQuery = useQuery({
    queryKey: ['judge', 'submission', activeId],
    queryFn: () => judgeApi.submission(activeId as number),
    enabled: activeId !== null,
  });

  const submissions = listQuery.data?.submissions ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <History className="h-4 w-4 text-brand" aria-hidden />
            提交记录
          </h1>
          <p className="mt-1 text-xs text-muted">最近 {submissions.length} 条本机评测记录，点击查看每个测试点的结果。</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void listQuery.refetch()} loading={listQuery.isFetching}>
          刷新
        </Button>
      </header>

      {listQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : submissions.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" aria-hidden />} title="还没有提交记录" description="去题库挑一道题写写看。" action={<Link to="/practice"><Button variant="primary" size="sm">前往题库</Button></Link>} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-canvas text-2xs uppercase tracking-wide text-subtle">
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
                    className={'cursor-pointer border-t border-line hover:bg-canvas ' + (activeId === item.id ? 'bg-brand-soft/40' : '')}
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
            <h2 className="mb-2 text-xs font-semibold text-ink">提交详情</h2>
            {activeId === null ? (
              <p className="py-6 text-xs text-subtle">从左侧选择一条记录查看详情。</p>
            ) : detailQuery.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : detailQuery.data ? (
              <div className="flex flex-col gap-3">
                <SubmissionResultPanel submission={detailQuery.data.submission} />
                <div>
                  <p className="mb-1 text-2xs font-medium text-subtle">提交的代码</p>
                  <pre className="max-h-72 overflow-auto rounded-control bg-canvas p-2.5 font-mono text-2xs leading-5 text-ink">{detailQuery.data.submission.code || '（空）'}</pre>
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
