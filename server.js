const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { readDb, writeDb } = require("./db");
const { generatePixPayload, getPixQrCodeUrl } = require("./pix_utils");
const {
  MASTER_PIN,
  globalLimiter,
  writeLimiter,
  authLimiter,
  getClientIp,
  applySecurityHeaders,
  sanitizeObject,
  isPathSafe,
  verifyAdminAuth,
} = require("./security");

let currentPort = parseInt(process.env.PORT, 10) || 3002;
const APP_NAME = "DocentePro";

// MIME types mapping
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

// Helper: parse JSON body com Sanitização Anti-XSS e Proteção contra DoS
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        // 5MB limit
        reject(new Error("Payload muito grande. Limite de 5MB excedido."));
      }
    });
    req.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        const parsed = JSON.parse(body);
        resolve(sanitizeObject(parsed));
      } catch (err) {
        reject(new Error("JSON Inválido: " + err.message));
      }
    });
    req.on("error", reject);
  });
}

// Helper: send JSON response com Cabeçalhos de Cibersegurança
function sendJson(res, statusCode, data) {
  applySecurityHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-pin",
  });
  res.end(JSON.stringify(data));
}

// Server instance
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`,
  );
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const clientIp = getClientIp(req);

  // Injeção de Cabeçalhos de Segurança em todas as respostas
  applySecurityHeaders(res, req);

  // Handle CORS Pre-flight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-admin-pin",
    });
    res.end();
    return;
  }

  // Rate Limiting Global: Anti-DDoS e Anti-Scraping (400 req / 15 min)
  if (globalLimiter.isLimited(clientIp)) {
    sendJson(res, 429, {
      error: "Muitas requisições deste endereço IP. Aguarde alguns instantes.",
      retryAfter: globalLimiter.getResetTimeSeconds(clientIp),
    });
    return;
  }

  // Rate Limiting para Escritas: Anti-Flood de formulários e cadastros (40 req / 15 min)
  if (["POST", "PUT", "DELETE"].includes(method)) {
    if (writeLimiter.isLimited(clientIp)) {
      sendJson(res, 429, {
        error: "Limite de envio de dados excedido. Tente novamente mais tarde.",
        retryAfter: writeLimiter.getResetTimeSeconds(clientIp),
      });
      return;
    }
  }

  // 1. Mandatory Health Check (Luciano SaaS standard)
  if (pathname === "/api/health" && method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      app: APP_NAME,
      version: "2.0.0",
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ==========================================
  // 2. REST API ENDPOINTS
  // ==========================================

  // GET /api/saas/summary -> Resumo executivo do SaaS do Luciano (Protegido por PIN Master)
  if (pathname === "/api/saas/summary" && method === "GET") {
    if (!verifyAdminAuth(req)) {
      if (authLimiter.isLimited(clientIp)) {
        sendJson(res, 429, {
          error:
            "Muitas tentativas de autenticação inválidas. Aguarde 15 minutos.",
        });
        return;
      }
      sendJson(res, 401, {
        error:
          "Não autorizado: PIN Master obrigatório para visualizar métricas confidenciais do proprietário.",
      });
      return;
    }
    const db = readDb();
    const teachers = db.teachers || [];
    const students = db.students || [];
    const tasks = db.tasks || [];

    const totalTeachers = teachers.length;
    const activeTeachers = teachers.filter(
      (t) => t.saasStatus === "ativo",
    ).length;
    const totalStudents = students.length;
    const totalTasks = tasks.length;

    const trialTeachers = teachers.filter(
      (t) => t.saasStatus === "trial",
    ).length;
    const payingTeachers = teachers.filter(
      (t) => t.saasStatus === "ativo",
    ).length;
    const expiredTeachers = teachers.filter(
      (t) => t.saasStatus === "expirado",
    ).length;

    // Faturamento Recorrente Mensal (MRR) que o Luciano recebe dos professores pagantes
    const totalSaaSMrr = teachers
      .filter((t) => t.saasStatus === "ativo")
      .reduce((acc, t) => acc + (t.saasFee || 39.9), 0);

    // Potencial total se todos os professores em teste converterem
    const totalPotentialMrr = teachers.length * 39.9;

    // Faturamento que os professores geram com seus alunos nas aulas particulares
    const totalTeachersVolume = students.reduce(
      (acc, s) => acc + (s.monthlyFee || 0),
      0,
    );

    // Contagem por plano
    const planCounts = { completo: teachers.length };

    sendJson(res, 200, {
      saas: db.saas,
      metrics: {
        totalSaaSMrr,
        totalPotentialMrr,
        totalTeachers,
        trialTeachers,
        payingTeachers,
        expiredTeachers,
        activeTeachers,
        totalStudents,
        totalTasks,
        totalTeachersVolume,
        planCounts,
      },
      teachers,
    });
    return;
  }

  // GET /api/teachers -> Lista de professores
  if (pathname === "/api/teachers" && method === "GET") {
    const db = readDb();
    sendJson(res, 200, db.teachers || []);
    return;
  }

  // GET /api/teachers/:slugOrId -> Perfil do professor para o Link da Bio (TikTok)
  const teacherMatch = pathname.match(/^\/api\/teachers\/([a-zA-Z0-9_-]+)$/);
  if (teacherMatch && method === "GET") {
    const slugOrId = teacherMatch[1];
    const db = readDb();
    const teacher = (db.teachers || []).find(
      (t) => t.slug === slugOrId || t.id === slugOrId,
    );

    if (!teacher) {
      sendJson(res, 404, { error: "Professor não encontrado" });
      return;
    }

    sendJson(res, 200, teacher);
    return;
  }

  // PUT /api/teachers/:id -> Professor atualiza sua Chave PIX, nome bancário e dados
  if (teacherMatch && method === "PUT") {
    try {
      const teacherId = teacherMatch[1];
      const body = await parseBody(req);
      const db = readDb();
      const teacher = (db.teachers || []).find(
        (t) => t.id === teacherId || t.slug === teacherId,
      );

      if (!teacher) {
        sendJson(res, 404, { error: "Professor não encontrado" });
        return;
      }

      if (body.pixKey !== undefined) teacher.pixKey = body.pixKey.trim();
      if (body.pixName !== undefined) teacher.pixName = body.pixName.trim();
      if (body.pixCity !== undefined) teacher.pixCity = body.pixCity.trim();
      if (body.phone !== undefined) teacher.phone = body.phone.trim();
      if (body.headline !== undefined) teacher.headline = body.headline.trim();
      if (body.bio !== undefined) teacher.bio = body.bio.trim();
      if (body.meetLinkDefault !== undefined)
        teacher.meetLinkDefault = body.meetLinkDefault.trim();
      if (body.twitter !== undefined) teacher.twitter = body.twitter.trim();
      if (body.tiktokUser !== undefined)
        teacher.tiktokUser = body.tiktokUser.trim();
      if (body.instagram !== undefined)
        teacher.instagram = body.instagram.trim();

      writeDb(db);
      sendJson(res, 200, {
        message: "Configurações de PIX e perfil atualizadas com sucesso!",
        teacher,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // PUT /api/saas/config -> Luciano atualiza sua própria Chave PIX para receber os R$ 39,90 (Protegido por PIN Master)
  if (pathname === "/api/saas/config" && method === "PUT") {
    if (!verifyAdminAuth(req)) {
      sendJson(res, 401, {
        error:
          "Não autorizado: PIN Master obrigatório para alterar a Chave PIX do proprietário.",
      });
      return;
    }

    try {
      const body = await parseBody(req);
      const db = readDb();

      if (body.pixKey !== undefined) db.saas.pixKey = body.pixKey.trim();
      if (body.pixName !== undefined) db.saas.pixName = body.pixName.trim();
      if (body.pixCity !== undefined) db.saas.pixCity = body.pixCity.trim();

      writeDb(db);
      sendJson(res, 200, {
        message: "Chave PIX do Luciano atualizada com sucesso!",
        saas: db.saas,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/teachers/:id/plans -> Professor adiciona nova matéria / plano
  const addPlanMatch = pathname.match(
    /^\/api\/teachers\/([a-zA-Z0-9_-]+)\/plans$/,
  );
  if (addPlanMatch && method === "POST") {
    try {
      const teacherId = addPlanMatch[1];
      const body = await parseBody(req);
      const db = readDb();
      const teacher = (db.teachers || []).find((t) => t.id === teacherId);

      if (!teacher) {
        sendJson(res, 404, { error: "Professor não encontrado" });
        return;
      }

      const newPlan = {
        id: "plan_" + Date.now(),
        name: body.name || "Novo Plano de Aula",
        subject: body.subject || teacher.subjectCategory || "Geral",
        price: Number(body.price) || 0,
        billingType: body.billingType || "mensal", // 'mensal' ou 'avulso'
        frequency: body.frequency || "1x por semana",
        description: body.description || "",
        active: body.active !== false,
      };

      if (!teacher.plans) teacher.plans = [];
      teacher.plans.push(newPlan);
      writeDb(db);

      sendJson(res, 201, {
        message: "Plano adicionado com sucesso!",
        plan: newPlan,
        teacher,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // PUT /api/teachers/:id/plans/:planId -> Professor edita ou ativa/desativa um plano existente
  const editPlanMatch = pathname.match(
    /^\/api\/teachers\/([a-zA-Z0-9_-]+)\/plans\/([a-zA-Z0-9_-]+)$/,
  );
  if (editPlanMatch && method === "PUT") {
    try {
      const teacherId = editPlanMatch[1];
      const planId = editPlanMatch[2];
      const body = await parseBody(req);
      const db = readDb();
      const teacher = (db.teachers || []).find((t) => t.id === teacherId);

      if (!teacher) {
        sendJson(res, 404, { error: "Professor não encontrado" });
        return;
      }

      const planIndex = (teacher.plans || []).findIndex((p) => p.id === planId);
      if (planIndex === -1) {
        sendJson(res, 404, { error: "Plano não encontrado" });
        return;
      }

      // Atualiza campos
      const existingPlan = teacher.plans[planIndex];
      teacher.plans[planIndex] = {
        ...existingPlan,
        name: body.name !== undefined ? body.name : existingPlan.name,
        subject:
          body.subject !== undefined ? body.subject : existingPlan.subject,
        price:
          body.price !== undefined ? Number(body.price) : existingPlan.price,
        billingType:
          body.billingType !== undefined
            ? body.billingType
            : existingPlan.billingType,
        frequency:
          body.frequency !== undefined
            ? body.frequency
            : existingPlan.frequency,
        description:
          body.description !== undefined
            ? body.description
            : existingPlan.description,
        active:
          body.active !== undefined
            ? Boolean(body.active)
            : existingPlan.active,
      };

      writeDb(db);
      sendJson(res, 200, {
        message: "Plano atualizado com sucesso!",
        plan: teacher.plans[planIndex],
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // DELETE /api/teachers/:id/plans/:planId -> Professor exclui um plano
  if (editPlanMatch && method === "DELETE") {
    const teacherId = editPlanMatch[1];
    const planId = editPlanMatch[2];
    const db = readDb();
    const teacher = (db.teachers || []).find((t) => t.id === teacherId);

    if (!teacher) {
      sendJson(res, 404, { error: "Professor não encontrado" });
      return;
    }

    teacher.plans = (teacher.plans || []).filter((p) => p.id !== planId);
    writeDb(db);
    sendJson(res, 200, {
      message: "Plano removido com sucesso!",
      plans: teacher.plans,
    });
    return;
  }

  // GET /api/teachers/:id/dashboard -> Dados privados do painel do professor
  const teacherDashMatch = pathname.match(
    /^\/api\/teachers\/([a-zA-Z0-9_-]+)\/dashboard$/,
  );
  if (teacherDashMatch && method === "GET") {
    const teacherId = teacherDashMatch[1];
    const db = readDb();
    const teacher = (db.teachers || []).find(
      (t) => t.id === teacherId || t.slug === teacherId,
    );

    if (!teacher) {
      sendJson(res, 404, { error: "Professor não encontrado" });
      return;
    }

    const students = (db.students || []).filter(
      (s) => s.teacherId === teacher.id,
    );
    const tasks = (db.tasks || []).filter((t) => t.teacherId === teacher.id);
    const leads = (db.leads || []).filter((l) => l.teacherId === teacher.id);

    const faturamentoPrevisto = students.reduce(
      (acc, s) => acc + (s.monthlyFee || 0),
      0,
    );
    const alunosPagos = students.filter(
      (s) => s.paymentStatus === "pago",
    ).length;
    const alunosPendentes = students.filter(
      (s) => s.paymentStatus === "pendente",
    ).length;
    const tarefasParaCorrigir = tasks.filter(
      (t) => t.status === "aguardando_correcao",
    ).length;

    sendJson(res, 200, {
      teacher,
      metrics: {
        totalAlunos: students.length,
        alunosPagos,
        alunosPendentes,
        faturamentoPrevisto,
        tarefasParaCorrigir,
        totalLeadsTikTok: leads.length,
      },
      students,
      tasks,
      leads,
    });
    return;
  }

  // POST /api/teachers/:id/subscribe-pix -> Gera PIX de R$ 39,90 para pagar a mensalidade ao Luciano
  const subPixMatch = pathname.match(
    /^\/api\/teachers\/([a-zA-Z0-9_-]+)\/subscribe-pix$/,
  );
  if (subPixMatch && method === "POST") {
    const teacherId = subPixMatch[1];
    const db = readDb();
    const teacher = (db.teachers || []).find((t) => t.id === teacherId);
    if (!teacher) {
      sendJson(res, 404, { error: "Professor não encontrado" });
      return;
    }

    const payload = generatePixPayload({
      key: db.saas.pixKey || "luklen2@gmail.com",
      name: db.saas.pixName || "LUCIANO SAAS DOCENTEPRO",
      city: db.saas.pixCity || "SAO PAULO",
      amount: 39.9,
      txid: "ASSIN" + String(Date.now()).slice(-6),
    });

    sendJson(res, 200, {
      payload,
      qrCodeUrl: getPixQrCodeUrl(payload),
      amount: 39.9,
      recipient: db.saas.pixName,
      key: db.saas.pixKey,
    });
    return;
  }

  // POST /api/teachers/:id/confirm-subscription -> Ativa a assinatura do professor após teste de 7 dias
  const confirmSubMatch = pathname.match(
    /^\/api\/teachers\/([a-zA-Z0-9_-]+)\/confirm-subscription$/,
  );
  if (confirmSubMatch && method === "POST") {
    const teacherId = confirmSubMatch[1];
    const db = readDb();
    const teacher = (db.teachers || []).find((t) => t.id === teacherId);
    if (!teacher) {
      sendJson(res, 404, { error: "Professor não encontrado" });
      return;
    }

    teacher.saasStatus = "ativo";
    teacher.trialDaysRemaining = 0;
    teacher.subscriptionPaidDate = new Date().toISOString();
    writeDb(db);

    sendJson(res, 200, {
      message: "Assinatura ativada com sucesso! Bem-vindo ao DocentePro Pro.",
      teacher,
    });
    return;
  }

  // POST /api/leads -> Captura do formulário de triagem da Bio do TikTok
  if (pathname === "/api/leads" && method === "POST") {
    try {
      const body = await parseBody(req);
      const db = readDb();

      const teacher = (db.teachers || []).find(
        (t) => t.id === body.teacherId || t.slug === body.teacherId,
      );
      if (!teacher) {
        sendJson(res, 404, { error: "Professor não encontrado" });
        return;
      }

      const newLead = {
        id: "lead_" + Date.now(),
        teacherId: teacher.id,
        name: body.name || "Interessado TikTok",
        whatsapp: body.whatsapp || "",
        level: body.level || "Não informado",
        goal: body.goal || "Geral",
        preferredTime: body.preferredTime || "Flexível",
        planChosen: body.planChosen || "A definir",
        value: Number(body.value) || 0,
        origin: body.origin || `TikTok ${teacher.tiktokUser}`,
        status: "novo",
        createdAt: new Date().toISOString(),
      };

      if (!db.leads) db.leads = [];
      db.leads.unshift(newLead);
      writeDb(db);

      // Gera código PIX caso o lead queira confirmar o agendamento da aula experimental
      const pixPayload = generatePixPayload({
        key: teacher.pixKey,
        name: teacher.pixName,
        city: teacher.pixCity,
        amount: newLead.value > 0 ? newLead.value : 50.0,
        txid: "AULA" + String(Date.now()).slice(-6),
      });
      const qrCodeUrl = getPixQrCodeUrl(pixPayload);

      sendJson(res, 201, {
        message: "Triagem enviada com sucesso ao professor!",
        lead: newLead,
        pix: {
          payload: pixPayload,
          qrCodeUrl: qrCodeUrl,
          amount: newLead.value > 0 ? newLead.value : 50.0,
          key: teacher.pixKey,
          beneficiary: teacher.pixName,
        },
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/students -> Matricular novo aluno
  if (pathname === "/api/students" && method === "POST") {
    try {
      const body = await parseBody(req);
      const db = readDb();

      const newStudent = {
        id: "stud_" + Date.now(),
        teacherId: body.teacherId || "prof_lucas",
        name: body.name || "Novo Aluno",
        email: body.email || "",
        whatsapp: body.whatsapp || "",
        planId: body.planId || "",
        planName: body.planName || "Aula Particular",
        subject: body.subject || "Inglês",
        monthlyFee: Number(body.monthlyFee) || 350.0,
        dayOfWeek: body.dayOfWeek || "Segunda-feira",
        timeSlot: body.timeSlot || "19:00",
        paymentStatus: "pendente",
        dueDate:
          body.dueDate ||
          new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        status: "ativo",
      };

      if (!db.students) db.students = [];
      db.students.push(newStudent);
      writeDb(db);

      sendJson(res, 201, {
        message: "Aluno matriculado com sucesso!",
        student: newStudent,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/students/batch -> Importação de múltiplos alunos existentes em lote
  if (pathname === "/api/students/batch" && method === "POST") {
    try {
      const body = await parseBody(req);
      const db = readDb();
      const teacherId = body.teacherId || "prof_lucas";
      const studentsList = Array.isArray(body.students) ? body.students : [];

      if (studentsList.length === 0) {
        sendJson(res, 400, { error: "Nenhum aluno informado para importação." });
        return;
      }

      if (!db.students) db.students = [];

      const createdStudents = [];
      for (const item of studentsList) {
        if (!item.name || !item.name.trim()) continue;
        const newStud = {
          id: "stud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          teacherId: teacherId,
          name: item.name.trim(),
          email: item.email ? item.email.trim() : "",
          whatsapp: item.whatsapp ? item.whatsapp.trim() : "",
          planId: item.planId || "",
          planName: item.planName || "Aula Particular",
          subject: item.subject || "Geral",
          monthlyFee: Math.max(0, Number(item.monthlyFee) || 300.0),
          dayOfWeek: item.dayOfWeek || "A combinar",
          timeSlot: item.timeSlot || "Flexível",
          paymentStatus: item.paymentStatus || "pendente",
          dueDate:
            item.dueDate ||
            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          status: "ativo",
          createdAt: new Date().toISOString(),
        };
        db.students.push(newStud);
        createdStudents.push(newStud);
      }

      writeDb(db);
      sendJson(res, 201, {
        message: `${createdStudents.length} alunos importados com sucesso!`,
        count: createdStudents.length,
        students: createdStudents,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // DELETE /api/students/:id -> Excluir aluno cadastrado
  const studentDeleteMatch = pathname.match(
    /^\/api\/students\/([a-zA-Z0-9_-]+)$/,
  );
  if (studentDeleteMatch && method === "DELETE") {
    const studentId = studentDeleteMatch[1];
    const db = readDb();
    const index = (db.students || []).findIndex((s) => s.id === studentId);
    if (index === -1) {
      sendJson(res, 404, { error: "Aluno não encontrado" });
      return;
    }
    db.students.splice(index, 1);
    writeDb(db);
    sendJson(res, 200, { message: "Aluno removido com sucesso!" });
    return;
  }

  // PUT /api/students/:id/payment -> Alternar status de pagamento PIX
  const studentPayMatch = pathname.match(
    /^\/api\/students\/([a-zA-Z0-9_-]+)\/payment$/,
  );
  if (studentPayMatch && method === "PUT") {
    try {
      const studentId = studentPayMatch[1];
      const body = await parseBody(req);
      const db = readDb();
      const student = (db.students || []).find((s) => s.id === studentId);

      if (!student) {
        sendJson(res, 404, { error: "Aluno não encontrado" });
        return;
      }

      student.paymentStatus =
        body.status || (student.paymentStatus === "pago" ? "pendente" : "pago");
      if (student.paymentStatus === "pago") {
        student.lastPaymentDate = new Date().toISOString().slice(0, 10);
      }
      writeDb(db);

      sendJson(res, 200, {
        message: "Status de pagamento atualizado!",
        student,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // GET /api/students/:id -> Portal do Aluno
  const studentPortalMatch = pathname.match(
    /^\/api\/students\/([a-zA-Z0-9_-]+)$/,
  );
  if (studentPortalMatch && method === "GET") {
    const studentId = studentPortalMatch[1];
    const db = readDb();
    const student = (db.students || []).find((s) => s.id === studentId);

    if (!student) {
      sendJson(res, 404, { error: "Aluno não encontrado" });
      return;
    }

    const teacher =
      (db.teachers || []).find((t) => t.id === student.teacherId) ||
      db.teachers[0];
    const tasks = (db.tasks || []).filter((t) => t.studentId === student.id);

    // Gera PIX da mensalidade do aluno
    const pixPayload = generatePixPayload({
      key: teacher.pixKey,
      name: teacher.pixName,
      city: teacher.pixCity,
      amount: student.monthlyFee,
      txid: "MENS" + student.id.slice(-5),
    });

    sendJson(res, 200, {
      student,
      teacher: {
        name: teacher.name,
        headline: teacher.headline,
        meetLink: teacher.meetLinkDefault,
        pixKey: teacher.pixKey,
        pixName: teacher.pixName,
      },
      pix: {
        payload: pixPayload,
        qrCodeUrl: getPixQrCodeUrl(pixPayload),
        amount: student.monthlyFee,
        dueDate: student.dueDate,
        status: student.paymentStatus,
      },
      tasks,
    });
    return;
  }

  // POST /api/tasks/submit -> Envio de lição de casa pelo aluno (áudio ou PDF)
  if (pathname === "/api/tasks/submit" && method === "POST") {
    try {
      const body = await parseBody(req);
      const db = readDb();

      const newTask = {
        id: "task_" + Date.now(),
        teacherId: body.teacherId || "prof_lucas",
        studentId: body.studentId || "stud_1",
        studentName: body.studentName || "Aluno Dedicado",
        title: body.title || "Exercício Prático de Fixação",
        type: body.type || "audio", // 'audio' ou 'pdf'
        instructions:
          body.instructions || "Lição semanal realizada pelo portal.",
        submittedAt: new Date().toISOString(),
        audioData: body.audioData || null, // Base64 ou URL
        fileUrl: body.fileUrl || null,
        feedback: null,
        status: "aguardando_correcao",
        score: null,
      };

      if (!db.tasks) db.tasks = [];
      db.tasks.unshift(newTask);
      writeDb(db);

      sendJson(res, 201, {
        message: "Lição entregue com sucesso!",
        task: newTask,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/tasks/:id/review -> Professor envia feedback e nota
  const taskReviewMatch = pathname.match(
    /^\/api\/tasks\/([a-zA-Z0-9_-]+)\/review$/,
  );
  if (taskReviewMatch && method === "POST") {
    try {
      const taskId = taskReviewMatch[1];
      const body = await parseBody(req);
      const db = readDb();
      const task = (db.tasks || []).find((t) => t.id === taskId);

      if (!task) {
        sendJson(res, 404, { error: "Tarefa não encontrada" });
        return;
      }

      task.feedback = body.feedback || "Excelente empenho na lição!";
      task.score = body.score || "Aprovado";
      task.status = "corrigido";
      task.reviewedAt = new Date().toISOString();

      writeDb(db);
      sendJson(res, 200, { message: "Feedback enviado ao aluno!", task });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/pix/generate -> Gerador sob demanda de PIX Oficial (Banco Central EMV)
  if (pathname === "/api/pix/generate" && method === "POST") {
    try {
      const body = await parseBody(req);
      const payload = generatePixPayload({
        key: body.key || "financeiro@docentepro.com.br",
        name: body.name || "DOCENTEPRO SAAS",
        city: body.city || "SAO PAULO",
        amount: body.amount,
        txid: body.txid || "DP" + Date.now().toString().slice(-6),
      });
      const qrCodeUrl = getPixQrCodeUrl(payload);

      sendJson(res, 200, { payload, qrCodeUrl, amount: body.amount });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // ==========================================
  // 3. RESOLUÇÃO UNIVERSAL DE ARQUIVOS ESTÁTICOS
  //    (Suporte a public/, raiz, fallback SPA e Firewall Anti-Vazamento)
  // ==========================================
  let targetFile =
    pathname === "/" ? "index.html" : pathname.replace(/^\//, "");

  // URLs amigáveis para termos, privacidade, admin privado do Luciano e landing page
  if (targetFile === "termos") targetFile = "termos.html";
  if (targetFile === "privacidade") targetFile = "privacidade.html";
  if (targetFile === "admin") targetFile = "admin.html";
  if (targetFile === "landing") targetFile = "landing.html";

  // Firewall Anti-Path-Traversal & Proteção contra Vazamento de Banco/Código
  if (!isPathSafe(targetFile)) {
    applySecurityHeaders(res, req);
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      "403 Acesso Negado - Arquivo protegido pelo firewall de cibersegurança do DocentePro",
    );
    return;
  }

  const candidatePaths = [
    path.join(__dirname, "public", targetFile),
    path.join(__dirname, targetFile),
    path.join(process.cwd(), "public", targetFile),
    path.join(process.cwd(), targetFile),
  ];

  let filePath = candidatePaths.find(
    (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
  );

  // SPA Fallback: Se não encontrou arquivo com extensão e não é /api, entrega index.html
  if (!filePath && !pathname.startsWith("/api")) {
    filePath = [
      path.join(__dirname, "public", "index.html"),
      path.join(__dirname, "index.html"),
    ].find((p) => fs.existsSync(p));
  }

  if (filePath && fs.existsSync(filePath)) {
    applySecurityHeaders(res, req);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 404 Not Found
  applySecurityHeaders(res, req);
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Não Encontrado - DocentePro");
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    currentPort = portToTry;
    console.log(
      `[DocentePro] Servidor rodando com sucesso na porta ${currentPort}`,
    );
    console.log(
      `[HealthCheck] Monitoramento ativo em http://localhost:${currentPort}/api/health`,
    );
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(
      `[DocentePro] Porta ${currentPort} em uso, tentando porta ${currentPort + 1}...`,
    );
    currentPort = currentPort + 1;
    setTimeout(() => startServer(currentPort), 200);
  } else {
    console.error("[DocentePro] Erro no servidor:", err.message);
  }
});

startServer(currentPort);

module.exports = { server, getPort: () => currentPort };
