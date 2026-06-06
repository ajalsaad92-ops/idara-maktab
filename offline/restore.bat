@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="" (
    echo الاستخدام: restore.bat backups\backup-2026-06-10.sql
    pause
    exit /b 1
)

for /f "tokens=2 delims==" %%a in ('findstr "^PGPASSWORD=" .env') do set PGPASSWORD=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGDATABASE=" .env') do set DBNAME=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGUSER=" .env') do set PGUSER=%%a

echo ⚠️  سيتم حذف جميع البيانات الحالية واستبدالها بالنسخة الاحتياطية!
set /p CONFIRM="اكتب 'YES' للمتابعة: "
if /i not "%CONFIRM%"=="YES" exit /b 0

echo 🔄 جاري الاستعادة...
psql -U %PGUSER% -h localhost -c "DROP DATABASE IF EXISTS %DBNAME%"
psql -U %PGUSER% -h localhost -c "CREATE DATABASE %DBNAME% WITH ENCODING 'UTF8'"
psql -U %PGUSER% -h localhost -d %DBNAME% < "%~1"
echo ✅ تم الاستعادة بنجاح
pause
