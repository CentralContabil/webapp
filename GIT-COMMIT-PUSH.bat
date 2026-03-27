@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo Git nao encontrado no PATH. Instale o Git for Windows.
  pause
  exit /b 1
)

if not exist ".git\" (
  echo Repositorio Git nao esta nesta pasta.
  if exist "webapp-01\.git\" (
    echo Execute uma vez: MIGRAR-GIT-PARA-RAIZ.bat
  ) else (
    echo Inicie com: git init
    echo   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
  )
  pause
  exit /b 1
)

echo.
echo == git add -A (raiz webapp: 01 + 02 + 03) ==
git add -A
if errorlevel 1 (
  echo Falha no git add.
  pause
  exit /b 1
)

git status --short
echo.

set "MSG=%*"
if not defined MSG (
  set /p "MSG=Digite a mensagem do commit: "
)
if "!MSG!"=="" set "MSG=chore: atualizacao"

for /f %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%i"
if "!BRANCH!"=="" set "BRANCH=main"

echo.
echo == git commit ==
git commit -m "!MSG!"
if errorlevel 1 (
  echo.
  echo Nada para commitar ou commit cancelado.
  pause
  exit /b 1
)

echo.
echo == git fetch origin ==
git fetch origin
if errorlevel 1 (
  echo Falha no fetch. Verifique rede e remote.
  pause
  exit /b 1
)

echo.
echo == git rebase origin/!BRANCH! ==
git rev-parse --verify "origin/!BRANCH!" >nul 2>&1
if errorlevel 1 (
  echo Remoto ainda nao tem a branch !BRANCH! — pulando rebase (comum no primeiro push).
) else (
  git rebase "origin/!BRANCH!"
  if errorlevel 1 (
    echo.
    echo Rebase interrompido (conflito?). Ajuste os arquivos e depois:
    echo   git add ...
    echo   git rebase --continue
    echo Para desfazer: git rebase --abort
    pause
    exit /b 1
  )
)

echo.
echo == git push origin !BRANCH! ==
git push origin "!BRANCH!"
if errorlevel 1 (
  echo Falha no push. Verifique rede e credenciais.
  pause
  exit /b 1
)

echo.
echo Concluido.
pause
exit /b 0
