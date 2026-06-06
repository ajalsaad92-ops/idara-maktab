@echo off
chcp 65001 >nul
cd /d "%~dp0"
for /f "tokens=2 delims==" %%a in ('findstr "^PGPASSWORD=" .env') do set PGPASSWORD=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGDATABASE=" .env') do set DBNAME=%%a
for /f "tokens=2 delims==" %%a in ('findstr "^PGUSER=" .env') do set PGUSER=%%a

if not exist backups mkdir backups
set TODAY=%date:~-4%-%date:~3,2%-%date:~0,2%
set BACKUP_FILE=backups\backup-%TODAY%.sql

echo 💾 جاري إنشاء نسخة احتياطية...
pg_dump -U %PGUSER% -h localhost -d %DBNAME% > "%BACKUP_FILE%"
if errorlevel 1 (
    echo ❌ فشلت النسخة الاحتياطية
    pause
    exit /b 1
)
echo ✅ تم الحفظ في: %BACKUP_FILE%
