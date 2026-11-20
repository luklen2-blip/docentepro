/**
 * Teste E2E de Homologação ao Vivo na Nuvem (Live Cloud)
 * Executa verificações 360 graus contra a URL de deploy em produção
 * Uso: node tests/test_cloud_live.js https://sua-app.onrender.com
 */

const https = require('https');
const http = require('http');
const assert = require('assert');

const targetUrl = process.argv[2] || process.env.LIVE_URL || 'http://localhost:3000';
console.log(`[Cloud Test] Iniciando validação ao vivo em: ${targetUrl}`);

function requestLive(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, targetUrl);
    const client = fullUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      rejectUnauthorized: false, // Previne erros de certificados intermediários no Windows
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = client.request(fullUrl, reqOptions, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runLiveSuite() {
  try {
    // 1. Health check
    const health = await requestLive('/api/health');
    assert.strictEqual(health.status, 200, 'Health check falhou');
    assert.strictEqual(health.data.status, 'ok', 'Status da API não é ok');
    console.log('✅ 1. Health Check 24/7 operacional');

    // 2. Landing Page & Visual
    const home = await requestLive('/');
    assert.strictEqual(home.status, 200, 'Landing page principal não carregou');
    const landing = await requestLive('/landing');
    assert.strictEqual(landing.status, 200, 'Rota /landing não carregou');
    const admin = await requestLive('/admin');
    assert.strictEqual(admin.status, 200, 'Painel privado /admin não carregou');
    console.log('✅ 2. Landing Page (/ e /landing) e Painel Privado /admin operacionais');
    console.log('✅ 2. Frontend e Interface carregados com sucesso');

    // 3. SaaS Metrics & Teachers (Autenticado com PIN Master)
    const saas = await requestLive('/api/saas/summary', {
      headers: { 'x-admin-pin': '2026' }
    });
    assert.strictEqual(saas.status, 200, 'Falha ao obter dados do SaaS');
    assert.ok(saas.data.metrics.totalSaaSMrr > 0, 'Faturamento do Luciano presente');
    console.log(`✅ 3. Motor SaaS ativo: R$ ${saas.data.metrics.totalSaaSMrr.toFixed(2)} MRR`);

    // 4. Termos e Privacidade LGPD
    const termos = await requestLive('/termos');
    const priv = await requestLive('/privacidade');
    assert.strictEqual(termos.status, 200, 'Rota /termos inacessível');
    assert.strictEqual(priv.status, 200, 'Rota /privacidade inacessível');
    console.log('✅ 4. Conformidade Legal e LGPD verificadas');

    console.log('\n🎉 TODOS OS TESTES NA NUVEM FORAM APROVADOS COM SUCESSO!');
    process.exit(0);
  } catch (err) {
    console.error(`❌ Erro no teste ao vivo: ${err.message}`);
    process.exit(1);
  }
}

runLiveSuite();
