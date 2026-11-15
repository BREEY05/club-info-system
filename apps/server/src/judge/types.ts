/** 判题相关的共享类型（与 bluebridge-judge 的 problem.json 结构保持兼容）。 */

export type Language = 'cpp' | 'c' | 'java' | 'python' | 'text' | 'unknown';
export type CompareMode = 'token' | 'line' | 'exact' | 'float';
export type Verdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'SE';

export interface TestCase {
  index: number;
  name: string;
  score: number;
  /** 输入文本；null 表示无输入 */
  input: string | null;
  /** 标准输出文本 */
  answer: string;
}

export interface Problem {
  id: string;
  title: string;
  type: 'program' | 'fill_result';
  timeLimitMs: number;
  memoryLimitMb: number;
  totalScore: number;
  compareMode: CompareMode;
  floatTolerance: number;
  ignoreCase: boolean;
  description: string;
  inputDescription: string;
  outputDescription: string;
  statement: string;
  samples: { input: string; output: string }[];
  answers: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  tests: TestCase[];
}

export interface TestResult {
  index: number;
  name: string;
  verdict: Verdict;
  score: number;
  maxScore: number;
  timeMs: number;
  message: string;
}

export interface JudgeResult {
  verdict: Verdict;
  score: number;
  maxScore: number;
  timeMs: number;
  message: string;
  compileOutput: string;
  tests: TestResult[];
}

export const LANGUAGE_NAMES: Record<string, string> = {
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  python: 'Python',
  text: '结果填空',
  unknown: '未知',
};
