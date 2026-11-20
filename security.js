/**
 * DocentePro - Módulo de Cibersegurança & Hardening Avançado
 * Padrão de Engenharia e Defesa Cibernética (OWASP Top 10 + LGPD)
 */

const path = require("path");

// Master PIN configurável por variável de ambiente com fallback seguro
const MASTER_PIN = process.env.MASTER_ADMIN_PIN || "2026";

// ==========================================================
// 1. RATE LIMITING EM MEMÓRIA (Anti-DDoS, Brute-Force & Flood)
// ==========================================================
class MemoryRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    // Limpeza periódica a cada 5 minutos para evitar vazamento de memória
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  isLimited(ip) {
    const now = Date.now();
    const clientData = this.hits.get(ip) || { count: 0, resetTime: now + this.windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + this.windowMs;
      this.hits.set(ip, clientData);
      return false;
    }

    clientData.count++;
    this.hits.set(ip, clientData);

    return clientData.count > this.maxRequests;
  }

  getResetTimeSeconds(ip) {
    const data = this.hits.get(ip);
    if (!data) return 0;
    return Math.max(0, Math.ceil((data.resetTime - Date.now()) / 1000));
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, data] of this.hits.entries()) {
      if (now > data.resetTime) {
        this.hits.delete(ip);
      }
    }
  }
}

// Limitadores especializados
// Global: 400 requisições por 15 min por IP
const globalLimiter = new MemoryRateLimiter(15 * 60 * 1000, 400);

// Escritas / Formulários (Leads, Alunos, Tarefas): 40 requisições por 15 min por IP
const writeLimiter = new MemoryRateLimiter(15 * 60 * 1000, 40);

// Tentativas de Autenticação Admin (Brute-Force Protection): 12 tentativas por 15 min por IP
const authLimiter = new MemoryRateLimiter(15 * 60 * 1000, 12);

// ==========================================================
// 2. EXTRAÇÃO SEGURA DE IP DO CLIENTE
// ==========================================================
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

// ==========================================================
// 3. CABEÇALHOS DE SEGURANÇA HTTP (Defense in Depth)
// ==========================================================
function applySecurityHeaders(res, req) {
  // Impede que navegadores adivinhem o MIME type (mitiga MIME-sniffing)
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Impede Clickjacking limitando o enquadramento em iframes
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Ativa filtro XSS dos navegadores legados
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Protege a privacidade da URL de origem em links externos
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restringe uso de hardware do usuário (permite microfone para envio de áudio pedagógico)
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(self)");

  // Content-Security-Policy robusta (permite Tailwind, FontAwesome e recursos internos)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; media-src 'self' data: blob:;"
  );
}

// ==========================================================
// 4. SANITIZAÇÃO DE INPUTS (Anti-XSS & Data Poisoning)
// ==========================================================
function sanitizeString(str) {
  if (typeof str !== "string") return str;

  // Remove scripts, iframes e javascript: URIs maliciosos
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    // Impede Prototype Pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const val = obj[key];
    if (typeof val === "string") {
      clean[key] = sanitizeString(val);
    } else if (typeof val === "object" && val !== null) {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

// ==========================================================
// 5. VALIDAÇÃO DE CAMINHO E ANTI-PATH-TRAVERSAL
// ==========================================================
// Lista restrita de extensões permitidas para download público
const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".png", ".jpg", ".jpeg",
  ".gif", ".svg", ".ico", ".mp3", ".wav", ".pdf",
  ".txt", ".woff", ".woff2", ".ttf"
]);

// Lista estrita de arquivos e pastas terminantemente BLOQUEADOS
const BLACKLISTED_FILES = new Set([
  "banco_docentepro.json",
  "package.json",
  "package-lock.json",
  "server.js",
  "db.js",
  "security.js",
  "pix_utils.js",
  "tunnel_manager.js",
  "render.yaml",
  "Dockerfile",
  ".dockerignore",
  ".gitignore",
  ".env",
  "README.md",
  "gerar-pacote-deploy.ps1"
]);

function isPathSafe(targetFile, allowedRootDirs) {
  if (!targetFile || typeof targetFile !== "string") return false;

  // Bloqueia tentativas de subir diretório (Path Traversal)
  if (targetFile.includes("..") || targetFile.includes("\0") || targetFile.includes("%00")) {
    return false;
  }

  const baseName = path.basename(targetFile).toLowerCase();
  if (BLACKLISTED_FILES.has(baseName)) {
    return false;
  }

  // Bloqueia acesso a qualquer arquivo .json do sistema
  if (baseName.endsWith(".json") || baseName.endsWith(".env") || baseName.endsWith(".bat") || baseName.endsWith(".ps1")) {
    return false;
  }

  // Verifica extensão permitida
  const ext = path.extname(baseName).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return false;
  }

  return true;
}

// ==========================================================
// 6. AUTENTICAÇÃO E AUTORIZAÇÃO DO PAINEL MASTER (PIN 2026)
// ==========================================================
function verifyAdminAuth(req) {
  // 1. Verifica cabeçalho customizado x-admin-pin
  const headerPin = req.headers["x-admin-pin"];
  if (headerPin && headerPin.toString().trim() === MASTER_PIN) {
    return true;
  }

  // 2. Verifica Authorization: Bearer <pin>
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === MASTER_PIN) return true;
  }

  // 3. Fallback para query param (?pin=2026)
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const queryPin = parsedUrl.searchParams.get("pin");
    if (queryPin && queryPin.trim() === MASTER_PIN) {
      return true;
    }
  } catch (e) {
    // URL inválida
  }

  return false;
}

module.exports = {
  MASTER_PIN,
  globalLimiter,
  writeLimiter,
  authLimiter,
  getClientIp,
  applySecurityHeaders,
  sanitizeString,
  sanitizeObject,
  isPathSafe,
  verifyAdminAuth
};
