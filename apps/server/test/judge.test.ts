import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compareOutput } from '../src/judge/compare.ts';
import { judgeCode } from '../src/judge/engine.ts';
import { deleteProblem, findProblem, listProblems, saveProblem } from '../src/judge/problems.ts';
import { detectToolchain } from '../src/judge/runner.ts';

describe('输出比对', () => {
  it('token 模式忽略多余空白', () => {
    expect(compareOutput('token', '1 2 3\n', '1   2\n3\n').ok).toBe(true);
    expect(compareOutput('token', '1 2 3', '1 2 4').ok).toBe(false);
  });

  it('line 模式按行比较并忽略行末空白', () => {
    expect(compareOutput('line', 'a b\nc\n', 'a b   \nc').ok).toBe(true);
    expect(compareOutput('line', 'a\nb\n', 'a c').ok).toBe(false);
  });

  it('float 模式按误差比较', () => {
    expect(compareOutput('float', '1.0000001', '1.0', 1e-6).ok).toBe(true);
    expect(compareOutput('float', '1.01', '1.0', 1e-6).ok).toBe(false);
  });

  it('空输出判为错误', () => {
    expect(compareOutput('token', '42', '   ').ok).toBe(false);
  });
});

describe('判题引擎（Python）', () => {
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cims-problems-'));
    vi.stubEnv('PROBLEMS_DIR', dir);
    saveProblem({
      id: 'T1',
      title: '两数之和',
      type: 'program',
      statement: '输入 a b，输出 a+b',
      timeLimitMs: 2000,
      memoryLimitMb: 128,
      score: 100,
      compareMode: 'token',
      tests: [
        { name: '样例', input: '1 2\n', answer: '3\n' },
        { name: '负数', input: '-5 3\n', answer: '-2\n' },
      ],
    });
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('题目落盘后可再次读取', () => {
    const { problems } = listProblems();
    expect(problems.map((item) => item.id)).toContain('T1');
    const problem = findProblem('T1');
    expect(problem?.tests).toHaveLength(2);
    expect(problem?.tests[0]?.answer.trim()).toBe('3');
  });

  it('正确代码全部通过', async () => {
    const problem = findProblem('T1')!;
    const result = await judgeCode(problem, 'a, b = map(int, input().split())\nprint(a + b)\n', 'python');
    expect(result.verdict).toBe('AC');
    expect(result.score).toBe(100);
  });

  it('错误答案判 WA', async () => {
    const problem = findProblem('T1')!;
    const result = await judgeCode(problem, 'a, b = map(int, input().split())\nprint(a - b)\n', 'python');
    expect(result.verdict).toBe('WA');
    expect(result.score).toBe(0);
    expect(result.tests.every((test) => test.verdict === 'WA')).toBe(true);
  });

  it('语法错误判 CE', async () => {
    const problem = findProblem('T1')!;
    const result = await judgeCode(problem, 'print(1', 'python');
    expect(result.verdict).toBe('CE');
  });

  it('删除题目后不可再读取', () => {
    expect(deleteProblem('T1')).toBe(true);
    expect(findProblem('T1')).toBeNull();
  });

  it('工具链探测至少返回四项', () => {
    expect(detectToolchain(true).map((item) => item.key)).toEqual(['cpp', 'c', 'java', 'python']);
  });
});
