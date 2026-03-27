@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo  Migrar repositorio Git para esta pasta (webapp)
echo  Inclui webapp-01, webapp-02 e webapp-03
echo ============================================
echo.

if exist ".git\" (
  echo [OK] Ja existe .git nesta pasta. Nada a fazer.
  echo Use GIT-COMMIT-PUSH.bat para commit e push.
  pause
  exit /b 0
)

if not exist "webapp-01\.git\" (
  echo [ERRO] Nao encontrei webapp-01\.git
  echo Clone o repositorio ou inicie o Git dentro de webapp-01 antes.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo Git nao encontrado no PATH.
  pause
  exit /b 1
)

echo A pasta .git sera MOVIDA de webapp-01 para webapp.
echo O historico do Git e mantido; em seguida voce deve commitar a nova estrutura.
echo.
set /p CONF=Continuar? (S/N): 
if /i not "%CONF%"=="S" (
  echo Cancelado.
  pause
  exit /b 0
)

move "webapp-01\.git" ".git"
if errorlevel 1 (
  echo Falha ao mover .git
  pause
  exit /b 1
)

REM GitHub Actions so le workflows em .github na RAIZ do repositorio
if exist "webapp-01\.github" (
  echo Removendo webapp-01\.github (use a pasta .github na raiz webapp).
  rmdir /s /q "webapp-01\.github"
)

echo.
echo == git status (apos mover) ==
git status
echo.
echo PROXIMO PASSO obrigatorio: registrar a nova arvore de pastas.
echo Rode GIT-COMMIT-PUSH.bat e use uma mensagem como:
echo   chore: raiz do repo na pasta webapp (webapp-01, 02 e 03)
echo.
pause
exit /b 0
