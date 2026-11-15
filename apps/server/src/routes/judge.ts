import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.ts';
import { parseBody } from '../lib/validate.ts';
import { createSubmission, enqueueSubmission, getSubmission, listSubmissions, problemStats } from '../judge/engine.ts';
import { deleteProblem, findProblem, listProblems, saveProblem } from '../judge/problems.ts';
import { detectToolchain, pythonExecutable } from '../judge/runner.ts';
import type { Language } from '../judge/types.ts';

const submitSchema = z.object({
  problemId: z.string().trim().min(1).max(40),
  language: z.enum(['cpp', 'c', 'java', 'python', 'text']),
  code: z.string().min(1).max(200 * 1024),
});

const testSchema = z.object({
  name: z.string().max(60).optional(),
  input: z.string().max(512 * 1024).default(''),
  answer: z.string().max(512 * 1024).default(''),
  score: z.number().nonnegative().optional(),
});

const problemSchema = z.object({
  id: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(120),
  type: z.enum(['program', 'fill_result']).default('program'),
  statement: z.string().max(200 * 1024).default(''),
  description: z.string().max(200 * 1024).optional(),
  inputDescription: z.string().max(20 * 1024).optional(),
  outputDescription: z.string().max(20 * 1024).optional(),
  timeLimitMs: z.number().int().positive().max(60_000).default(1000),
  memoryLimitMb: z.number().int().positive().max(4096).default(256),
  score: z.number().positive().max(1000).default(100),
  compareMode: z.enum(['token', 'line', 'exact', 'float']).default('token'),
  floatTolerance: z.number().positive().max(1).optional(),
  tags: z.array(z.string().max(16)).max(6).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'unknown']).optional(),
  samples: z.array(z.object({ input: z.string().max(8192), output: z.string().max(8192) })).max(20).optional(),
  answers: z.array(z.string().max(8192)).max(20).optional(),
  tests: z.array(testSchema).max(200).default([]),
});

export const judgeRoutes: FastifyPluginAsync = async (app) => {
  /** 本机判题环境：可用语言与解释器版本（前端据此禁用不可用的语言） */
  app.get('/env', async () => ({
    data: {
      languages: detectToolchain(),
      python: pythonExecutable(),
      offline: true,
    },
  }));

  /** 题目列表：附带成绩概览 */
  app.get('/problems', async () => {
    const { problems, broken } = listProblems();
    const stats = problemStats();
    return {
      data: {
        problems: problems.map((problem) => {
          const stat = stats.get(problem.id);
          return {
            id: problem.id,
            title: problem.title,
            type: problem.type,
            difficulty: problem.difficulty,
            tags: problem.tags,
            timeLimitMs: problem.timeLimitMs,
            memoryLimitMb: problem.memoryLimitMb,
            score: problem.type === 'fill_result' ? problem.totalScore : problem.tests.reduce((sum, test) => sum + test.score, 0),
            testCount: problem.tests.length,
            attempts: stat?.attempts ?? 0,
            bestScore: stat?.bestScore ?? 0,
            solved: stat?.solved ?? false,
            lastVerdict: stat?.lastVerdict ?? null,
          };
        }),
        broken,
      },
    };
  });

  /** 题目详情：不含测试数据，只给样例 */
  app.get('/problems/:id', async (request) => {
    const { id } = request.params as { id: string };
    const problem = findProblem(id);
    if (!problem) throw new AppError(404, 'PROBLEM_NOT_FOUND', '题目不存在');
    return {
      data: {
        problem: {
          id: problem.id,
          title: problem.title,
          type: problem.type,
          difficulty: problem.difficulty,
          tags: problem.tags,
          statement: problem.statement,
          description: problem.description,
          inputDescription: problem.inputDescription,
          outputDescription: problem.outputDescription,
          samples: problem.samples,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          compareMode: problem.compareMode,
          score: problem.type === 'fill_result' ? problem.totalScore : problem.tests.reduce((sum, test) => sum + test.score, 0),
          testCount: problem.tests.length,
        },
      },
    };
  });

  /** 新建或覆盖题目（含测试点文件落盘） */
  app.post('/problems', async (request, reply) => {
    const input = parseBody(problemSchema, request.body ?? {});
    try {
      const problem = saveProblem(input);
      reply.status(201);
      return { data: { problem: { id: problem.id, title: problem.title, testCount: problem.tests.length } } };
    } catch (error) {
      throw new AppError(422, 'PROBLEM_INVALID', error instanceof Error ? error.message : '题目保存失败');
    }
  });

  app.delete('/problems/:id', async (request) => {
    const { id } = request.params as { id: string };
    const removed = deleteProblem(id);
    if (!removed) throw new AppError(404, 'PROBLEM_NOT_FOUND', '题目不存在');
    return { data: { removed: true } };
  });

  /** 提交代码，异步排队判题，立刻返回提交 id */
  app.post('/submissions', async (request, reply) => {
    const input = parseBody(submitSchema, request.body ?? {});
    const problem = findProblem(input.problemId);
    if (!problem) throw new AppError(404, 'PROBLEM_NOT_FOUND', '题目不存在');
    if (problem.type === 'program' && problem.tests.length === 0) {
      throw new AppError(422, 'NO_TESTS', '该题还没有测试点，无法提交');
    }
    const language: Language = problem.type === 'fill_result' ? 'text' : (input.language as Language);
    if (language !== 'text') {
      const tool = detectToolchain().find((item) => item.key === language);
      if (!tool?.available) throw new AppError(422, 'LANGUAGE_UNAVAILABLE', `本机未检测到 ${tool?.name ?? language} 运行环境`);
    }
    const id = createSubmission(problem, language, input.code);
    enqueueSubmission(id);
    reply.status(201);
    return { data: { submissionId: id } };
  });

  app.get('/submissions', async (request) => {
    const query = request.query as { problemId?: string; limit?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 30) || 30, 1), 200);
    return { data: { submissions: listSubmissions(query.problemId, limit) } };
  });

  app.get('/submissions/:id', async (request) => {
    const { id } = request.params as { id: string };
    const submission = getSubmission(Number(id));
    if (!submission) throw new AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在');
    return { data: { submission } };
  });
};
