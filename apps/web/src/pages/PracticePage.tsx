import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CircleCheck, CircleDashed, Code2, Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi } from '../api/judge';
import { ProblemFormDialog } from '../components/pages/practice/ProblemFormDialog';
import { difficultyLabel, VERDICT_META } from '../components/pages/practice/meta';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';

/** 题库列表：本机可用语言提示 + 题目卡片 + 新建题目入口 */
export default function PracticePage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [creating, setCreating] = useState(false);

  const problemsQuery = useQuery({ queryKey: ['judge', 'problems'], queryFn: judgeApi.problems });
  const envQuery = useQuery({ queryKey: ['judge', 'env'], queryFn: judgeApi.env });

  const reload = useMutation({
    mutationFn: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['judge', 'problems'] }), queryClient.invalidateQueries({ queryKey: ['judge', 'env'] })]);
    },
  });

  const problems = problemsQuery.data?.problems ?? [];
  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return problems;
    return problems.filter((item) => item.title.toLowerCase().includes(text) || item.id.toLowerCase().includes(text) || item.tags.some((tag) => tag.toLowerCase().includes(text)));
  }, [problems, keyword]);

  const solvedCount = problems.filter((item) => item.solved).length;
  const availableLanguages = (envQuery.data?.languages ?? []).filter((item) => item.available);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <Code2 className="h-4 w-4 text-brand" aria-hidden />
            题库
          </h1>
          <p className="mt-1 text-xs text-muted">
            本地判题，代码只在本机编译运行。已通过 <span className="font-medium text-ink">{solvedCount}</span> / {problems.length} 题。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" iconLeft={<RefreshCw className="h-3.5 w-3.5" />} loading={reload.isPending} onClick={() => reload.mutate()}>
            刷新
          </Button>
          <Button variant="primary" size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            新建题目
          </Button>
        </div>
      </header>

      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-2xs font-medium text-subtle">本机判题环境</span>
        {(envQuery.data?.languages ?? []).map((item) => (
          <Badge key={item.key} tone={item.available ? 'mint' : 'neutral'} title={item.detail}>
            {item.name}
            {item.available ? ' ✓' : ' 不可用'}
          </Badge>
        ))}
        {availableLanguages.length === 0 && !envQuery.isPending ? (
          <span className="text-2xs text-amber">未检测到任何编译/解释器，请安装 Python 或 MinGW(g++) 后刷新</span>
        ) : null}
      </Card>

      {problemsQuery.data?.broken?.length ? (
        <Alert tone="warning" title="以下题目目录无法解析，已跳过">
          {problemsQuery.data.broken.map((item) => (
            <div key={item.dir}>
              <code className="text-ink">{item.dir}</code>：{item.message}
            </div>
          ))}
        </Alert>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索题号 / 标题 / 标签" className="pl-8" />
      </div>

      {problemsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
          title={problems.length === 0 ? '题库还是空的' : '没有匹配的题目'}
          description={
            problems.length === 0
              ? '可以在 problems/ 目录放入题目，也可以直接点「新建题目」录入题面与测试点。'
              : '换个关键词试试。'
          }
          action={
            problems.length === 0 ? (
              <Button variant="primary" size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
                新建题目
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((problem) => {
            const meta = problem.lastVerdict ? VERDICT_META[problem.lastVerdict as keyof typeof VERDICT_META] : null;
            return (
              <li key={problem.id}>
                <Link to={'/practice/' + encodeURIComponent(problem.id)} className="block">
                  <Card className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/30">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-subtle">
                      {problem.solved ? <CircleCheck className="h-4 w-4 text-mint" aria-hidden /> : <CircleDashed className="h-4 w-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-2xs tabular-nums text-subtle">{problem.id}</span>
                        <span className="truncate text-sm font-medium text-ink">{problem.title}</span>
                        {problem.tags.map((tag) => (
                          <Badge key={tag} tone="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-0.5 text-2xs text-subtle">
                        {difficultyLabel(problem.difficulty)} · {problem.testCount} 个测试点 · 时限 {problem.timeLimitMs} ms · 内存 {problem.memoryLimitMb} MB
                        {problem.attempts > 0 ? ` · 已提交 ${problem.attempts} 次，最高 ${problem.bestScore} 分` : ''}
                      </p>
                    </div>
                    {meta ? <Badge tone={meta.tone}>{meta.short}</Badge> : null}
                    <span className="text-xs font-medium tabular-nums text-muted">{problem.score} 分</span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <ProblemFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void queryClient.invalidateQueries({ queryKey: ['judge', 'problems'] });
        }}
      />
    </div>
  );
}
