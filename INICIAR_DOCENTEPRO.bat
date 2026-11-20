@echo off
title DOCENTEPRO - PLATAFORMA SAAS 24/7 (NUVEM & LOCAL)
color 0A
chcp 65001 >nul

echo ===================================================================
echo   🎓 DOCENTEPRO - PLATAFORMA PARA PROFESSORES PARTICULARES
echo   Disponibilidade 24/7 na Nuvem + Funil TikTok + Cobranca PIX
echo ===================================================================
echo.

:: 1. Entrar diretamente na pasta do projeto
cd /d "c:\Users\luciano\OneDrive\Documentos\nova pasta\index.html\docente-pro"

:: 2. Validar que os arquivos existem
if not exist "server.js" (
  echo [ERRO] Arquivo server.js nao encontrado!
  pause
  exit /b 1
)

:: 3. Iniciar Túnel Seguro Cloudflare 24/7 em background
start /b node tunnel_manager.js

echo [1/2] Abrindo DocentePro no seu navegador...
timeout /t 2 /nobreak >nul
start "" http://localhost:3002

echo [2/2] Servidor online e monitoramento ativo 24/7!
echo.
echo ===================================================================
echo   Acesso Local: http://localhost:3002
echo   Landing Page: http://localhost:3002/landing
echo   Painel Privado do Luciano: http://localhost:3002/admin (PIN: 2026)
echo   Health Check: http://localhost:3002/api/health
echo.
echo   O link público da nuvem (HTTPS) foi salvo na sua Área de Trabalho:
echo   - LINK_PUBLICO_NUVEM_DOCENTEPRO.txt
echo   - QR_CODE_ACESSO_DOCENTEPRO.html
echo.
echo   Para encerrar a plataforma, basta fechar esta janela.
echo ===================================================================
echo.
node server.js
