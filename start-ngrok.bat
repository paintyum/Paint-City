@echo off
echo Stopping any existing ngrok processes...
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Looking for ngrok.exe...

REM Check current directory first
if exist "ngrok.exe" (
    echo Found ngrok.exe in current directory
    set NGROK_PATH=ngrok.exe
    goto :start
)

REM Check if ngrok is in PATH
where ngrok.exe >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Found ngrok.exe in PATH
    set NGROK_PATH=ngrok.exe
    goto :start
)

REM Check common download locations
if exist "%USERPROFILE%\Downloads\ngrok.exe" (
    echo Found ngrok.exe in Downloads folder
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok.exe
    goto :start
)

if exist "%USERPROFILE%\Downloads\ngrok\ngrok.exe" (
    echo Found ngrok.exe in Downloads\ngrok folder
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok\ngrok.exe
    goto :start
)

REM Check ngrok-v3 folder (common extraction location)
if exist "%USERPROFILE%\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" (
    echo Found ngrok.exe in Downloads\ngrok-v3-stable-windows-amd64 folder
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe
    goto :start
)

REM If not found, show error and instructions
echo.
echo ERROR: ngrok.exe not found!
echo.
echo Please either:
echo 1. Place ngrok.exe in this folder: %CD%
echo 2. Add ngrok.exe to your PATH
echo 3. Or edit this file and set the full path to ngrok.exe
echo.
echo You can download ngrok from: https://ngrok.com/download
echo.
pause
exit /b 1

:start
echo.
echo Starting ngrok...
echo Using: %NGROK_PATH%
echo.
echo NOTE: The warning page bypass is handled automatically by the website code.
echo.
REM ngrok v3 uses LOCALAPPDATA by default, so we don't need to specify config
REM It will automatically use: %LOCALAPPDATA%\ngrok\ngrok.yml
%NGROK_PATH% http 8000

pause

