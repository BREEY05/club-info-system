import { api } from './client';

export type JudgeLanguage = 'cpp' | 'c' | 'java' | 'python' | 'text';
export type JudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'SE';

export interface ToolchainItem {
  key: 'cpp' | 'c' | 'java' | 'python';
  name: string;
  available: boolean;
  detail: string;
}

export interface JudgeEnv {
  languages: ToolchainItem[];
  python: string | null;
  offline: boolean;
}

export interface ProblemSummary {
  id: string;
  title: string;
  type: 'program' | 'fill_result';
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  tags: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  score: number;
  testCount: number;
  attempts: number;
  bestScore: number;
  solved: boolean;
  lastVerdict: string | null;
}

export interface ProblemDetail {
  id: string;
  title: string;
  type: 'program' | 'fill_result';
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  tags: string[];
  statement: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  samples: { input: string; output: string }[];
  timeLimitMs: number;
  memoryLimitMb: number;
  compareMode: string;
  score: number;
  testCount: number;
}

export interface TestResultItem {
  index: number;
  name: string;
  verdict: JudgeVerdict;
  score: number;
  maxScore: number;
  timeMs: number;
  message: string;
}

export interface SubmissionSummary {
  id: number;
  problemId: string;
  problemTitle: string;
  language: string;
  status: 'pending' | 'running' | 'done';
  verdict: JudgeVerdict | null;
  score: number;
  maxScore: number;
  timeMs: number;
  message: string | null;
  createdAt: string;
  code?: string;
  compileOutput?: string | null;
  tests?: TestResultItem[];
}

export interface ProblemInputPayload {
  id: string;
  title: string;
  type: 'program' | 'fill_result';
  statement: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  score: number;
  compareMode: 'token' | 'line' | 'exact' | 'float';
  difficulty?: 'easy' | 'medium' | 'hard' | 'unknown';
  tags?: string[];
  samples?: { input: string; output: string }[];
  answers?: string[];
  tests: { name?: string; input: string; answer: string; score?: number }[];
}

export const judgeApi = {
  env: () => api.get<JudgeEnv>('/judge/env'),
  problems: () => api.get<{ problems: ProblemSummary[]; broken: { dir: string; message: string }[] }>('/judge/problems'),
  problem: (id: string) => api.get<{ problem: ProblemDetail }>('/judge/problems/' + encodeURIComponent(id)),
  saveProblem: (payload: ProblemInputPayload) => api.post<{ problem: { id: string } }>('/judge/problems', payload),
  deleteProblem: (id: string) => api.delete('/judge/problems/' + encodeURIComponent(id)),
  submit: (problemId: string, language: JudgeLanguage, code: string) =>
    api.post<{ submissionId: number }>('/judge/submissions', { problemId, language, code }),
  submission: (id: number) => api.get<{ submission: SubmissionSummary }>('/judge/submissions/' + id),
  submissions: (problemId?: string, limit = 30) =>
    api.get<{ submissions: SubmissionSummary[] }>('/judge/submissions', { problemId, limit }),
};
