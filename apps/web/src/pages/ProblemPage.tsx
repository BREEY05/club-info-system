import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { judgeApi, type JudgeLanguage, type SubmissionSummary } from '../api/judge';
import { CodeEditor } from '../components/pages/practice/CodeEditor';
import { DEFAULT_CODE, LANGUAGE_META, VERDICT_META, difficultyLabel } from '../components/pages/practice/meta';
import { SubmissionResultPanel, VerdictBadge } from '../components/pages/practice/ResultPanels';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Select, Textarea } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { getErrorMessage } from '../lib/errors';
import { renderMarkdown } from '../lib/markdown';

/** 题目详情：左题面、右编辑器，提交后轮询评测结果 */
export default function ProblemPage() {
  const { problemId = '' } = useParams();
  const [language, setLanguage] = useState<JudgeLanguage>('python');
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const codeTouched = useRef(false);

  const problemQuery = useQuery({ queryKey: ['judge', 'problem', problemId], queryFn: () => judgeApi.problem(problemId), enabled: problemId !== '' });
  const envQuery = useQuery({ queryKey: ['judge', 'env'], queryFn: judgeApi.env });
  const historyQuery = useQuery({
    queryKey: ['judge', 'submissions', problemId],
    queryFn: () => judgeApi.submissions(problemId, 10),
    enabled: problemId !== '',
  });

  const problem = problemQuery.data?.problem;
  const availableLanguages = useMemo(() => (envQuery.data?.languages ?? []).filter((item) => item.available), [envQuery.data]);

  // 默认选一个本机可用的语言
  useEffect(() => {
    if (availableLanguages.length === 0) return;
    if (!availableLanguages.some((item) => item.key === language)) setLanguage(availableLanguages[0]!.key);
  }, [availableLanguages, language]);

  // 题目或语言切换时载入草稿
  useEffect(() => {
    if (!problem) return;
    if (problem.type === 'fill_result') return;
    const key = `cims:code:${problem.id}:${language}`;
    const stored = localStorage.getItem(key);
    setCode(stored ?? DEFAULT_CODE[language] ?? '');
    codeTouched.current = stored !== null;
  }, [problem, language]);

  useEffect(() => {
    if (!problem || problem.type === 'fill_result') return;
    const key = `cims:code:${problem.id}:${language}`;
    const timer = setTimeout(() => localStorage.setItem(key, code), 400);
    return () => clearTimeout(timer);
  }, [code, problem, language]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!problem) throw new Error('题目未加载');
      const payload = problem.type === 'fill_result' ? answer : code;
      if (payload.trim() === '') throw new Error('代码不能为空');
      const result = await judgeApi.submit(problem.id, problem.type === 'fill_result' ? 'text' : language, payload);
      return result.submissionId;
    },
    onSuccess: (id) => {
      setError('');
      setActiveId(id);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const submissionQuery = useQuery({
    queryKey: ['judge', 'submission', activeId],
    queryFn: () => judgeApi.submission(activeId as number),
    enabled: activeId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.submission.status;
      return status === 'pending' || status === 'running' ? 700 : false;
    },
  });

  const active: SubmissionSummary | undefined = submissionQuery.data?.submission;
  const judging = active !== undefined && active.status !== 'done';

  // 评测完成后刷新历史
  useEffect(() => {
    if (active?.status === 'done') void historyQuery.refetch();
  }, [active?.status, active?.id, historyQuery]);

  if (problemQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (problemQuery.isError || !problem) {
    return (
      <Alert tone="danger" title="题目加载失败" action={<Link to="/practice"><Button size="sm" variant="secondary">返回题库</Button></Link>}>
        {getErrorMessage(problemQuery.error)}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/practice" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          题库
        </Link>
        <span className="text-2xs text-subtle">/</span>
        <span className="text-2xs tabular-nums text-subtle">{problem.id}</span>
        <h1 className="truncate text-sm font-semibold text-ink">{problem.title}</h1>
        <Badge tone="outline">{difficultyLabel(problem.difficulty)}</Badge>
        {problem.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
        <span className="ml-auto text-2xs text-subtle">
          时限 {problem.timeLimitMs} ms · 内存 {problem.memoryLimitMb} MB · {problem.testCount} 个测试点 · 满分 {problem.score}
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* 题面 */}
        <Card className="flex max-h-[calc(100vh-140px)] flex-col overflow-hidden">
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
            {problem.statement.trim() !== '' ? (
              <div className="prose-sm max-w-none text-muted" dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.statement) }} />
            ) : problem.description.trim() !== '' ? (
              <p className="whitespace-pre-wrap text-xs leading-6 text-muted">{problem.description}</p>
            ) : (
              <p className="text-xs text-subtle">该题暂无题面说明，可直接按测试数据的输入输出格式作答。</p>
            )}

            {problem.inputDescription ? (
              <section className="mt-3">
                <h3 className="mb-1 text-xs font-semibold text-ink">输入格式</h3>
                <p className="whitespace-pre-wrap text-xs leading-6 text-muted">{problem.inputDescription}</p>
              </section>
            ) : null}
            {problem.outputDescription ? (
              <section className="mt-3">
                <h3 className="mb-1 text-xs font-semibold text-ink">输出格式</h3>
                <p className="whitespace-pre-wrap text-xs leading-6 text-muted">{problem.outputDescription}</p>
              </section>
            ) : null}

            {problem.samples.length > 0 ? (
              <section className="mt-4 flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-ink">样例</h3>
                {problem.samples.map((sample, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-2xs text-subtle">输入 #{index + 1}</p>
                      <pre className="max-h-40 overflow-auto rounded-control bg-canvas p-2.5 font-mono text-2xs leading-5 text-ink">{sample.input || '（空）'}</pre>
                    </div>
                    <div>
                      <p className="mb-1 text-2xs text-subtle">输出 #{index + 1}</p>
                      <pre className="max-h-40 overflow-auto rounded-control bg-canvas p-2.5 font-mono text-2xs leading-5 text-ink">{sample.output || '（空）'}</pre>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        </Card>

        {/* 作答区 */}
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {problem.type === 'fill_result' ? (
                <Badge tone="brand">结果填空</Badge>
              ) : (
                <>
                  <Select value={language} onChange={(event) => setLanguage(event.target.value as JudgeLanguage)} className="h-8 w-[130px] text-xs">
                    {LANGUAGE_META.map((item) => {
                      const tool = envQuery.data?.languages.find((lang) => lang.key === item.key);
                      return (
                        <option key={item.key} value={item.key} disabled={!tool?.available}>
                          {item.name}
                          {tool?.available ? '' : '（未安装）'}
                        </option>
                      );
                    })}
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={() => setCode(DEFAULT_CODE[language] ?? '')}
                  >
                    重置为模板
                  </Button>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                {judging ? <span className="flex items-center gap-1 text-2xs text-muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />评测中…</span> : null}
                <Button variant="primary" size="sm" iconLeft={<Play className="h-3.5 w-3.5" />} loading={submit.isPending} disabled={judging} onClick={() => submit.mutate()}>
                  提交评测
                </Button>
              </div>
            </div>

            {problem.type === 'fill_result' ? (
              <Textarea rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="填写最终答案" className="font-mono text-xs" />
            ) : (
              <CodeEditor value={code} onChange={setCode} minRows={16} disabled={judging} />
            )}

            {availableLanguages.length === 0 ? (
              <Alert tone="warning">本机未检测到任何编译或解释环境，安装 Python / MinGW(g++) / JDK 后刷新页面即可评测。</Alert>
            ) : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-ink">评测结果</h2>
              {active && active.status === 'done' && active.verdict === 'AC' ? (
                <span className="flex items-center gap-1 text-2xs text-mint">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  已通过
                </span>
              ) : null}
            </div>
            {active ? (
              active.status === 'done' ? (
                <SubmissionResultPanel submission={active} />
              ) : (
                <p className="flex items-center gap-2 py-4 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  正在编译并运行测试点…
                </p>
              )
            ) : (
              <p className="py-4 text-xs text-subtle">提交后这里会显示编译信息、每个测试点的结果与用时。</p>
            )}
          </Card>

          {(historyQuery.data?.submissions.length ?? 0) > 0 ? (
            <Card className="p-3">
              <h2 className="mb-2 text-xs font-semibold text-ink">最近提交</h2>
              <ul className="flex flex-col divide-y divide-line">
                {historyQuery.data?.submissions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className="flex w-full items-center gap-2 py-1.5 text-left text-2xs text-muted hover:text-ink"
                    >
                      <span className="tabular-nums text-subtle">#{item.id}</span>
                      <VerdictBadge verdict={item.verdict} />
                      <span className="tabular-nums">{item.score} 分</span>
                      <span className="tabular-nums">{item.timeMs} ms</span>
                      <span className="ml-auto text-subtle">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
