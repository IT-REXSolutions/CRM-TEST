@echo off
REM IT REX RMM Agent - Quick Installer
REM Run as Administrator

set /p TOKEN="Enter Enrollment Token: "
set /p URL="Enter API URL (e.g., https://servicedesk.example.com/api): "

echo.
echo Starting IT REX RMM Agent Installation...
echo.

powershell -ExecutionPolicy Bypass -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%URL%/../agent/itrex-rmm-agent.ps1' -OutFile '%TEMP%\itrex-rmm-agent.ps1'; Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File %TEMP%\itrex-rmm-agent.ps1 -EnrollmentToken %TOKEN% -ApiUrl %URL%' -Verb RunAs -Wait }"

echo.
echo Installation completed!
pause
