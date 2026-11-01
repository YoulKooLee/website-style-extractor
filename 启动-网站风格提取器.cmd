@echo off
chcp 65001 >nul
rem 网站风格提取器 · 本地开发启动脚本
cd /d "%~dp0"
rem 清掉可能继承来的特殊变量，否则 electron 会被当成普通 node 跑起来（启动即报错）
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="
set "NODE_DIR=D:\Github开源项目\tools\node-v24.22.1-win-x64"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
if not exist node_modules (
  echo 首次运行，正在安装依赖，请稍候...
  call npm install --no-fund --no-audit
)
call npm run dev
pause
