# DocentePro 🎓

> **Plataforma SaaS de Gestão, Triagem de Leads do TikTok e Cobrança Recorrente PIX para Professores Particulares**

Desenvolvido para transformar seguidores do TikTok e Instagram em alunos particulares pagantes, eliminando o tempo perdido com curiosos, acabando com a inadimplência através de cobrança PIX automatizada e entregando um portal com exercícios em áudio e redações.

---

## 💎 Modelo de Negócio do Luciano (Receita Recorrente - MRR)

Os professores mantêm 100% dos valores cobrados de seus alunos nas aulas particulares. Em troca de toda a tecnologia, triagem de TikTok, agendamento e cobrança automática, cada professor paga apenas uma **mensalidade única e acessível** ao Luciano:

| Plano SaaS | Capacidade | Recursos Inclusos | Mensalidade para o Luciano |
| :--- | :--- | :--- | :--- |
| **Plano Completo Sem Limites** | Alunos e Matérias Ilimitadas | Link da Bio TikTok + Triagem + Cobrança PIX Automática + Agenda + Área de Áudios/PDFs | **7 Dias Grátis**, depois **R$ 39,90 / mês** |

> **Proposta irresistível:** O professor tem **7 dias grátis** para testar na prática com seus alunos sem pagar nada e sem cadastrar cartão. Após o período, paga apenas **R$ 39,90/mês via PIX** para manter a plataforma ativa.

---

## 🚀 Principais Funcionalidades

### 1. Link da Bio do TikTok (Mobile-First de Alta Conversão)
- Página responsiva com a foto, bio e TikTok do professor.
- **Autonomia Total de Preços e Matérias:** O professor cadastra, altera preços e matérias (Inglês, Português, Redação ENEM, Matemática) a qualquer momento.
- Formulário inteligente de triagem: nível do aluno, objetivo, horário e seleção de plano.
- **Geração de PIX Automático:** Código Copia-e-Cola e QR Code dinâmico do Banco Central para confirmação de agendamento.

### 2. Painel do Professor (Admin do Cliente)
- Métricas em tempo real: Alunos Ativos, Faturamento Mensal Previsto, Status do PIX e Leads do TikTok.
- **Gerenciador de Planos e Matérias:** Criação, edição, pausa e exclusão de planos com 1 clique.
- Gestão de Alunos: Controle de quem pagou e quem está pendente.
- Fila de Correção de Tarefas: Avaliação de áudios de pronúncia e redações em PDF.

### 3. Área do Estudante / Aluno
- Próxima aula com link direto para o Google Meet / Zoom.
- Fatura mensal com código PIX e QR Code para pagamento direto ao professor.
- **Gravador de Áudio Web Nativo:** O aluno grava a lição de pronúncia diretamente no navegador.

### 4. Painel Master do Luciano (SaaS Admin)
- Visão executiva de todos os professores assinantes.
- Monitoramento do MRR (Receita Recorrente Mensal).
- Tabela com status de assinatura dos professores.

---

## 🛠️ Stack Tecnológica & Padrão de Engenharia
- **Backend:** Node.js (Servidor HTTP nativo ultraleve, zero dependências pesadas, sem consumo excessivo de RAM).
- **Banco de Dados:** JsonDB atômico com persistência confiável (`banco_docentepro.json`).
- **Fintech:** PIX oficial do Banco Central (Padrão EMV com cálculo de CRC-16 polinômio 0x1021).
- **Frontend:** HTML5, Tailwind CSS, FontAwesome e Web Audio API.
- **Nuvem 24/7:** Pronto para Render.com (`render.yaml`), Dockerfile universal (`node:20-alpine`) e Railway.
- **Conformidade Legal:** Termos de Uso e Política de Privacidade de acordo com a LGPD (Lei 13.709/2018).

---

## 🧪 Testes Automatizados
```bash
# Executar todos os testes de integridade localmente
npm test

# Executar teste de homologação ao vivo na nuvem
node tests/test_cloud_live.js https://sua-app.onrender.com
```

---

## ⚡ Como Iniciar Localmente
1. Dê um duplo clique no atalho **`INICIAR_DOCENTEPRO.bat`** na sua Área de Trabalho.
2. O servidor subirá em segundo plano e abrirá automaticamente em `http://localhost:3002`.
