/**
 * Teste Especializado de Cibersegurança e Hardening (DocentePro)
 * Valida mitigação de OWASP Top 10, Anti-Path Traversal, Proteção de PIN, Anti-XSS e Cabeçalhos
 */

const http = require('http');
const assert = require('assert');

process.env.PORT = '3099';
const serverModule = require('../server');

let testPort = 3099;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const port = testPort;
    const reqOptions = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runSecurityTests() {
  await new Promise(r => setTimeout(r, 600));
  testPort = serverModule.getPort();

  console.log('====================================================');
  console.log(`🛡️ INICIANDO SUÍTE DE TESTES DE CIBERSEGURANÇA (Porta ${testPort})`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [SEC PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [SEC FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Anti-Path Traversal: Bloqueio de leitura de banco_docentepro.json
  await test('Firewall: Acesso direto a /banco_docentepro.json bloqueado (403)', async () => {
    const res = await makeRequest('/banco_docentepro.json');
    assert.strictEqual(res.statusCode, 403, `Esperado 403, obtido ${res.statusCode}`);
    assert.ok(res.body.includes('403 Acesso Negado'), 'Mensagem de firewall ausente');
  });

  // 2. Anti-Path Traversal: Bloqueio de arquivos fonte e configs (server.js, package.json, render.yaml)
  await test('Firewall: Acesso direto a /server.js e /package.json bloqueado (403)', async () => {
    const resServer = await makeRequest('/server.js');
    assert.strictEqual(resServer.statusCode, 403, `Esperado 403, obtido ${resServer.statusCode}`);

    const resPkg = await makeRequest('/package.json');
    assert.strictEqual(resPkg.statusCode, 403, `Esperado 403, obtido ${resPkg.statusCode}`);

    const resDotEnv = await makeRequest('/.env');
    assert.strictEqual(resDotEnv.statusCode, 403, `Esperado 403, obtido ${resDotEnv.statusCode}`);
  });

  // 3. Anti-Path Traversal com ../
  await test('Firewall: Tentativa de Path Traversal /../package.json bloqueada (403)', async () => {
    const res = await makeRequest('/../package.json');
    assert.strictEqual(res.statusCode, 403, `Esperado 403, obtido ${res.statusCode}`);
  });

  // 4. Broken Access Control: /api/saas/summary sem PIN
  await test('Auth: /api/saas/summary sem PIN bloqueado com 401 Unauthorized', async () => {
    const res = await makeRequest('/api/saas/summary');
    assert.strictEqual(res.statusCode, 401, `Esperado 401, obtido ${res.statusCode}`);
    assert.ok(res.body.includes('Não autorizado'), 'Mensagem de auth ausente');
  });

  // 5. Autenticação Admin: /api/saas/summary com PIN 2026 válido
  await test('Auth: /api/saas/summary com PIN Master 2026 aprovado (200 OK)', async () => {
    const res = await makeRequest('/api/saas/summary', {
      headers: { 'x-admin-pin': '2026' }
    });
    assert.strictEqual(res.statusCode, 200, `Esperado 200, obtido ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert.ok(data.metrics && data.metrics.totalSaaSMrr !== undefined, 'Métricas ausentes');
  });

  // 6. Proteção de Chave PIX Master: /api/saas/config sem PIN
  await test('Auth: /api/saas/config sem PIN bloqueado com 401 Unauthorized', async () => {
    const res = await makeRequest('/api/saas/config', {
      method: 'PUT',
      body: JSON.stringify({ pixKey: 'hacker@malicioso.com' })
    });
    assert.strictEqual(res.statusCode, 401, `Esperado 401, obtido ${res.statusCode}`);
  });

  // 7. Sanitização Anti-XSS: Scripts em inputs devem ser neutralizados
  await test('XSS: Injeção de <script> no lead é sanitizada antes de gravar no banco', async () => {
    const res = await makeRequest('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        teacherId: 'prof_lucas',
        name: 'Aluno <script>alert("XSS")</script>Silva',
        whatsapp: '1199998888',
        origin: 'TikTok <iframe src="javascript:alert(1)"></iframe>'
      })
    });
    assert.strictEqual(res.statusCode, 201, `Esperado 201, obtido ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert.ok(!data.lead.name.includes('<script>'), 'Script tag não foi removida do name');
    assert.ok(!data.lead.origin.includes('<iframe>'), 'Iframe tag não foi removida do origin');
    assert.ok(data.lead.name.includes('Aluno'), 'Texto legítimo deve permanecer');
  });

  // 8. Cabeçalhos de Segurança HTTP (Defense in Depth)
  await test('Headers: Cabeçalhos obrigatórios de cibersegurança presentes na resposta', async () => {
    const res = await makeRequest('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff', 'Falta X-Content-Type-Options');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN', 'Falta X-Frame-Options');
    assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block', 'Falta X-XSS-Protection');
    assert.strictEqual(res.headers['referrer-policy'], 'strict-origin-when-cross-origin', 'Falta Referrer-Policy');
    assert.ok(res.headers['permissions-policy'], 'Falta Permissions-Policy');
    assert.ok(res.headers['content-security-policy'], 'Falta Content-Security-Policy');
  });

  console.log('\n====================================================');
  console.log(`🛡️ RESULTADO DOS TESTES DE CIBERSEGURANÇA: ${passed} Aprovados | ${failed} Falhas`);
  console.log('====================================================');

  serverModule.server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

runSecurityTests();
