/** 判题核心：编译、逐测试点运行、比对汇总；提交排队与落库。 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { all, get, repoRoot, run } from '../db/index.ts';
import { compareOutput } from './compare.ts';
import { findProblem } from './problems.ts';
import { detectToolchain, pythonExecutable, runProgram } from './runner.ts';
import type { JudgeResult, Language, Problem, TestResult, Verdict } from './types.ts';

const COMPILE_TIME_MS = 20_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const TIME_OVERHEAD: Record<string, number> = { cpp: 0, c: 0, java: 300, python: 120 };

export function judgeTempDir(): string {
  return join(repoRoot, 'data', 'judge-tmp');
}

export interface CompileOutcome {
  ok: boolean;
  output: string;
  command?: { cmd: string; args: string[] };
}

function exeSuffix(): string {
  return process.platform === 'win32' ? '.exe' : '';
}

async function compileSource(problem: Problem, language: Language, sourcePath: string, buildDir: string, className: string): Promise<CompileOutcome> {
  if (language === 'cpp' || language === 'c') {
    const compiler = language === 'cpp' ? 'g++' : 'gcc';
    const output = join(buildDir, 'main' + exeSuffix());
    const args =
      language === 'cpp'
        ? ['-O2', '-std=c++17', '-DONLINE_JUDGE', '-o', output, sourcePath]
        : ['-O2', '-std=c11', '-DONLINE_JUDGE', '-o', output, sourcePath];
    const result = await runProgram({ cmd: compiler, args, cwd: buildDir, timeLimitMs: COMPILE_TIME_MS, maxOutputBytes: 1024 * 1024 });
    if (result.launchError) return { ok: false, output: `无法启动编译器 ${compiler}：${result.launchError}` };
    if (result.timedOut) return { ok: false, output: '编译超时（超过 20 秒）\n' + result.stderr };
    if (result.exitCode !== 0) return { ok: false, output: result.stderr || `编译失败（退出码 ${result.exitCode}）` };
    return { ok: true, output: result.stderr, command: { cmd: output, args: [] } };
  }

  if (language === 'java') {
    const compile = await runProgram({
      cmd: 'javac',
      args: ['-encoding', 'UTF-8', '-d', buildDir, sourcePath],
      cwd: buildDir,
      timeLimitMs: COMPILE_TIME_MS,
      maxOutputBytes: 1024 * 1024,
    });
    if (compile.launchError) return { ok: false, output: `无法启动 javac：${compile.launchError}` };
    if (compile.timedOut) return { ok: false, output: '编译超时（超过 20 秒）\n' + compile.stderr };
    if (compile.exitCode !== 0) return { ok: false, output: compile.stderr || '编译失败' };
    return {
      ok: true,
      output: compile.stderr,
      command: {
        cmd: 'java',
        args: [`-Xmx${problem.memoryLimitMb}m`, '-XX:+UseSerialGC', '-cp', buildDir, className],
      },
    };
  }

  const python = pythonExecutable();
  if (!python) return { ok: false, output: '未检测到 Python 解释器' };
  const check = await runProgram({
    cmd: python,
    args: ['-I', '-B', '-m', 'py_compile', sourcePath],
    cwd: buildDir,
    timeLimitMs: COMPILE_TIME_MS,
    maxOutputBytes: 1024 * 1024,
  });
  if (check.launchError) return { ok: false, output: `无法启动 Python：${check.launchError}` };
  if (check.timedOut) return { ok: false, output: '语法检查超时' };
  if (check.exitCode !== 0) return { ok: false, output: check.stderr || '语法错误' };
  return { ok: true, output: check.stderr, command: { cmd: python, args: ['-I', '-B', sourcePath] } };
}

function prepareSource(code: string, language: Language, buildDir: string): { path: string; className: string } {
  const text = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (language === 'java') {
    const match = /public\s+(?:final\s+|abstract\s+)?class\s+(\w+)/.exec(text);
    const className = match?.[1] ?? 'Main';
    const path = join(buildDir, `${className}.java`);
    writeFileSync(path, text, 'utf8');
    return { path, className };
  }
  const suffix = language === 'cpp' ? '.cpp' : language === 'c' ? '.c' : '.py';
  const path = join(buildDir, 'main' + suffix);
  writeFileSync(path, text, 'utf8');
  return { path, className: '' };
}

function compileErrorLine(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const withError = lines.find((line) => /error|错误/i.test(line));
  return withError ?? lines[lines.length - 1] ?? '编译失败';
}

function classify(
  run: Awaited<ReturnType<typeof runProgram>>,
  timeLimitMs: number,
): { verdict: Verdict; message: string } {
  if (run.launchError) return { verdict: 'SE', message: `无法启动程序：${run.launchError}` };
  if (run.timedOut || run.wallMs > timeLimitMs + 50) {
    return { verdict: 'TLE', message: `超过时间限制：用时 ${Math.round(run.wallMs)} ms，限制 ${timeLimitMs} ms` };
  }
  if (run.outputLimitExceeded) return { verdict: 'SE', message: `输出超过限制（${MAX_OUTPUT_BYTES / 1024 / 1024} MB）` };
  if (run.exitCode !== 0) {
    const extra = run.stderr.trim().slice(-240);
    return { verdict: 'RE', message: `程序异常退出（退出码 ${run.exitCode}）` + (extra ? '：' + extra : '') };
  }
  return { verdict: 'AC', message: '' };
}

/** 评测一份代码（同步等待评测结束）。 */
export async function judgeCode(problem: Problem, code: string, language: Language): Promise<JudgeResult> {
  const maxScore = problem.type === 'fill_result' ? problem.totalScore : problem.tests.reduce((sum, test) => sum + test.score, 0);

  if (problem.type === 'fill_result') {
    const answer = code.trim();
    const matched = problem.answers.some((item) => (problem.ignoreCase ? item.trim().toLowerCase() === answer.toLowerCase() : item.trim() === answer));
    const result: JudgeResult = {
      verdict: matched ? 'AC' : 'WA',
      score: matched ? problem.totalScore : 0,
      maxScore,
      timeMs: 0,
      message: matched ? '' : '答案不正确',
      compileOutput: '',
      tests: [{ index: 1, name: '答案比对', verdict: matched ? 'AC' : 'WA', score: matched ? problem.totalScore : 0, maxScore, timeMs: 0, message: matched ? '' : '答案不正确' }],
    };
    return result;
  }

  if (problem.tests.length === 0) {
    return { verdict: 'SE', score: 0, maxScore, timeMs: 0, message: '题目还没有测试点，暂不能评测', compileOutput: '', tests: [] };
  }

  const toolchain = detectToolchain();
  const available = toolchain.find((item) => item.key === language);
  if (!available || !available.available) {
    return {
      verdict: 'CE',
      score: 0,
      maxScore,
      timeMs: 0,
      message: `本机未检测到 ${available?.name ?? language} 运行环境，无法评测`,
      compileOutput: available?.detail ?? '',
      tests: [],
    };
  }

  const buildDir = join(judgeTempDir(), randomUUID());
  mkdirSync(buildDir, { recursive: true });
  try {
    const { path, className } = prepareSource(code, language, buildDir);
    const compiled = await compileSource(problem, language, path, buildDir, className);
    const compileOutput = compiled.output.split(buildDir).join('');
    if (!compiled.ok || !compiled.command) {
      return { verdict: 'CE', score: 0, maxScore, timeMs: 0, message: compileErrorLine(compileOutput), compileOutput, tests: [] };
    }

    const timeLimit = problem.timeLimitMs + (TIME_OVERHEAD[language] ?? 0);
    const tests: TestResult[] = [];
    let totalTime = 0;

    for (const test of problem.tests) {
      const { cmd, args } = compiled.command;
      const runResult = await runProgram({
        cmd,
        args,
        cwd: buildDir,
        stdin: test.input ?? '',
        timeLimitMs: timeLimit,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });
      let verdict: Verdict;
      let message: string;
      ({ verdict, message } = classify(runResult, timeLimit));
      let score = 0;
      if (verdict === 'AC') {
        const compared = compareOutput(problem.compareMode, test.answer, runResult.stdout, problem.floatTolerance);
        if (compared.ok) {
          score = test.score;
        } else {
          verdict = 'WA';
          message = compared.message;
        }
      }
      tests.push({
        index: test.index,
        name: test.name,
        verdict,
        score,
        maxScore: test.score,
        timeMs: Math.round(runResult.wallMs),
        message,
      });
      totalTime += runResult.wallMs;
    }

    const failed = tests.filter((test) => test.verdict !== 'AC');
    const priority: Verdict[] = ['SE', 'CE', 'TLE', 'RE', 'WA'];
    const verdict: Verdict = failed.length === 0 ? 'AC' : failed.map((test) => test.verdict).sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0]!;
    return {
      verdict,
      score: tests.reduce((sum, test) => sum + test.score, 0),
      maxScore,
      timeMs: Math.round(totalTime),
      message: failed.find((test) => test.verdict === verdict)?.message ?? '',
      compileOutput,
      tests,
    };
  } finally {
    rmSync(buildDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- 提交队列

interface SubmissionRow {
  id: number;
  problem_id: string;
  language: string;
  code: string;
  status: string;
}

let chain: Promise<void> = Promise.resolve();

async function processSubmission(id: number): Promise<void> {
  const row = get<SubmissionRow>('SELECT id, problem_id, language, code, status FROM judge_submission WHERE id = ?', [id]);
  if (!row || row.status !== 'pending') return;
  run("UPDATE judge_submission SET status = 'running' WHERE id = ?", [id]);
  try {
    const problem = findProblem(row.problem_id);
    if (!problem) {
      run("UPDATE judge_submission SET status = 'done', verdict = 'SE', message = ? WHERE id = ?", ['题目不存在或已被删除', id]);
      return;
    }
    const result = await judgeCode(problem, row.code, row.language as Language);
    run(
      `UPDATE judge_submission
         SET status = 'done', verdict = ?, score = ?, max_score = ?, time_ms = ?, message = ?, compile_output = ?, tests_json = ?
       WHERE id = ?`,
      [
        result.verdict,
        result.score,
        result.maxScore,
        result.timeMs,
        result.message,
        result.compileOutput,
        JSON.stringify(result.tests),
        id,
      ],
    );
  } catch (error) {
    run("UPDATE judge_submission SET status = 'done', verdict = 'SE', message = ? WHERE id = ?", [
      error instanceof Error ? error.message : String(error),
      id,
    ]);
  }
}

/** 排队评测（串行执行，避免多份代码同时抢占 CPU 影响计时）。 */
export function enqueueSubmission(id: number): void {
  chain = chain.then(() => processSubmission(id)).catch(() => undefined);
}

export interface SubmissionSummary {
  id: number;
  problemId: string;
  problemTitle: string;
  language: string;
  status: string;
  verdict: string | null;
  score: number;
  maxScore: number;
  timeMs: number;
  message: string | null;
  createdAt: string;
  code?: string;
  compileOutput?: string | null;
  tests?: TestResult[];
}

interface SubmissionDbRow {
  id: number;
  problem_id: string;
  problem_title: string;
  language: string;
  status: string;
  verdict: string | null;
  score: number;
  max_score: number;
  time_ms: number;
  message: string | null;
  compile_output: string | null;
  tests_json: string | null;
  created_at: string;
  code?: string;
}

function toSummary(row: SubmissionDbRow, withDetail: boolean): SubmissionSummary {
  return {
    id: row.id,
    problemId: row.problem_id,
    problemTitle: row.problem_title,
    language: row.language,
    status: row.status,
    verdict: row.verdict,
    score: row.score,
    maxScore: row.max_score,
    timeMs: row.time_ms,
    message: row.message,
    createdAt: row.created_at,
    ...(withDetail
      ? {
          code: row.code ?? '',
          compileOutput: row.compile_output,
          tests: row.tests_json ? (JSON.parse(row.tests_json) as TestResult[]) : [],
        }
      : {}),
  };
}

const SUMMARY_COLUMNS = 'id, problem_id, problem_title, language, status, verdict, score, max_score, time_ms, message, compile_output, tests_json, created_at';

export function listSubmissions(problemId?: string, limit = 50): SubmissionSummary[] {
  const rows = problemId
    ? all<SubmissionDbRow>(`SELECT ${SUMMARY_COLUMNS} FROM judge_submission WHERE problem_id = ? ORDER BY id DESC LIMIT ?`, [problemId, limit])
    : all<SubmissionDbRow>(`SELECT ${SUMMARY_COLUMNS} FROM judge_submission ORDER BY id DESC LIMIT ?`, [limit]);
  return rows.map((row) => toSummary(row, false));
}

export function getSubmission(id: number): SubmissionSummary | null {
  const row = get<SubmissionDbRow>(`SELECT ${SUMMARY_COLUMNS}, code FROM judge_submission WHERE id = ?`, [id]);
  return row ? toSummary(row, true) : null;
}

export function createSubmission(problem: Problem, language: Language, code: string): number {
  const result = run(
    'INSERT INTO judge_submission(problem_id, problem_title, language, code, status, max_score) VALUES (?, ?, ?, ?, ?, ?)',
    [problem.id, problem.title, language, code, 'pending', problem.type === 'fill_result' ? problem.totalScore : problem.tests.reduce((sum, test) => sum + test.score, 0)],
  );
  return result.lastInsertRowid;
}

/** 每题的最佳成绩与提交次数，用于题目列表展示。 */
export function problemStats(): Map<string, { attempts: number; bestScore: number; solved: boolean; lastVerdict: string | null }> {
  const rows = all<{ problem_id: string; attempts: number; best: number | null; solved: number; last_verdict: string | null }>(
    `SELECT problem_id,
            COUNT(*) AS attempts,
            MAX(score) AS best,
            MAX(CASE WHEN verdict = 'AC' THEN 1 ELSE 0 END) AS solved,
            (SELECT verdict FROM judge_submission j2 WHERE j2.problem_id = j.problem_id AND j2.status = 'done' ORDER BY j2.id DESC LIMIT 1) AS last_verdict
       FROM judge_submission j
      WHERE status = 'done'
      GROUP BY problem_id`,
  );
  const map = new Map<string, { attempts: number; bestScore: number; solved: boolean; lastVerdict: string | null }>();
  for (const row of rows) {
    map.set(row.problem_id, {
      attempts: row.attempts,
      bestScore: row.best ?? 0,
      solved: row.solved === 1,
      lastVerdict: row.last_verdict,
    });
  }
  return map;
}
