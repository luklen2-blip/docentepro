/**
 * Gerenciador de Túnel Seguro em Nuvem (Cloudflare Quick Tunnel 24/7)
 * Disponibiliza a plataforma DocentePro em URL pública HTTPS com certificado SSL
 * Utiliza --no-prechecks para evitar self-termination por oscilação transitória
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const URL_FILE = path.join(__dirname, 'public_tunnel_url.txt');
const LOG_FILE = path.join(__dirname, 'cloudflared.log');
const DESKTOP_LINK = 'C:\\Users\\luciano\\OneDrive\\Desktop\\LINK_PUBLICO_NUVEM_DOCENTEPRO.txt';
const DESKTOP_QR = 'C:\\Users\\luciano\\OneDrive\\Desktop\\QR_CODE_ACESSO_DOCENTEPRO.html';

console.log(`[TUNNEL] Iniciando conexão em nuvem 24/7 para a porta ${PORT}...`);

const localExe = path.join(__dirname, 'cloudflared.exe');
const binDirExe = 'C:\\Users\\luciano\\OneDrive\\Documentos\\nova pasta\\index.html\\bin\\cloudflared.exe';
const cloudflaredCmd = fs.existsSync(localExe) ? localExe : (fs.existsSync(binDirExe) ? binDirExe : 'cloudflared.exe');

const tunnel = spawn(cloudflaredCmd, [
  'tunnel',
  '--url', `http://localhost:${PORT}`,
  '--no-autoupdate',
  '--no-prechecks'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

let tunnelCaptured = false;

function processOutput(data) {
  const text = data.toString();
  logStream.write(text);

  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelCaptured) {
    tunnelCaptured = true;
    const tunnelUrl = match[0];
    try { fs.writeFileSync(URL_FILE, tunnelUrl, 'utf-8'); } catch(e){}

    const txtContent = `===================================================================
DOCENTEPRO - PLATAFORMA SAAS 24/7 NO AR NA NUVEM
===================================================================

Sua plataforma está pública e online para qualquer pessoa do mundo acessar!

👉 LINK PÚBLICO HTTPS:
${tunnelUrl}

👉 LANDING PAGE / APRESENTAÇÃO:
${tunnelUrl}/landing

👉 LINK DA BIO (PARA TIKTOK, INSTAGRAM E TWITTER/X):
${tunnelUrl}/?view=bio

👉 PAINEL DO PROFESSOR:
${tunnelUrl}/?view=professor

👉 PAINEL PRIVADO DO LUCIANO (ADMIN):
${tunnelUrl}/admin (PIN: 2026)

👉 HEALTH CHECK 24/7:
${tunnelUrl}/api/health

QR Code para apontar a câmera do celular:
https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${tunnelUrl}
===================================================================`;
    try { fs.writeFileSync(DESKTOP_LINK, txtContent, 'utf-8'); } catch(e){}

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acessar DocentePro no Celular - Nuvem 24/7</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-center">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      DOCENTEPRO ONLINE NA NUVEM 24/7
    </div>
    <h1 class="text-2xl font-black text-white mb-1">DocentePro</h1>
    <p class="text-xs text-indigo-400 font-semibold mb-4">Plataforma para Professores Particulares</p>
    <p class="text-sm text-slate-300 mb-5">Aponte a câmera do seu celular para o QR Code abaixo:</p>
    <div class="bg-white p-4 rounded-2xl shadow-xl inline-block mx-auto mb-5 border-4 border-emerald-400">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=4&data=${tunnelUrl}" alt="QR Code" class="w-56 h-56 mx-auto block">
    </div>
    <div class="space-y-3">
      <a href="${tunnelUrl}" target="_blank" class="block w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition text-sm">
        Abrir Plataforma no Celular
      </a>
      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 break-all font-mono select-all">
        ${tunnelUrl}
      </div>
    </div>
  </div>
</body>
</html>`;
    try { fs.writeFileSync(DESKTOP_QR, htmlContent, 'utf-8'); } catch(e){}

    console.log(`\n=============================================================`);
    console.log(`🚀 [NUVEM 24/7 ATIVA] DocentePro publicado com sucesso!`);
    console.log(`🔗 URL PÚBLICA HTTPS: ${tunnelUrl}`);
    console.log(`=============================================================\n`);
  }
}

tunnel.stdout.on('data', processOutput);
tunnel.stderr.on('data', processOutput);

tunnel.on('error', (err) => {
  console.log(`[TUNNEL INFO] Erro ao iniciar cloudflared: ${err.message}`);
});

process.on('exit', () => {
  try { tunnel.kill(); } catch (e) {}
});

module.exports = { tunnel };
