const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'banco_docentepro.json');

function getDefaultDb() {
  return {
    saas: {
      ownerName: "Luciano",
      appName: "DocentePro",
      version: "2.0.0",
      description: "Plataforma de Gestão, Triagem TikTok e Cobrança Automática para Professores Particulares",
      trialDays: 7,
      trialPolicy: "7 dias grátis para usar a plataforma sem pagar nada. Depois R$ 39,90/mês.",
      pixKey: "luklen2@gmail.com",
      pixName: "LUCIANO SAAS DOCENTEPRO",
      pixCity: "SAO PAULO",
      pricingPlans: [
        {
          id: "completo",
          name: "Plano Único Completo (Sem Limites)",
          price: 39.90,
          period: "mês",
          studentLimit: 999,
          recommended: true,
          features: [
            "Alunos e Matérias Ilimitadas",
            "Link da Bio TikTok de Alta Conversão",
            "Triagem Automática de Interessados",
            "Cobrança Recorrente PIX sem Calote",
            "Área do Aluno com Áudios e PDFs",
            "Agenda Integrada com Meet / Zoom",
            "Sem Taxas por Aluno ou Comissões"
          ]
        }
      ]
    },
    teachers: [
      {
        id: "prof_lucas",
        slug: "teacherlucas",
        name: "Teacher Lucas",
        headline: "Inglês Real para Destravar no TikTok e na Vida",
        bio: "Mais de 10 anos ensinando executivos e viajantes a falar inglês sem gaguejar. Foco em conversação prática.",
        subjectCategory: "Inglês e Idiomas",
        tiktokUser: "@teacherlucas.ingles",
        twitter: "@teacherlucas",
        instagram: "@teacherlucas.ingles",
        tiktokFollowers: "85.4k",
        phone: "(11) 98765-4321",
        email: "lucas@teacherlucas.com.br",
        pixKey: "lucas.ingles@gmail.com",
        pixName: "LUCAS SILVA PROFESSOR",
        pixCity: "SAO PAULO",
        meetLinkDefault: "https://meet.google.com/luc-eng-vip",
        saasPlan: "completo",
        saasFee: 39.90,
        saasStatus: "trial",
        trialDaysTotal: 7,
        trialDaysRemaining: 4,
        trialStartDate: "2026-11-17T10:00:00Z",
        plans: [
          {
            id: "plan_l1",
            name: "Inglês para Viagem & Situações Reais",
            subject: "Inglês",
            price: 380.00,
            billingType: "mensal",
            frequency: "1x por semana (60 min)",
            description: "4 aulas individuais no mês + acompanhamento diário de áudios no portal.",
            active: true
          },
          {
            id: "plan_l2",
            name: "Inglês para Carreira & Negócios (Intensivo)",
            subject: "Inglês",
            price: 680.00,
            billingType: "mensal",
            frequency: "2x por semana (60 min)",
            description: "8 aulas individuais no mês + simulações de reuniões, e-mails e entrevistas.",
            active: true
          },
          {
            id: "plan_l3",
            name: "Simulação de Entrevista Internacional",
            subject: "Inglês",
            price: 180.00,
            billingType: "avulso",
            frequency: "Sessão única de 90 min",
            description: "Preparação intensiva para processo seletivo em multinacional com gravação.",
            active: true
          }
        ]
      },
      {
        id: "prof_camila",
        slug: "profcamila",
        name: "Profª Camila Rezende",
        headline: "Redação Nota 1000 & Português para Concursos",
        bio: "Especialista em vestibulares concorridos e bancas examinadoras (Cebraspe, FGV, FCC).",
        subjectCategory: "Português e Redação",
        tiktokUser: "@profcamila.redacao",
        twitter: "@profcamila",
        instagram: "@profcamila.redacao",
        tiktokFollowers: "42.1k",
        phone: "(21) 99887-7665",
        email: "camila@redacaonota1000.com.br",
        pixKey: "camila.redacao@gmail.com",
        pixName: "CAMILA REZENDE PROFA",
        pixCity: "RIO DE JANEIRO",
        meetLinkDefault: "https://meet.google.com/cam-red-vip",
        saasPlan: "completo",
        saasFee: 39.90,
        saasStatus: "ativo",
        trialDaysTotal: 7,
        trialDaysRemaining: 0,
        subscriptionPaidDate: "2026-11-01",
        plans: [
          {
            id: "plan_c1",
            name: "Mentoria Redação Nota 1000 ENEM",
            subject: "Redação",
            price: 320.00,
            billingType: "mensal",
            frequency: "Semanal",
            description: "4 correções detalhadas em vídeo/PDF por mês + 2 encontros de mentoria ao vivo.",
            active: true
          },
          {
            id: "plan_c2",
            name: "Gramática do Zero para Concursos Federais",
            subject: "Português",
            price: 390.00,
            billingType: "mensal",
            frequency: "1x por semana (75 min)",
            description: "Aulas focadas na resolução de questões das bancas Cebraspe e FGV.",
            active: true
          }
        ]
      },
      {
        id: "prof_marcelo",
        slug: "profmarcelo",
        name: "Prof. Marcelo Exatas",
        headline: "Matemática e Física Descomplicada",
        bio: "Engenheiro e professor há 8 anos preparando para ENEM, Medicina e Escolas Militares.",
        subjectCategory: "Matemática e Física",
        tiktokUser: "@marcelo.exatas",
        twitter: "@marceloexatas",
        instagram: "@marcelo.exatas",
        tiktokFollowers: "61.3k",
        phone: "(31) 98711-2233",
        email: "marcelo@exataspro.com.br",
        pixKey: "marcelo.exatas@gmail.com",
        pixName: "MARCELO SILVEIRA PROF",
        pixCity: "BELO HORIZONTE",
        meetLinkDefault: "https://meet.google.com/mar-mat-vip",
        saasPlan: "completo",
        saasFee: 39.90,
        saasStatus: "expirado",
        trialDaysTotal: 7,
        trialDaysRemaining: 0,
        trialStartDate: "2026-11-12T10:00:00Z",
        plans: [
          {
            id: "plan_m1",
            name: "Reforço Escolar Matemática & Física",
            subject: "Matemática",
            price: 300.00,
            billingType: "mensal",
            frequency: "1x por semana",
            description: "4 aulas individuais de resolução de exercícios e acompanhamento da escola.",
            active: true
          },
          {
            id: "plan_m2",
            name: "Preparatório Alto Desempenho (Medicina / IME)",
            subject: "Exatas Avançadas",
            price: 550.00,
            billingType: "mensal",
            frequency: "2x por semana",
            description: "Treinamento intensivo de questões dissertativas e macetes de prova.",
            active: true
          }
        ]
      }
    ],
    students: [
      {
        id: "stud_1",
        teacherId: "prof_lucas",
        name: "João Pedro Santos",
        email: "joao.pedro@empresa.com.br",
        whatsapp: "(11) 98111-2233",
        planId: "plan_l1",
        planName: "Inglês para Viagem (1x na semana)",
        subject: "Inglês",
        monthlyFee: 380.00,
        dayOfWeek: "Terça-feira",
        timeSlot: "19:00",
        paymentStatus: "pago",
        dueDate: "2026-11-25",
        lastPaymentDate: "2026-10-25",
        status: "ativo"
      },
      {
        id: "stud_2",
        teacherId: "prof_lucas",
        name: "Mariana Costa",
        email: "mariana.costa@tech.io",
        whatsapp: "(11) 99444-5566",
        planId: "plan_l2",
        planName: "Inglês para Carreira & Negócios",
        subject: "Inglês",
        monthlyFee: 680.00,
        dayOfWeek: "Segunda e Quinta",
        timeSlot: "18:00",
        paymentStatus: "pendente",
        dueDate: "2026-11-22",
        lastPaymentDate: "2026-10-22",
        status: "ativo"
      },
      {
        id: "stud_3",
        teacherId: "prof_camila",
        name: "Beatriz Oliveira",
        email: "bia.oliveira@medicina.com",
        whatsapp: "(21) 97777-8899",
        planId: "plan_c1",
        planName: "Mentoria Redação Nota 1000",
        subject: "Redação",
        monthlyFee: 320.00,
        dayOfWeek: "Quarta-feira",
        timeSlot: "16:00",
        paymentStatus: "pago",
        dueDate: "2026-11-28",
        lastPaymentDate: "2026-10-28",
        status: "ativo"
      }
    ],
    tasks: [
      {
        id: "task_1",
        teacherId: "prof_lucas",
        studentId: "stud_1",
        studentName: "João Pedro Santos",
        title: "Áudio: Descrevendo o seu dia de trabalho em inglês",
        type: "audio",
        instructions: "Grave um áudio de 1 a 2 minutos falando sobre sua rotina matinal e usando os Phrasal Verbs estudados.",
        submittedAt: "2026-11-19T14:30:00Z",
        audioUrl: "mock_audio_joao_routine.mp3",
        feedback: "Excelente pronúncia na palavra 'Comfortable'! Preste atenção na pronúncia do passado do verbo 'Work' (soa como T no final).",
        status: "corrigido",
        score: "9.5/10"
      },
      {
        id: "task_2",
        teacherId: "prof_lucas",
        studentId: "stud_2",
        studentName: "Mariana Costa",
        title: "Áudio: Elevator Pitch em Inglês (30 segundos)",
        type: "audio",
        instructions: "Apresente quem você é e sua experiência profissional como se estivesse em uma entrevista internacional.",
        submittedAt: "2026-11-20T09:15:00Z",
        audioUrl: "mock_audio_mariana_pitch.mp3",
        feedback: null,
        status: "aguardando_correcao",
        score: null
      },
      {
        id: "task_3",
        teacherId: "prof_camila",
        studentId: "stud_3",
        studentName: "Beatriz Oliveira",
        title: "Redação Tema ENEM: Desafios da Saúde Mental na Era Digital",
        type: "pdf",
        instructions: "Envie o texto dissertativo-argumentativo com introdução, dois desenvolvimentos e proposta de intervenção.",
        submittedAt: "2026-11-18T18:00:00Z",
        fileUrl: "redacao_beatriz_saude_digital.pdf",
        feedback: "Excelente repertório sociocultural! Você articulou Bauman com muita clareza. Ajustar conectivo na conclusão.",
        status: "corrigido",
        score: "960/1000"
      }
    ],
    leads: [
      {
        id: "lead_1",
        teacherId: "prof_lucas",
        name: "Lucas Mendonça",
        whatsapp: "(11) 96543-2109",
        level: "Básico (Entendo um pouco mas travo)",
        goal: "Trabalho / Entrevista de emprego",
        preferredTime: "Noite (após 19h)",
        planChosen: "Inglês para Carreira & Negócios",
        value: 680.00,
        origin: "TikTok @teacherlucas.ingles",
        status: "contatado",
        createdAt: "2026-11-20T10:15:00Z"
      }
    ]
  };
}

function readDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Erro ao ler banco_docentepro.json, restaurando padrão:', err.message);
  }
  const defaultData = getDefaultDb();
  writeDb(defaultData);
  return defaultData;
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[DB] Erro ao gravar banco_docentepro.json:', err.message);
    return false;
  }
}

module.exports = {
  readDb,
  writeDb,
  getDefaultDb
};
