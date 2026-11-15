import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { judgeApi, type ProblemInputPayload } from '../../../api/judge';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Select, Textarea } from '../../ui/Input';

interface TestDraft {
  name: string;
  input: string;
  answer: string;
}

const EMPTY_TEST: TestDraft = { name: '', input: '', answer: '' };

export interface ProblemFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** 新建题目：题面 + 测试点直接落盘到 problems/<id>/ */
export function ProblemFormDialog({ open, onClose, onSaved }: ProblemFormDialogProps) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'program' | 'fill_result'>('program');
  const [statement, setStatement] = useState('');
  const [timeLimit, setTimeLimit] = useState(1000);
  const [memoryLimit, setMemoryLimit] = useState(256);
  const [score, setScore] = useState(100);
  const [compareMode, setCompareMode] = useState<'token' | 'line' | 'exact' | 'float'>('token');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'unknown'>('unknown');
  const [tags, setTags] = useState('');
  const [answers, setAnswers] = useState('');
  const [tests, setTests] = useState<TestDraft[]>([{ ...EMPTY_TEST }]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setId('');
    setTitle('');
    setType('program');
    setStatement('');
    setTimeLimit(1000);
    setMemoryLimit(256);
    setScore(100);
    setCompareMode('token');
    setDifficulty('unknown');
    setTags('');
    setAnswers('');
    setTests([{ ...EMPTY_TEST }]);
    setError('');
  }, [open]);

  const save = useMutation({
    mutationFn: (payload: ProblemInputPayload) => judgeApi.saveProblem(payload),
    onSuccess: () => onSaved(),
    onError: (err: Error) => setError(err.message),
  });

  function submit() {
    setError('');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(id.trim())) {
      setError('题目编号只能包含字母、数字、下划线和短横线，且以字母或数字开头');
      return;
    }
    if (title.trim() === '') {
      setError('请填写题目标题');
      return;
    }
    if (type === 'fill_result' && answers.trim() === '') {
      setError('结果填空题至少需要一个标准答案');
      return;
    }
    if (type === 'program' && tests.every((test) => test.answer.trim() === '')) {
      setError('编程题至少需要一个测试点（含期望输出）');
      return;
    }
    save.mutate({
      id: id.trim(),
      title: title.trim(),
      type,
      statement,
      timeLimitMs: timeLimit,
      memoryLimitMb: memoryLimit,
      score,
      compareMode,
      difficulty,
      tags: tags
        .split(/[,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
      answers: type === 'fill_result' ? answers.split('\n').map((item) => item.trim()).filter(Boolean) : undefined,
      tests:
        type === 'program'
          ? tests
              .filter((test) => test.answer.trim() !== '' || test.input.trim() !== '')
              .map((test) => ({ name: test.name, input: test.input, answer: test.answer }))
          : [],
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="新建题目"
      description="题目会保存到 problems/<编号>/，包含 problem.json、statement.md 与 tests/ 数据文件。"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            保存题目
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-5 py-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="题目编号" required hint="例如 P1001">
            <Input value={id} onChange={(event) => setId(event.target.value)} placeholder="P1001" />
          </Field>
          <Field label="标题" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A+B Problem" />
          </Field>
          <Field label="题型">
            <Select value={type} onChange={(event) => setType(event.target.value as 'program' | 'fill_result')}>
              <option value="program">编程题（跑测试点）</option>
              <option value="fill_result">结果填空题（比对答案）</option>
            </Select>
          </Field>
          <Field label="比对方式" hint="token=按空白分词比较，line=按行，exact=逐字符">
            <Select value={compareMode} onChange={(event) => setCompareMode(event.target.value as typeof compareMode)}>
              <option value="token">token</option>
              <option value="line">line</option>
              <option value="exact">exact</option>
              <option value="float">float（浮点误差）</option>
            </Select>
          </Field>
          <Field label="时间限制（ms）">
            <Input type="number" min={100} value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value) || 1000)} />
          </Field>
          <Field label="内存限制（MB）">
            <Input type="number" min={16} value={memoryLimit} onChange={(event) => setMemoryLimit(Number(event.target.value) || 256)} />
          </Field>
          <Field label="总分">
            <Input type="number" min={1} value={score} onChange={(event) => setScore(Number(event.target.value) || 100)} />
          </Field>
          <Field label="难度">
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
              <option value="unknown">未标注</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </Select>
          </Field>
        </div>

        <Field label="标签" hint="用逗号或空格分隔，最多 6 个">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="数组, 模拟" />
        </Field>

        <Field label="题面（Markdown）">
          <Textarea rows={6} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder={'## 题目描述\n\n输入两个整数，输出它们的和。'} />
        </Field>

        {type === 'fill_result' ? (
          <Field label="标准答案" hint="每行一个可接受的答案">
            <Textarea rows={3} value={answers} onChange={(event) => setAnswers(event.target.value)} />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">测试点</span>
              <Button variant="ghost" size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setTests((prev) => [...prev, { ...EMPTY_TEST }])}>
                添加测试点
              </Button>
            </div>
            {tests.map((test, index) => (
              <div key={index} className="rounded-control border border-line p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <Input value={test.name} placeholder={`测试点 ${index + 1}`} onChange={(event) => setTests((prev) => prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))} />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="删除测试点"
                    disabled={tests.length === 1}
                    onClick={() => setTests((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Textarea
                    rows={3}
                    placeholder="输入数据（stdin）"
                    value={test.input}
                    onChange={(event) => setTests((prev) => prev.map((item, i) => (i === index ? { ...item, input: event.target.value } : item)))}
                    className="font-mono text-2xs"
                  />
                  <Textarea
                    rows={3}
                    placeholder="期望输出"
                    value={test.answer}
                    onChange={(event) => setTests((prev) => prev.map((item, i) => (i === index ? { ...item, answer: event.target.value } : item)))}
                    className="font-mono text-2xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
