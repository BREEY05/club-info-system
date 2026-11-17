import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CircleCheck, CircleDashed, Code2, Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi, type ProblemSummary } from '../api/judge';
import { ProblemFormDialog } from '../components/pages/practice/ProblemFormDialog';
import { difficultyLabel, VERDICT_META } from '../components/pages/practice/meta';
import { PageHeader } from '../components/layout/PageHeader';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

type StatusFilter = 'all' | 'untouched' | 'attempted' | 'solved';
type SortKey = 'default' | 'difficulty' | 'recent';

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, unknown: 3 };

/** 题库：按难度/状态/标签筛选，先练没做过的题。 */
export default function PracticePage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('default');
  const [creating, setCreating] = useState(false);

  const problemsQuery = useQuery({ queryKey: ['judge', 'problems'], queryFn: judgeApi.problems });
  const envQuery = useQuery({ queryKey: ['judge', 'env'], queryFn: judgeApi.env });

  const reload = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['judge', 'problems'] }),
        queryClient.invalidateQueries({ queryKey: ['judge', 'env'] }),
      ]);
    },
  });

  const problems = problemsQuery.data?.problems ?? [];
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const problem of problems) for (const item of problem.tags) set.add(item);
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    const list = problems.filter((problem) => {
      if (text) {
        const hit =
          problem.title.toLowerCase().includes(text) ||
          problem.id.toLowerCase().includes(text) ||
          problem.tags.some((item) => item.toLowerCase().includes(text));
        if (!hit) return false;
      }
      if (difficulty !== 'all' && problem.difficulty !== difficulty) return false;
      if (tag && !problem.tags.includes(tag)) return false;
      if (status === 'solved' && !problem.solved) return false;
      if (status === 'attempted' && (problem.solved || problem.attempts === 0)) return false;
      if (status === 'untouched' && problem.attempts > 0) return false;
      return true;
    });
    if (sort === 'difficulty') {
      return [...list].sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 3) - (DIFFICULTY_ORDER[b.difficulty] ?? 3));
    }
    if (sort === 'recent') {
      return [...list].sort((a, b) => b.attempts - a.attempts);
    }
    return list;
  }, [problems, keyword, difficulty, tag, status, sort]);

  const solvedCount = problems.filter((item) => item.solved).length;
  const attemptedCount = problems.filter((item) => item.attempts > 0 && !item.solved).length;
  const availableLanguages = (envQuery.data?.languages ?? []).filter((item) => item.available);
  const progress = problems.length > 0 ? Math.round((solvedCount / problems.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="刷题训练"
        title="题库"
        description="本地判题，代码只在本机编译运行，不联网。做过的题会自动记录最好成绩。"
        actions={
          <>
            <Button variant="secondary" iconLeft={<RefreshCw className="h-3.5 w-3.5" aria-hidden />} loading={reload.isPending} onClick={() => reload.mutate()}>
              刷新
            </Button>
            <Button iconLeft={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setCreating(true)}>
              新建题目
            </Button>
          </>
        }
      />

      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Code2 className="h-4 w-4 text-brand" aria-hidden />
            进度 <span className="font-medium text-ink">{solvedCount}</span> / {problems.length} 题
            {attemptedCount > 0 ? <span className="text-subtle">· {attemptedCount} 题做过未通过</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(envQuery.data?.languages ?? []).map((item) => (
              <Badge key={item.key} tone={item.available ? 'mint' : 'neutral'} title={item.detail}>
                {item.name}
                {item.available ? ' ✓' : ' 不可用'}
              </Badge>
            ))}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        {availableLanguages.length === 0 && !envQuery.isPending ? (
          <p className="mt-2 text-2xs text-amber">未检测到任何编译器/解释器：安装 Python 或 MinGW(g++) 后点刷新即可判题。</p>
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索题号 / 标题 / 标签" className="pl-8" />
        </div>
        <div className="w-32 shrink-0">
          <Select aria-label="难度" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
            <option value="all">全部难度</option>
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </Select>
        </div>
        <div className="w-36 shrink-0">
          <Select aria-label="状态" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">全部状态</option>
            <option value="untouched">未开始</option>
            <option value="attempted">做过未通过</option>
            <option value="solved">已通过</option>
          </Select>
        </div>
        <div className="w-36 shrink-0">
          <Select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="default">默认顺序</option>
            <option value="difficulty">按难度</option>
            <option value="recent">按提交次数</option>
          </Select>
        </div>
        <span className="text-2xs text-subtle">
          {filtered.length === problems.length ? `共 ${problems.length} 题` : `${filtered.length} / ${problems.length} 题`}
        </span>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTag(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-2xs transition-colors',
              tag === null ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            全部标签
          </button>
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(tag === item ? null : item)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-2xs transition-colors',
                tag === item ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {problemsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
          title={problems.length === 0 ? '题库还是空的' : '没有匹配的题目'}
          description={
            problems.length === 0
              ? '可以在 problems/ 目录放入题目，也可以直接点「新建题目」录入题面与测试点。'
              : '换个筛选条件或关键词试试。'
          }
          action={
            problems.length === 0 ? (
              <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setCreating(true)}>
                新建题目
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((problem) => (
            <li key={problem.id}>
              <ProblemRow problem={problem} />
            </li>
          ))}
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

function ProblemRow({ problem }: { problem: ProblemSummary }) {
  const meta = problem.lastVerdict ? VERDICT_META[problem.lastVerdict as keyof typeof VERDICT_META] : null;
  const untouched = problem.attempts === 0;
  return (
    <Link to={'/practice/' + encodeURIComponent(problem.id)} className="block">
      <Card
        className={cn(
          'flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/30',
          problem.solved && 'border-emerald-100',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas">
          {problem.solved ? (
            <CircleCheck className="h-4 w-4 text-mint" aria-hidden />
          ) : (
            <CircleDashed className={cn('h-4 w-4', untouched ? 'text-subtle' : 'text-amber')} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs tabular-nums text-subtle">{problem.id}</span>
            <span className="truncate text-sm font-medium text-ink">{problem.title}</span>
            <Badge tone={problem.difficulty === 'easy' ? 'mint' : problem.difficulty === 'hard' ? 'danger' : 'amber'}>
              {difficultyLabel(problem.difficulty)}
            </Badge>
            {problem.tags.slice(0, 3).map((item) => (
              <Badge key={item} tone="outline">
                {item}
              </Badge>
            ))}
          </div>
          <p className="mt-0.5 text-2xs text-subtle">
            {problem.testCount} 个测试点 · 时限 {problem.timeLimitMs} ms · 内存 {problem.memoryLimitMb} MB
            {untouched ? ' · 还没做过' : ` · 提交 ${problem.attempts} 次，最高 ${problem.bestScore} 分`}
          </p>
        </div>
        {meta ? <Badge tone={meta.tone}>{meta.short}</Badge> : null}
        <span className="shrink-0 text-right">
          {problem.testCount === 0 ? (
            <span className="text-2xs text-subtle">无测试点</span>
          ) : (
            <>
              <span className="block text-2xs text-subtle">{problem.attempts > 0 ? '最佳' : '满分'}</span>
              <span className="tabular block text-xs font-medium text-muted">
                {problem.attempts > 0 ? `${problem.bestScore}/${problem.score}` : problem.score}
              </span>
            </>
          )}
        </span>
      </Card>
    </Link>
  );
}
