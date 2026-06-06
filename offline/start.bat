@echo off
chcp 65001 >nul
title خادم إدارة المكتب
color 0A
cd /d "%~dp0"
node server.mjs
pause
