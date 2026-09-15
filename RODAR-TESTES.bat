@echo off
REM ====================================================================
REM  FRONT BEER - Bateria de testes
REM
REM  Clique duas vezes. Na primeira vez ele baixa a biblioteca que os
REM  testes usam (jsdom, uns 20 MB); depois disso e instantaneo.
REM  O resultado fica em testes\resultado.txt.
REM
REM  Nao vai para o ar: esta na lista do .vercelignore.
REM ====================================================================

cd /d "%~dp0"
chcp 65001 >nul

set "LOG=testes\resultado.txt"

echo === RODAR-TESTES iniciado === > "%LOG%"
echo Pasta: %CD% >> "%LOG%"
node -v >> "%LOG%" 2>&1

REM A biblioteca que simula o navegador. Sem ela nenhum teste roda.
if not exist "node_modules\jsdom" (
  echo.
  echo   Primeira vez: baixando a biblioteca de testes ^(jsdom^).
  echo   Isso leva de 30 segundos a 2 minutos. Nao feche a janela.
  echo.
  echo --- npm install --- >> "%LOG%"
  call npm install >> "%LOG%" 2>&1
)

if not exist "node_modules\jsdom" (
  echo.
  echo   [ERRO] Nao consegui baixar o jsdom. Veja testes\resultado.txt
  echo.
  echo === jsdom nao foi instalado === >> "%LOG%"
  pause
  exit /b 1
)

echo.
echo   Rodando a bateria de testes do Front Beer...
echo.
echo --- bateria --- >> "%LOG%"

node testes\rodar.mjs >> "%LOG%" 2>&1
set CODIGO=%errorlevel%

echo. >> "%LOG%"
echo === fim, codigo de saida %CODIGO% === >> "%LOG%"

type "%LOG%"

echo.
echo   ------------------------------------------------------------
if "%CODIGO%"=="0" (
  echo   TUDO PASSOU.
) else (
  echo   ALGO FALHOU - veja testes\resultado.txt
)
echo   ------------------------------------------------------------
echo.
pause
