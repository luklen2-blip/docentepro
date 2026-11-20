@echo off
title ENVIAR DOCENTEPRO PARA O GITHUB
color 0A
chcp 65001 >nul

cd /d "c:\Users\luciano\OneDrive\Documentos\nova pasta\index.html\docente-pro"

echo ===================================================================
echo   🚀 ENVIAR DOCENTEPRO PARA O GITHUB (luklen2-blip)
echo ===================================================================
echo.
echo   Importante: Antes de enviar, certifique-se de que criou o
echo   repositório "docentepro" no site: https://github.com/new
echo.
echo ===================================================================
echo.
echo Enviando branch main para o GitHub...
echo.

git push -u origin main

echo.
echo ===================================================================
echo Concluido!
echo ===================================================================
echo.
pause
