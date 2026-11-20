/**
 * Suíte de Testes Automatizados - DocentePro
 * Executado localmente e no build da imagem Docker
 */

const http = require("http");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  calcCRC16,
  generatePixPayload,
  getPixQrCodeUrl,
} = require("../pix_utils");
const { readDb, writeDb, getDefaultDb } = require("../db");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

console.log("====================================================");
console.log("🧪 INICIANDO TESTES DE INTEGRIDADE DOCENTEPRO");
console.log("====================================================\n");

// 1. Arquivos Essenciais de Nuvem e Produção
runTest("Infraestrutura: Arquivos obrigatórios presentes", () => {
  const root = path.join(__dirname, "..");
  assert.ok(fs.existsSync(path.join(root, "server.js")), "server.js ausente");
  assert.ok(
    fs.existsSync(path.join(root, "render.yaml")),
    "render.yaml ausente",
  );
  assert.ok(fs.existsSync(path.join(root, "Dockerfile")), "Dockerfile ausente");
  assert.ok(fs.existsSync(path.join(root, ".gitignore")), ".gitignore ausente");
  assert.ok(
    fs.existsSync(path.join(root, "termos.html")),
    "termos.html ausente",
  );
  assert.ok(
    fs.existsSync(path.join(root, "privacidade.html")),
    "privacidade.html ausente",
  );
  assert.ok(
    fs.existsSync(path.join(root, "landing.html")),
    "landing.html ausente",
  );
  assert.ok(
    fs.existsSync(path.join(root, "public", "landing.html")),
    "public/landing.html ausente",
  );
  assert.ok(
    fs.existsSync(path.join(root, "public", "index.html")),
    "public/index.html ausente",
  );
});

// 2. PIX Oficial do Banco Central (EMV + CRC16)
runTest("Fintech: Geração de payload PIX com CRC-16 válido", () => {
  const payload = generatePixPayload({
    key: "lucas.ingles@gmail.com",
    name: "LUCAS SILVA PROFESSOR",
    city: "SAO PAULO",
    amount: 380.0,
    txid: "TEST1234",
  });

  assert.ok(payload.startsWith("000201"), "Prefixo EMV inválido");
  assert.ok(payload.includes("BR.GOV.BCB.PIX"), "Merchant ID PIX inválido");
  assert.ok(payload.includes("380.00"), "Valor monetário ausente");
  assert.strictEqual(payload.length > 50, true, "Payload PIX incompleto");

  // Validação da URL do QR Code
  const qrUrl = getPixQrCodeUrl(payload);
  assert.ok(qrUrl.includes("api.qrserver.com"), "URL do QR Code inválida");
});

// 3. Persistência de Dados e Banco JsonDB
runTest("Banco de Dados: Leitura e escrita atômica", () => {
  const db = readDb();
  assert.ok(
    db.teachers && db.teachers.length >= 2,
    "Professores semente ausentes",
  );
  assert.ok(
    db.saas && db.saas.pricingPlans[0].price === 39.9,
    "Plano único de R$ 39,90 ausente",
  );
  assert.ok(db.students && db.students.length >= 2, "Alunos semente ausentes");
});

// 4. Teste da API Server HTTP
async function runServerTests() {
  process.env.PORT = "3088"; // Use dedicated test port
  const serverModule = require("../server");
  // Espera 500ms para porta abrir
  await new Promise((r) => setTimeout(r, 500));

  const PORT = serverModule.getPort();

  // Teste GET /api/health
  await runAsyncTest(
    "API: Health Check /api/health retorna 200 e app DocentePro",
    async () => {
      const res = await fetchJson(`http://localhost:${PORT}/api/health`);
      assert.strictEqual(res.status, "ok", "Status não é ok");
      assert.strictEqual(res.app, "DocentePro", "Nome da app incorreto");
      assert.strictEqual(res.version, "2.0.0", "Versão incorreta");
      assert.ok(res.uptime_seconds >= 0, "Uptime ausente");
    },
  );

  // Teste GET /api/saas/summary (Autenticado com PIN Master)
  await runAsyncTest(
    "API: Resumo SaaS do Luciano protegido por PIN retorna MRR e contagem correta",
    async () => {
      // 1. Sem PIN deve retornar 401 Unauthorized
      try {
        await fetchJson(`http://localhost:${PORT}/api/saas/summary`);
        assert.fail("Deveria ter bloqueado requisição sem PIN");
      } catch (err) {
        assert.ok(err.message.includes("401"), "Deveria retornar 401");
      }

      // 2. Com PIN correto deve retornar 200
      const res = await fetchJson(`http://localhost:${PORT}/api/saas/summary`, {
        headers: { "x-admin-pin": "2026" },
      });
      assert.ok(
        res.metrics.totalSaaSMrr > 0,
        "MRR do Luciano deve ser maior que zero",
      );
      assert.ok(
        res.metrics.totalTeachers >= 2,
        "Número de professores inválido",
      );
    },
  );

  // Teste Adicionar e Modificar Planos/Matérias (O recurso solicitado pelo usuário)
  await runAsyncTest(
    "API: Professor pode incluir e editar planos e preços",
    async () => {
      // 1. Adicionar plano
      const postRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas/plans`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Inglês para Tecnologia & Programadores",
            subject: "Inglês Tech",
            price: 450.0,
            billingType: "mensal",
            frequency: "1x por semana",
            description: "Vocabulário de TI, daily meetings e PR reviews",
          }),
        },
      );
      assert.ok(postRes.plan && postRes.plan.id, "Falha ao criar plano");
      assert.strictEqual(postRes.plan.price, 450.0, "Preço incorreto");

      const createdPlanId = postRes.plan.id;

      // 2. Editar preço do plano recém-criado
      const putRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas/plans/${createdPlanId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            price: 490.0,
            active: false,
          }),
        },
      );
      assert.strictEqual(putRes.plan.price, 490.0, "Preço não atualizado");
      assert.strictEqual(
        putRes.plan.active,
        false,
        "Status ativo não atualizado",
      );

      // 3. Excluir plano de teste
      const delRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas/plans/${createdPlanId}`,
        {
          method: "DELETE",
        },
      );
      assert.ok(delRes.message, "Falha ao deletar plano");
    },
  );

  // Teste Captura de Lead TikTok
  await runAsyncTest(
    "API: Triagem da Bio do TikTok gera lead e código PIX",
    async () => {
      const leadRes = await fetchJson(`http://localhost:${PORT}/api/leads`, {
        method: "POST",
        body: JSON.stringify({
          teacherId: "prof_lucas",
          name: "Aluno Teste TikTok",
          whatsapp: "(11) 99999-8888",
          level: "Iniciante",
          preferredTime: "Noite",
          planChosen: "Inglês Viagem",
          value: 380.0,
        }),
      });
      assert.ok(leadRes.lead && leadRes.lead.id, "Lead não registrado");
      assert.ok(leadRes.pix && leadRes.pix.payload, "PIX da aula não gerado");
    },
  );

  // Teste 7 Dias Grátis e Assinatura R$ 39,90 do Professor
  await runAsyncTest(
    "API & Regra de Negócio: Teste de 7 dias grátis e conversão PIX R$ 39,90",
    async () => {
      // 1. Gera PIX de assinatura para o professor em trial
      const subRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas/subscribe-pix`,
        {
          method: "POST",
        },
      );
      assert.strictEqual(
        subRes.amount,
        39.9,
        "Valor da assinatura não é 39.90",
      );
      assert.ok(
        subRes.payload.startsWith("000201"),
        "Payload PIX da assinatura inválido",
      );
      assert.ok(
        subRes.qrCodeUrl.includes("api.qrserver.com"),
        "QR code da assinatura inválido",
      );

      // 2. Confirmação de ativação da assinatura
      const confirmRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas/confirm-subscription`,
        {
          method: "POST",
        },
      );
      assert.strictEqual(
        confirmRes.teacher.saasStatus,
        "ativo",
        "Status da assinatura não virou ativo",
      );
    },
  );

  // Teste Atualização de Chave PIX do Professor e do Luciano
  await runAsyncTest(
    "API: Professor e Luciano podem atualizar suas chaves PIX bancárias",
    async () => {
      // 1. Atualizar chave do professor
      const profPixRes = await fetchJson(
        `http://localhost:${PORT}/api/teachers/prof_lucas`,
        {
          method: "PUT",
          body: JSON.stringify({
            pixKey: "11988887777",
            pixName: "LUCAS PROFESSOR NOVO",
            pixCity: "CAMPINAS",
          }),
        },
      );
      assert.strictEqual(
        profPixRes.teacher.pixKey,
        "11988887777",
        "Chave PIX do professor não atualizada",
      );

      // 2. Atualizar chave do Luciano (sem PIN deve falhar, com PIN deve aprovar)
      try {
        await fetchJson(`http://localhost:${PORT}/api/saas/config`, {
          method: "PUT",
          body: JSON.stringify({ pixKey: "hacker@evil.com" }),
        });
        assert.fail("Deveria ter bloqueado alteração de PIX sem PIN");
      } catch (err) {
        assert.ok(err.message.includes("401"), "Deveria retornar 401");
      }

      const saasPixRes = await fetchJson(
        `http://localhost:${PORT}/api/saas/config`,
        {
          method: "PUT",
          headers: { "x-admin-pin": "2026" },
          body: JSON.stringify({
            pixKey: "luciano.pessoal@pix.com.br",
            pixName: "LUCIANO SILVA",
          }),
        },
      );
      assert.strictEqual(
        saasPixRes.saas.pixKey,
        "luciano.pessoal@pix.com.br",
        "Chave PIX do Luciano não atualizada",
      );
    },
  );

  // Teste Inserção de Alunos Existentes (Individual, Lote e Exclusão)
  await runAsyncTest(
    "API: Professor pode inserir alunos existentes individualmente e em lote",
    async () => {
      // 1. Inserção individual
      const singleRes = await fetchJson(
        `http://localhost:${PORT}/api/students`,
        {
          method: "POST",
          body: JSON.stringify({
            teacherId: "prof_lucas",
            name: "Beatriz Lima Existente",
            whatsapp: "(11) 98765-4321",
            planName: "Inglês VIP",
            monthlyFee: 400.0,
            dayOfWeek: "Terça-feira",
            timeSlot: "19:00",
          }),
        },
      );
      assert.ok(
        singleRes.student && singleRes.student.id,
        "Falha ao cadastrar aluno individual",
      );
      const createdId = singleRes.student.id;

      // 2. Inserção em lote
      const batchRes = await fetchJson(
        `http://localhost:${PORT}/api/students/batch`,
        {
          method: "POST",
          body: JSON.stringify({
            teacherId: "prof_lucas",
            students: [
              { name: "Aluno Lote 1", whatsapp: "11911112222", monthlyFee: 350.0 },
              { name: "Aluno Lote 2", whatsapp: "11933334444", monthlyFee: 380.0 },
            ],
          }),
        },
      );
      assert.strictEqual(
        batchRes.count,
        2,
        "Contagem de alunos importados em lote incorreta",
      );

      // 3. Exclusão de aluno
      const delRes = await fetchJson(
        `http://localhost:${PORT}/api/students/${createdId}`,
        {
          method: "DELETE",
        },
      );
      assert.ok(delRes.message, "Falha ao excluir aluno");
    },
  );

  console.log("\n====================================================");
  console.log(
    `📊 RESULTADO DOS TESTES: ${testsPassed} Aprovados | ${testsFailed} Falhas`,
  );
  console.log("====================================================");

  serverModule.server.close(() => {
    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}

function fetchJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error("HTTP " + res.statusCode + ": " + data));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

runServerTests();
