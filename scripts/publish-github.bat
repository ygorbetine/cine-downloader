@echo off
set /p OWNER=Seu usuario (ou organizacao) do GitHub: 
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-github.ps1" -Owner "%OWNER%"
echo.
pause
