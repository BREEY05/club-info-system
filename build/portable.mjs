#!/usr/bin/env node
/**
 * 生成免安装绿色版：自带 Node 运行时、单文件后端、已构建前端、内置题库。
 * 用法：node build/portable.mjs [--no-zip]
 * 产物：dist/portable/club-info-system/{start.cmd,runtime,app,problems,使用说明.txt}
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version ?? '1.0.0';
const appTitle = '社团信息化管理系统';
// 目录名保持 ASCII：fs.cp / zip / 各类脚本对非 ASCII 路径的处理并不一致
const bundleName = 'club-info-system';
const distRoot = join(root, 'dist', 'portable');
const stage = join(distRoot, bundleName);
const isWindows = process.platform === 'win32';
const nodeBinName = isWindows ? 'node.exe' : 'node';

function log(step, message) {
  process.stdout.write(`[${step}] ${message}\n`);
}

/** 自己实现递归拷贝：Node 的 fs.cpSync 在非 ASCII 目标路径上会静默失败。 */
function copyTree(src, dest) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) copyTree(join(src, entry), join(dest, entry));
    return countFiles(dest);
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return 1;
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}


function ensureWebDist() {
  const indexHtml = join(root, 'apps', 'web', 'dist', 'index.html');
  if (existsSync(indexHtml)) return;
  log('build', '前端未构建，先执行 pnpm build …');
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit', shell: isWindows });
}

/** .cmd 用 GBK 写盘，避免中文 Windows 控制台乱码。 */
function writeLauncher(target, text) {
  if (!isWindows) {
    writeFileSync(target, text.replace(/\r\n/g, '\n'), 'utf8');
    return;
  }
  const utf8 = join(distRoot, '.launcher.tmp.cmd');
  writeFileSync(utf8, text, 'utf8');
  const ps = [
    '$ErrorActionPreference = "Stop"',
    `$text = [System.IO.File]::ReadAllText('${utf8}', [System.Text.Encoding]::UTF8)`,
    `[System.IO.File]::WriteAllText('${target}', $text, [System.Text.Encoding]::GetEncoding(936))`,
  ].join('; ');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
  rmSync(utf8, { force: true });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

ensureWebDist();

log('1/6', '清理输出目录');
rmSync(distRoot, { recursive: true, force: true });
mkdirSync(join(stage, 'app', 'public'), { recursive: true });
mkdirSync(join(stage, 'runtime'), { recursive: true });

log('2/6', '打包后端为单文件 ESM');
await build({
  entryPoints: [join(root, 'apps', 'server', 'src', 'index.ts')],
  outfile: join(stage, 'app', 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: { 'process.env.APP_VERSION': JSON.stringify(version) },
  banner: {
    js: [
      "import { createRequire as __cimsCreateRequire } from 'node:module';",
      'const require = __cimsCreateRequire(import.meta.url);',
    ].join('\n'),
  },
});

log('3/6', '拷贝前端产物与数据库 schema');
const webDist = join(root, 'apps', 'web', 'dist');
const webCount = copyTree(webDist, join(stage, 'app', 'public'));
copyTree(join(root, 'apps', 'server', 'src', 'db', 'schema.sql'), join(stage, 'app', 'schema.sql'));
writeFileSync(
  join(stage, 'app', 'portable.json'),
  JSON.stringify({ name: appTitle, version, builtAt: new Date().toISOString() }, null, 2),
  'utf8',
);
log('3/6', `前端文件 ${webCount} 个`);

log('4/6', '拷贝题库与 Node 运行时');
const problemCount = copyTree(join(root, 'problems'), join(stage, 'problems'));
log('4/6', `题库文件 ${problemCount} 个`);
copyTree(process.execPath, join(stage, 'runtime', nodeBinName));

log('5/6', '生成启动器与说明');
if (isWindows) {
  writeLauncher(
    join(stage, 'start.cmd'),
    [
      '@echo off',
      'chcp 936 >nul',
      'setlocal',
      'title 社团信息化管理系统',
      'cd /d "%~dp0"',
      'if not exist "runtime\\node.exe" (',
      '  echo [错误] runtime\\node.exe 缺失，请重新解压完整的压缩包。',
      '  pause',
      '  exit /b 1',
      ')',
      'set "CIMS_OPEN=1"',
      'rem 端口被占用会自动顺延，浏览器会自动打开',
      '"%~dp0runtime\\node.exe" "%~dp0app\\server.mjs"',
      'echo.',
      'echo 服务已停止。按任意键关闭窗口。',
      'pause >nul',
      'exit /b 0',
      '',
    ].join('\r\n'),
  );
  writeLauncher(
    join(stage, '以指定端口启动.cmd'),
    [
      '@echo off',
      'chcp 936 >nul',
      'setlocal',
      'title 社团信息化管理系统',
      'cd /d "%~dp0"',
      'set "CIMS_OPEN=1"',
      'if "%~1"=="" (set "PORT=3000") else (set "PORT=%~1")',
      '"%~dp0runtime\\node.exe" "%~dp0app\\server.mjs"',
      'echo.',
      'echo 服务已停止。按任意键关闭窗口。',
      'pause >nul',
      '',
    ].join('\r\n'),
  );
} else {
  const sh = [
    '#!/usr/bin/env bash',
    'set -e',
    'cd "$(dirname "$0")"',
    'export CIMS_OPEN=1',
    'exec "./runtime/node" "app/server.mjs"',
    '',
  ].join('\n');
  writeFileSync(join(stage, 'start.sh'), sh, 'utf8');
  execFileSync('chmod', ['+x', join(stage, 'start.sh')]);
}

writeFileSync(
  join(stage, '使用说明.txt'),
  [
    `${appTitle} v${version}`,
    '',
    '一、怎么用',
    '  1. 双击 start.cmd（不需要安装 Node、pnpm 或任何依赖，也不需要联网）',
    '  2. 浏览器会自动打开 http://127.0.0.1:3000/',
    '  3. 使用过程中不要关闭黑色命令行窗口；关闭窗口即停止程序',
    '',
    '二、目录说明',
    '  data\\club.db        全部数据（成员、排课、提交记录）都在这个文件里',
    '  problems\\           题库，一题一个文件夹，改完刷新页面即生效',
    '  runtime\\node.exe    自带的 Node 运行时，不用管它',
    '  app\\                程序本体，不用管它',
    '',
    '三、备份与迁移',
    '  直接把 data\\club.db 复制走就是备份；换电脑时连同 problems\\ 一起拷过去即可。',
    '',
    '四、刷题的语言支持',
    '  判题需要本机装有对应语言的工具链：',
    '    Python  -> python 命令（安装 Python 时勾选 Add to PATH）',
    '    C/C++   -> g++ / gcc（例如 MinGW-w64）',
    '    Java    -> javac / java（需要 JDK）',
    '  缺哪个语言，题库页会把那个语言置灰，其他功能不受影响。',
    '',
    '五、端口',
    '  默认 3000；被占用时会自动顺延到 3001、3002…（看窗口里的提示地址）。',
    '  想固定端口：双击「以指定端口启动.cmd 5000」这种方式，或设环境变量 PORT。',
    '',
  ].join('\r\n'),
  'utf8',
);

const appFiles = countFiles(join(stage, 'app'));
const runtimeFile = join(stage, 'runtime', nodeBinName);
if (!existsSync(runtimeFile) || statSync(runtimeFile).size < 1024 * 1024) {
  throw new Error('运行时缺失或异常：' + runtimeFile);
}
if (!existsSync(join(stage, 'app', 'public', 'index.html'))) throw new Error('前端产物缺失：app/public/index.html');
if (!existsSync(join(stage, 'problems'))) throw new Error('题库缺失');
if (!existsSync(join(stage, isWindows ? 'start.cmd' : 'start.sh'))) throw new Error('启动器缺失');
const sizeMb = (dirSize(stage) / 1024 / 1024).toFixed(1);
log('6/6', `绿色版就绪：${stage}（${sizeMb} MB，app ${appFiles} 个文件）`);

if (!process.argv.includes('--no-zip')) {
  const zipPath = join(root, 'dist', `${bundleName}-v${version}-${isWindows ? 'win' : process.platform}-${process.arch}.zip`);
  rmSync(zipPath, { force: true });
  log('zip', `压缩为 ${zipPath}`);
  if (isWindows) {
    // 用 ZipFile + 显式 UTF-8：Compress-Archive 不写 UTF-8 标记，中文文件名解压会乱码
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        [
          'Add-Type -AssemblyName System.IO.Compression.FileSystem',
          `; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stage}', '${zipPath}',`,
          '  [System.IO.Compression.CompressionLevel]::Optimal, $true, [System.Text.Encoding]::UTF8)',
        ].join(''),
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('zip', ['-r', '-q', zipPath, bundleName], { cwd: distRoot, stdio: 'inherit' });
  }
  log('zip', `完成：${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB`);
}
