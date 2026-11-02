@echo off
rem Abre o HyperFrames Studio com o projeto do vídeo (http://localhost:3002).
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0..\project"
npx --yes hyperframes@0.9.3 preview --no-open --port 3002
