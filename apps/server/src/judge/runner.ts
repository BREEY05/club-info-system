/** 子进程执行与工具链探测（本地判题用，不依赖任何外部服务）。 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  wallMs: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  launchError?: string;
}

export interface RunOptions {
  cmd: string;
  args: string[];
  cwd: string;
  stdin?: string;
  timeLimitMs: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
}

const DEFAULT_MAX_OUTPUT = 16 * 1024 * 1024;

function decode(buffer: Buffer): string {
  let data = buffer;
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) data = data.subarray(3);
  const text = data.toString('utf8');
  // 替换非法的 UTF-8 序列，避免脏字节进入比对逻辑
  return text.includes('\uFFFD') ? Buffer.from(data).toString('latin1') === text ? text : data.toString('utf8') : text;
}

/** 执行一个程序，超过时间限制直接杀掉，输出超过上限也会中断。 */
export function runProgram(options: RunOptions): Promise<RunResult> {
  const maxOutput = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    let child;
    try {
      child = spawn(options.cmd, options.args, {
        cwd: options.cwd,
        windowsHide: true,
        env: { ...process.env, ...(options.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        wallMs: 0,
        timedOut: false,
        outputLimitExceeded: false,
        launchError: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outBytes = 0;
    let errBytes = 0;
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;

    const stop = () => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* 进程可能已退出 */
      }
      // Windows 下子进程可能有自己的子进程，用 taskkill 兜底
      if (process.platform === 'win32' && child.pid) {
        try {
          spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
        } catch {
          /* 忽略 */
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeLimitMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (outputLimitExceeded) return;
      outBytes += chunk.length;
      if (outBytes > maxOutput) {
        outputLimitExceeded = true;
        stop();
        return;
      }
      out.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (errBytes > maxOutput) return;
      errBytes += chunk.length;
      if (errBytes > maxOutput) return;
      err.push(chunk);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        wallMs: Number(process.hrtime.bigint() - started) / 1e6,
        timedOut: false,
        outputLimitExceeded: false,
        launchError: error.message,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: decode(Buffer.concat(out)),
        stderr: decode(Buffer.concat(err)),
        exitCode: code,
        wallMs: Number(process.hrtime.bigint() - started) / 1e6,
        timedOut,
        outputLimitExceeded,
      });
    });

    if (options.stdin !== undefined && options.stdin !== null) {
      child.stdin.on('error', () => {
        /* 程序不读 stdin 时会 EPIPE */
      });
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export interface ToolchainStatus {
  key: 'cpp' | 'c' | 'java' | 'python';
  name: string;
  available: boolean;
  detail: string;
}

function probe(cmd: string, args: string[]): string | null {
  try {
    const result = spawnSync(cmd, args, { windowsHide: true, encoding: 'utf8', timeout: 8000 });
    if (result.error) return null;
    const text = (result.stdout || result.stderr || '').trim().split('\n')[0] ?? '';
    return text.trim() === '' ? cmd : text.trim();
  } catch {
    return null;
  }
}

let cached: { at: number; value: ToolchainStatus[] } | null = null;

function pythonCommand(): { cmd: string; detail: string } | null {
  const candidates = [process.env.PYTHON, 'python', 'python3', 'py'].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    const version = probe(candidate, ['-V']);
    if (version) return { cmd: candidate, detail: version };
  }
  return null;
}

export function detectToolchain(force = false): ToolchainStatus[] {
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.value;

  const gpp = probe('g++', ['--version']);
  const gcc = probe('gcc', ['--version']);
  const javac = probe('javac', ['-version']);
  const javaVersion = probe('java', ['-version']);
  const py = pythonCommand();

  const list: ToolchainStatus[] = [
    { key: 'cpp', name: 'C++', available: gpp !== null, detail: gpp ?? '未检测到 g++（安装 MinGW / MSYS2 后可用）' },
    { key: 'c', name: 'C', available: gcc !== null, detail: gcc ?? '未检测到 gcc' },
    {
      key: 'java',
      name: 'Java',
      available: javac !== null && javaVersion !== null,
      detail: javac !== null && javaVersion !== null ? `${javac} / ${javaVersion}` : '未检测到 javac 或 java（安装 JDK 后可用）',
    },
    { key: 'python', name: 'Python', available: py !== null, detail: py?.detail ?? '未检测到 python' },
  ];
  cached = { at: Date.now(), value: list };
  return list;
}

export function pythonExecutable(): string | null {
  const py = pythonCommand();
  return py?.cmd ?? null;
}

export function hasCompiler(): boolean {
  return ['g++', 'gcc', 'javac'].some((cmd) => {
    try {
      return spawnSync(cmd, ['--version'], { windowsHide: true, timeout: 5000 }).error === undefined;
    } catch {
      return false;
    }
  });
}

/** 判断某个路径是否存在（供题库加载时给前端提示）。 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}
