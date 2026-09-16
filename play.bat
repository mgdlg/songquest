@echo off
setlocal EnableExtensions
title Song Quest

rem UTF-8, so Next's box-drawing and tick characters render as themselves
rem instead of mojibake in the default Windows codepage.
chcp 65001 >nul 2>nul

rem Run from this file's own folder, so double-clicking works from anywhere.
cd /d "%~dp0"

echo.
echo   SONG QUEST
echo   Name the bird from its voice.
echo   ---------------------------------------------
echo.

rem ---------------------------------------------------------------------
rem Node. The installer adds it to the machine PATH, but a shell opened
rem before the install still has the old copy, which is the usual reason
rem this looks broken on a fresh machine.
rem ---------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found.
  echo.
  echo   Install it, then run this file again:
  echo       winget install OpenJS.NodeJS.LTS
  echo.
  echo   Close this window after installing - a shell opened beforehand
  echo   will not see the new PATH.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
echo   Node %NODEVER%

rem ---------------------------------------------------------------------
rem Bird data. Rounds are played from pre-generated dossiers in
rem public\data\species, so no API key is needed to play - only to
rem regenerate them. An empty folder is the one state where every round
rem would fail, so that is what gets checked.
rem ---------------------------------------------------------------------
set "HAVEDATA="
if exist "public\data\species\*.json" set "HAVEDATA=1"

if not defined HAVEDATA (
  echo.
  echo   ** No bird data found in public\data\species **
  echo.
  echo   The menus will load but no round can start. Generate the data
  echo   once with a Xeno-canto API key in .env.local:
  echo.
  echo       npx tsx scripts/generate-dossiers.ts
  echo.
  choice /c YN /n /m "   Start anyway? [Y/N] "
  if errorlevel 2 exit /b 1
  echo.
) else (
  echo   Bird data found
)

rem ---------------------------------------------------------------------
rem Dependencies
rem ---------------------------------------------------------------------
if not exist "node_modules" (
  echo.
  echo   First run - installing dependencies. This takes a minute.
  echo.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo   Install failed. The output above says why.
    pause
    exit /b 1
  )
)

rem ---------------------------------------------------------------------
rem Already running?
rem
rem Next does not refuse a second instance - it quietly moves to port 3001.
rem Both then share this folder's .next build directory and overwrite each
rem other's chunks, which takes down the copy that was working. Someone
rem double-clicking this file twice must not break their own game, so a
rem busy port means "it is already up", not "start another one".
rem ---------------------------------------------------------------------
netstat -ano -p tcp | findstr /r /c:":3000 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   Song Quest is already running on port 3000.
  echo   Opening it rather than starting a second copy.
  echo.
  start "" "http://localhost:3000"
  exit /b 0
)

rem `ping` rather than `timeout` for the delay: timeout aborts with "Input
rem redirection is not supported" whenever stdin is not a console, which is
rem exactly what happens when this file is launched from a script or a task
rem runner rather than double-clicked.
echo   Opening http://localhost:3000 shortly...
start "" /min cmd /c "ping -n 7 127.0.0.1 >nul & start "" http://localhost:3000"

echo.
echo   Starting. Press Ctrl+C in this window to stop the game.
echo   ---------------------------------------------------------------------
echo.

call npm run dev

rem npm run dev only returns once the server stops or fails to start.
echo.
echo   Server stopped.
pause
endlocal
