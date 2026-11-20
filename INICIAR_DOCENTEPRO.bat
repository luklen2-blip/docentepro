@echo off
title DOCENTEPRO - PLATAFORMA SAAS PARA PROFESSORES PARTICULARES
color 0A
chcp 65001 >nul

echo ===================================================================
echo   🎓 DOCENTEPRO - PLATAFORMA PARA PROFESSORES PARTICULARES
echo   Funil TikTok + Cobrança PIX Automática + 7 Dias Grátis
echo ===================================================================
echo.

:: 1. Entrar diretamente na pasta do projeto
cd /d "c:\Users\luciano\OneDrive\Documentos\nova pasta\index.html\docente-pro"

:: 2. Validar que os arquivos existem
if not exist "server.js" (
  echo [ERRO] Arquivo server.js nao encontrado!
  echo Verifique se a pasta docente-pro esta no local correto.
  pause
  exit /b 1
)

echo [1/2] Abrindo DocentePro no seu navegador...
timeout /t 1 /nobreak >nul
start "" http://localhost:3002

echo [2/2] Servidor online e monitoramento ativo!
echo.
echo ===================================================================
echo   App Online: http://localhost:3002
echo   Health Check: http://localhost:3002/api/health
echo.
echo   Para encerrar o DocentePro, basta fechar esta janela.
echo ===================================================================
echo.
node server.js
