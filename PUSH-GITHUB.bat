@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title Git push origin

if /i "%~1"=="--help" goto :help
if /i "%~1"=="-h" goto :help
if "%~1"=="/?" goto :help

set "NO_REBASE=0"
set "DID_STASH=0"

:parse_flags
if /i "%~1"=="--no-rebase" set "NO_REBASE=1"& shift& goto parse_flags

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH. Instale o Git for Windows.
  pause
  exit /b 1
)

if not exist ".git\" (
  echo [ERRO] Pasta .git nao encontrada nesta raiz.
  if exist "webapp-01\.git\" (
    echo Dica: use a pasta raiz onde esta o .git, nao so webapp-01.
  )
  pause
  exit /b 1
)

for /f %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%i"
if not defined BRANCH set "BRANCH=main"

for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%u"
if not defined REMOTE_URL (
  echo [ERRO] Remote "origin" nao configurado. Ex.: git remote add origin https://github.com/usuario/repo.git
  pause
  exit /b 1
)

echo.
echo  Raiz:    %CD%
echo  Branch:  !BRANCH!
echo  Remote:  !REMOTE_URL!
echo.

git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (
  echo [AVISO] Ha alteracoes locais nao commitadas. Este script so faz push de commits ja existentes.
  echo          Para commitar tudo antes: use um script de commit ou git add / git commit.
  echo.
)

git status --short 2>nul
echo.

git status 2>nul | findstr /i /c:"modified content" /c:"new commits" >nul
if not errorlevel 1 (
  echo [AVISO] Submodulo ou referencia desatualizada. Veja: git status
  echo.
)

if "!NO_REBASE!"=="1" goto do_push

git status --porcelain 2>nul | findstr /r "." >nul
if errorlevel 1 goto after_stash
echo [INFO] Guardando alteracoes locais em stash antes do rebase (inclui arquivos novos)...
git stash push -u -m "PUSH-GITHUB auto"
if errorlevel 1 (
  echo [ERRO] git stash falhou. Commit, descarte ou stash manualmente e tente de novo.
  pause
  exit /b 1
)
set "DID_STASH=1"
:after_stash

echo == git fetch origin ==
git fetch origin
if errorlevel 1 (
  echo [AVISO] fetch falhou - verifique rede. Tentando push mesmo assim...
  echo.
  goto do_push
)

git rev-parse --verify "origin/!BRANCH!" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Sem origin/!BRANCH! no remoto - pulando rebase. Comum no primeiro push.
  echo.
) else (
  echo == git rebase origin/!BRANCH! ==
  git rebase "origin/!BRANCH!"
  if errorlevel 1 (
    echo.
    echo [ERRO] Rebase interrompido. Resolva conflitos, depois:
    echo   git add ...
    echo   git rebase --continue
    echo Ou cancele: git rebase --abort
    if "!DID_STASH!"=="1" echo Suas alteracoes seguem em stash: git stash list
    pause
    exit /b 1
  )
  echo.
)

:do_push
echo.
echo == git push -u origin !BRANCH! ==
git push -u origin "!BRANCH!"
if errorlevel 1 (
  echo [ERRO] Push falhou. Verifique rede e credenciais.
  if "!DID_STASH!"=="1" echo [INFO] Alteracoes locais ainda estao em stash: git stash list
  pause
  exit /b 1
)

if "!DID_STASH!"=="1" (
  echo.
  echo == git stash pop ==
  git stash pop
  if errorlevel 1 echo [AVISO] Revise git status apos o stash pop.
  echo.
)

echo.
echo [OK] Push concluido para origin na branch !BRANCH!.
pause
exit /b 0

:help
echo.
echo  PUSH-GITHUB.bat - envia commits locais para origin / GitHub
echo.
echo  Fluxo: fetch, rebase em origin/BRANCH se existir, depois push -u origin BRANCH
echo  Nao faz commit. Com alteracoes locais, faz stash antes do rebase e stash pop no fim.
echo.
echo  Uso:
echo    PUSH-GITHUB.bat [opcoes]
echo.
echo  Opcoes:
echo    --no-rebase    Pula fetch e rebase; so executa push
echo    --help         Esta ajuda
echo.
echo  Exemplos:
echo    PUSH-GITHUB.bat
echo    PUSH-GITHUB.bat --no-rebase
echo.
pause
exit /b 0
