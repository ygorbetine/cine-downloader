@echo off
rem Atualiza o yt-dlp instalado (Instagram/TikTok quebram com frequência).
set "EXT=%APPDATA%\Adobe\CEP\extensions\cine-downloader\bin\yt-dlp.exe"
"%EXT%" -U
echo.
pause
