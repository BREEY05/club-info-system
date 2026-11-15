@echo off
setlocal
title 社团信息化管理系统
cd /d "%~dp0"

if not defined PORT set "PORT=3000"
if not defined HOST set "HOST=127.0.0.1"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js，请先安装 Node.js 22.18 或更高版本。
  pause
  exit /b 1
)

rem 依赖：优先 pnpm，其次 corepack 提供的 pnpm
set "PNPM="
where pnpm >nul 2>nul && set "PNPM=pnpm"
if not defined PNPM (
  where corepack >nul 2>nul && set "PNPM=corepack pnpm"
)
if not defined PNPM (
  echo [ERROR] 未检测到 pnpm。请执行：npm i -g pnpm
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖...
  call %PNPM% install || goto :fail
)

if not exist "apps\web\dist\index.html" (
  echo [2/2] 正在构建前端...
  call %PNPM% --filter @cims/shared build || goto :fail
  call %PNPM% --filter @cims/web build || goto :fail
)

echo ============================================================
echo   社团信息化管理系统
echo   排课表：http://127.0.0.1:%PORT%/
echo   刷题：  http://127.0.0.1:%PORT%/practice
echo   数据：  %CD%\data\club.db
echo   退出：  在本窗口按 Ctrl+C
echo ============================================================
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/healthz' -TimeoutSec 1 | Out-Null; Start-Process 'http://127.0.0.1:%PORT%/'; exit}catch{Start-Sleep -Milliseconds 500}}"

set "PORT=%PORT%"
set "HOST=%HOST%"
node apps/server/src/index.ts

echo.
echo 服务已停止。
pause
exit /b 0

:fail
echo.
echo 启动失败，请检查上面的错误信息。
pause
exit /b 1
