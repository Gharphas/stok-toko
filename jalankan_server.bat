@echo off
title StockMaster - Server Database Toko
color 0A
echo ======================================================
echo    Memulai StockMaster Server & Database Lokal
echo ======================================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terinstall di komputer ini.
    echo Silakan install Node.js terlebih dahulu dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

node serve.js
pause
