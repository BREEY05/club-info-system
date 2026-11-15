/**
 * 题库：每个题目是 problems/<ID>/ 目录，
 *   problem.json  题目配置（与 bluebridge-judge 兼容）
 *   statement.md  题面（Markdown 原文）
 *   tests/*.in    测试输入
 *   tests/*.out   标准输出
 * 全部落本地磁盘，不联网。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { repoRoot } from '../db/index.ts';
import type { CompareMode, Problem, TestCase } from './types.ts';

export function problemsDir(): string {
  return resolve(process.env.PROBLEMS_DIR ?? join(repoRoot, 'problems'));
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

function readJson(path: string): Record<string, unknown> {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('题目配置顶层必须是对象');
  return data as Record<string, unknown>;
}

function positiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

function normalizeCompare(raw: unknown): { mode: CompareMode; tolerance: number } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const mode = String(obj.mode ?? 'token').toLowerCase();
    const tolerance = Number(obj.tolerance ?? 1e-6);
    return { mode: (isCompareMode(mode) ? mode : 'token'), tolerance: Number.isFinite(tolerance) ? tolerance : 1e-6 };
  }
  const mode = String(raw ?? 'token').toLowerCase();
  return { mode: isCompareMode(mode) ? mode : 'token', tolerance: 1e-6 };
}

function isCompareMode(value: string): value is CompareMode {
  return value === 'token' || value === 'line' || value === 'exact' || value === 'float';
}

/** 读取单个题目目录；目录结构不合法时抛错，由上层决定跳过还是报错。 */
export function loadProblem(dir: string): Problem {
  const configPath = join(dir, 'problem.json');
  const data = readJson(configPath);

  const type = String(data.type ?? 'program').toLowerCase() === 'fill_result' ? 'fill_result' : 'program';
  const totalScore = Number(data.score ?? 100);
  const { mode, tolerance } = normalizeCompare(data.comparator);

  const rawTests = Array.isArray(data.tests) ? (data.tests as Record<string, unknown>[]) : [];
  const explicitScores = rawTests.map((test) => (test.score === undefined ? null : Number(test.score)));
  const uniform = explicitScores.every((value) => value === null) || explicitScores.every((value) => value !== null);
  const share = rawTests.length > 0 ? totalScore / rawTests.length : 0;

  const tests: TestCase[] = rawTests.map((raw, i) => {
    const readText = (key: 'input' | 'answer'): string | null => {
      const value = raw[key];
      if (typeof value !== 'string' || value.trim() === '') return null;
      // 兼容旧格式：字段值可能是相对路径
      const candidate = resolve(dir, value);
      if (existsSync(candidate)) return readFileSync(candidate, 'utf8').replace(/^\uFEFF/, '');
      return value;
    };
    return {
      index: i + 1,
      name: String(raw.name ?? `测试点 ${i + 1}`),
      score: uniform && explicitScores[i] !== null ? Number(explicitScores[i]) : share,
      input: readText('input'),
      answer: readText('answer') ?? '',
    };
  });

  const statementPath = join(dir, 'statement.md');
  const statement = existsSync(statementPath) ? readFileSync(statementPath, 'utf8').replace(/^\uFEFF/, '') : '';

  const answers: string[] = [];
  for (const key of ['answer', 'answers']) {
    const value = data[key];
    if (typeof value === 'string') answers.push(value);
    else if (Array.isArray(value)) answers.push(...value.map((item) => String(item)));
  }

  const samples = Array.isArray(data.samples)
    ? (data.samples as Record<string, unknown>[])
        .slice(0, 50)
        .map((item) => ({ input: String(item.input ?? ''), output: String(item.output ?? '') }))
        .filter((item) => item.input.trim() !== '' || item.output.trim() !== '')
    : [];

  const difficultyRaw = String(data.difficulty ?? 'unknown').toLowerCase();
  const difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw) ? (difficultyRaw as Problem['difficulty']) : 'unknown';

  return {
    id: String(data.id ?? dir.split(/[\\/]/).pop()),
    title: String(data.title ?? data.id ?? '未命名题目'),
    type,
    timeLimitMs: positiveInt(data.time_limit_ms, 1000),
    memoryLimitMb: positiveInt(data.memory_limit_mb, 256),
    totalScore: Number.isFinite(totalScore) ? totalScore : 100,
    compareMode: mode,
    floatTolerance: tolerance,
    ignoreCase: Boolean(data.ignore_case),
    description: typeof data.description === 'string' ? data.description.trim() : '',
    inputDescription: String(data.input_description ?? '').trim(),
    outputDescription: String(data.output_description ?? '').trim(),
    statement,
    samples,
    answers: answers.filter((item) => item.trim() !== ''),
    tags: Array.isArray(data.tags) ? (data.tags as unknown[]).map((tag) => String(tag)).slice(0, 6) : [],
    difficulty,
    tests,
  };
}

/** 列出全部题目；单个题目损坏不会影响整个题库。 */
export function listProblems(): { problems: Problem[]; broken: { dir: string; message: string }[] } {
  const root = problemsDir();
  if (!existsSync(root)) return { problems: [], broken: [] };
  const problems: Problem[] = [];
  const broken: { dir: string; message: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    if (!existsSync(join(dir, 'problem.json'))) continue;
    try {
      problems.push(loadProblem(dir));
    } catch (error) {
      broken.push({ dir: entry.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  problems.sort((a, b) => a.id.localeCompare(b.id, 'zh-CN', { numeric: true }));
  return { problems, broken };
}

export function findProblem(id: string): Problem | null {
  const { problems } = listProblems();
  return problems.find((problem) => problem.id === id) ?? null;
}

export interface ProblemInput {
  id: string;
  title: string;
  type: 'program' | 'fill_result';
  statement: string;
  description?: string;
  inputDescription?: string;
  outputDescription?: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  score: number;
  compareMode: CompareMode;
  floatTolerance?: number;
  tags?: string[];
  difficulty?: Problem['difficulty'];
  samples?: { input: string; output: string }[];
  answers?: string[];
  tests: { name?: string; input: string; answer: string; score?: number }[];
}

/** 写入（新建或覆盖）一道题，返回落盘后的题目。 */
export function saveProblem(input: ProblemInput): Problem {
  if (!ID_RE.test(input.id)) throw new Error('题目编号只能包含字母、数字、下划线和短横线（1-32 位）');
  const dir = join(problemsDir(), input.id);
  const testsDir = join(dir, 'tests');
  mkdirSync(testsDir, { recursive: true });

  // 清掉旧测试点，避免残留文件干扰
  for (const file of readdirSync(testsDir)) {
    if (file.startsWith('case_')) rmSync(join(testsDir, file), { force: true });
  }

  const tests = input.tests.map((test, i) => {
    const index = String(i + 1).padStart(2, '0');
    const inName = `tests/case_${index}.in`;
    const outName = `tests/case_${index}.out`;
    writeFileSync(join(dir, inName), test.input ?? '', 'utf8');
    writeFileSync(join(dir, outName), test.answer ?? '', 'utf8');
    return {
      name: test.name && test.name.trim() !== '' ? test.name : `测试点 ${i + 1}`,
      input: inName,
      answer: outName,
      ...(test.score !== undefined ? { score: test.score } : {}),
    };
  });

  const config: Record<string, unknown> = {
    id: input.id,
    title: input.title,
    type: input.type,
    time_limit_ms: input.timeLimitMs,
    memory_limit_mb: input.memoryLimitMb,
    score: input.score,
    comparator: input.compareMode === 'float' ? { mode: 'float', tolerance: input.floatTolerance ?? 1e-6 } : input.compareMode,
    tests,
    statement: undefined,
    description: input.description ?? '',
    input_description: input.inputDescription ?? '',
    output_description: input.outputDescription ?? '',
    samples: input.samples ?? [],
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? 'unknown',
    ...(input.type === 'fill_result' ? { answers: input.answers ?? [] } : {}),
  };
  delete config.statement;

  writeFileSync(join(dir, 'problem.json'), JSON.stringify(config, null, 2), 'utf8');
  writeFileSync(join(dir, 'statement.md'), input.statement ?? '', 'utf8');
  return loadProblem(dir);
}

export function deleteProblem(id: string): boolean {
  if (!ID_RE.test(id)) throw new Error('题目编号不合法');
  const dir = join(problemsDir(), id);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}
