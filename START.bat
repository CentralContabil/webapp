@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado no PATH. Instale a versao LTS e tente de novo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm nao encontrado no PATH.
  pause
  exit /b 1
)

echo npm install (atualiza dependencias e recria links @webapp/* se a pasta foi movida^)...
call npm install
if errorlevel 1 (
  echo Falha no npm install.
  pause
  exit /b 1
)

echo.
echo Iniciando: Redis via Docker + API + workers + frontend Vite
echo Requer Docker em execucao. Se o Redis ja estiver em 127.0.0.1:6379, use: npm run dev
echo.
call npm run dev:stack
if errorlevel 1 (
  echo.
  echo Encerrado com erro. Sem Docker, suba o Redis e rode: npm run dev
  pause
)
exit /b %ERRORLEVEL%
