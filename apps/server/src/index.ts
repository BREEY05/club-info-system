import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { getDb } from './db/index.ts';
import { appRoot } from './lib/appRoot.ts';

// 可选的本机配置（绿色版默认没有这个文件，读不到就跳过）
const localEnv = join(appRoot(), '.env');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const basePort = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
/** 绿色版启动器会设 CIMS_OPEN=1：端口被占用时自动后移，成功后自动打开浏览器。 */
const autoOpen = process.env.CIMS_OPEN === '1';
const autoPort = process.env.CIMS_OPEN === '1' || process.env.CIMS_AUTO_PORT === '1';

function resolveStaticDir(): string | undefined {
  if (process.env.SERVE_STATIC === '0' || process.env.SERVE_STATIC === 'false') return undefined;
  const explicit = process.env.SERVE_STATIC;
  if (explicit) {
    const abs = resolve(explicit);
    return existsSync(join(abs, 'index.html')) ? abs : undefined;
  }
  // 绿色版：<root>/app/public；源码运行：apps/web/dist
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(appRoot(), 'app', 'public'), resolve(here, '../../web/dist')];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return undefined;
}

const staticDir = resolveStaticDir();
const app = buildApp({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  ...(staticDir ? { staticDir } : {}),
});

getDb();
if (staticDir) {
  app.log.info(`托管前端静态文件：${staticDir}`);
}
app.log.info(`数据目录：${join(appRoot(), 'data')}`);

/** 探测端口是否可用：先占一下再释放，避免 Fastify 失败后无法重试。 */
function portFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const probe = createServer();
    probe.once('error', () => resolvePort(false));
    probe.once('listening', () => probe.close(() => resolvePort(true)));
    probe.listen(port, host);
  });
}

async function pickPort(): Promise<number> {
  const attempts = autoPort ? 12 : 1;
  for (let index = 0; index < attempts; index += 1) {
    const port = basePort + index;
    if (await portFree(port)) return port;
    if (index < attempts - 1) app.log.warn(`端口 ${port} 被占用，尝试 ${port + 1}`);
  }
  app.log.error(`端口 ${basePort} 起连续 ${attempts} 个端口都被占用，请用 PORT 指定其他端口`);
  process.exit(1);
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // 打不开浏览器不影响服务本身
  }
}

const port = await pickPort();
try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`;
app.log.info(`社团信息化管理系统已启动：${url}`);
if (autoOpen) {
  app.log.info('正在打开浏览器…（关闭本窗口即停止服务）');
  openBrowser(url);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
