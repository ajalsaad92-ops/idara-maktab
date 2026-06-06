@echo off
chcp 65001 >nul
title إعادة تعيين كلمة سر المدير
cd /d "%~dp0"
node create-admin.mjs
pause
