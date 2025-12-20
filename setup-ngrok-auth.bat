@echo off
echo ========================================
echo ngrok Authtoken Setup
echo ========================================
echo.
echo You need to get your authtoken from:
echo https://dashboard.ngrok.com/get-started/your-authtoken
echo.
echo 1. Sign up/login at https://dashboard.ngrok.com
echo 2. Copy your authtoken from the dashboard
echo 3. Paste it below when prompted
echo.
set /p AUTHTOKEN="Enter your ngrok authtoken: "

if "%AUTHTOKEN%"=="" (
    echo.
    echo ERROR: No authtoken entered!
    pause
    exit /b 1
)

echo.
echo Looking for ngrok.exe...

REM Check current directory first
if exist "ngrok.exe" (
    set NGROK_PATH=ngrok.exe
    goto :configure
)

REM Check if ngrok is in PATH
where ngrok.exe >nul 2>&1
if %ERRORLEVEL% == 0 (
    set NGROK_PATH=ngrok.exe
    goto :configure
)

REM Check common download locations
if exist "%USERPROFILE%\Downloads\ngrok.exe" (
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok.exe
    goto :configure
)

if exist "%USERPROFILE%\Downloads\ngrok\ngrok.exe" (
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok\ngrok.exe
    goto :configure
)

if exist "%USERPROFILE%\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe" (
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe
    goto :configure
)

echo ERROR: ngrok.exe not found!
pause
exit /b 1

:configure
echo Found ngrok.exe
echo.
echo Configuring authtoken...
%NGROK_PATH% config add-authtoken %AUTHTOKEN%

if %ERRORLEVEL% == 0 (
    echo.
    echo ========================================
    echo SUCCESS! Authtoken configured!
    echo ========================================
    echo.
    echo You can now run start-ngrok.bat to start ngrok
    echo.
) else (
    echo.
    echo ERROR: Failed to configure authtoken
    echo Please check your authtoken and try again
    echo.
)

pause

