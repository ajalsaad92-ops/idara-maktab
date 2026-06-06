@echo off
chcp 65001 >nul
title تثبيت إدارة المكتب
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║          تثبيت نظام إدارة المكتب — النسخة الداخلية       ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM التحقق من Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js غير مثبت!
    echo    حمّله من: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js موجود
node --version

REM التحقق من psql
where psql >nul 2>nul
if errorlevel 1 (
    echo ❌ PostgreSQL غير مثبت أو غير موجود في PATH!
    echo    حمّله من: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)
echo ✅ PostgreSQL موجود

REM نسخ .env إن لم يوجد
if not exist .env (
    echo.
    echo 📝 إنشاء ملف .env من النموذج...
    copy .env.example .env >nul
    echo ⚠️  افتح ملف .env وعدّل كلمة سر بوستجرس و JWT_SECRET ثم أعد تشغيل هذا الملف
    notepad .env
    pause
    exit /b 0
)

REM تثبيت الحزم
echo.
echo 📦 تثبيت مكتبات Node.js...
call npm install --omit=dev
if errorlevel 1 (
    echo ❌ فشل تثبيت الحزم
    pause
    exit /b 1
)

REM إنشاء قاعدة البيانات
echo.
echo 🗄️  إنشاء قاعدة البيانات...
for /f "tokens=2 delims==" %%a in ('findstr "^PGPASSWORD=" .env') do set PGPASSWORD=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGDATABASE=" .env') do set DBNAME=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGUSER=" .env') do set PGUSER=%%a

psql -U %PGUSER% -h localhost -tc "SELECT 1 FROM pg_database WHERE datname='%DBNAME%'" | findstr 1 >nul
if errorlevel 1 (
    echo    إنشاء قاعدة بيانات %DBNAME%...
    psql -U %PGUSER% -h localhost -c "CREATE DATABASE %DBNAME% WITH ENCODING 'UTF8'"
    if errorlevel 1 (
        echo ❌ فشل إنشاء قاعدة البيانات
        pause
        exit /b 1
    )
) else (
    echo    قاعدة البيانات موجودة مسبقًا
)

REM تطبيق المخطط
echo.
echo 🔧 تطبيق المخطط والبيانات الأولية...
call node init-db.mjs
if errorlevel 1 (
    echo ❌ فشلت تهيئة قاعدة البيانات
    pause
    exit /b 1
)

REM إنشاء مجلد النسخ الاحتياطي
if not exist backups mkdir backups

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║              ✅ التثبيت اكتمل بنجاح!                       ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                            ║
echo ║   لتشغيل السيرفر: شغّل start.bat                          ║
echo ║                                                            ║
echo ║   لا تنسَ:                                                  ║
echo ║   1. فتح المنفذ 3000 في جدار الحماية                      ║
echo ║   2. تغيير كلمة سر المدير بعد أول دخول                    ║
echo ║   3. وضع start.bat في Startup للتشغيل التلقائي            ║
echo ║                                                            ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause
