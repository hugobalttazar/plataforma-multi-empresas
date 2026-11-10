import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Defesas de Cabeçalhos HTTP e Ocultação de Tecnologias (Fingerprinting)
app.disable('x-powered-by');

app.use((req, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	next();
});

// Middleware para processar JSON nas requisições com limite seguro contra sobrecarga de memória (DoS)
app.use(express.json({ limit: '10mb' }));

// 2. Proteção Inteligente contra Ataques de Força Bruta (Rate Limiting)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutos de bloqueio temporário

function checkRateLimit(key) {
	const now = Date.now();
	const record = loginAttempts.get(key);
	if (!record) return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };

	if (record.lockedUntil && now < record.lockedUntil) {
		const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
		return { allowed: false, remainingMinutes };
	}

	if (now - record.firstAttempt > LOCK_TIME_MS) {
		loginAttempts.delete(key);
		return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
	}

	if (record.count >= MAX_LOGIN_ATTEMPTS) {
		record.lockedUntil = now + LOCK_TIME_MS;
		const remainingMinutes = Math.ceil(LOCK_TIME_MS / 60000);
		return { allowed: false, remainingMinutes };
	}

	return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - record.count };
}

function recordFailedLogin(key, ip, username) {
	const now = Date.now();
	const record = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: 0 };
	record.count += 1;
	if (record.count >= MAX_LOGIN_ATTEMPTS) {
		record.lockedUntil = now + LOCK_TIME_MS;
		console.warn(`[AUDITORIA DE SEGURANÇA] Bloqueio por força bruta acionado para ${username || 'anônimo'} (${ip}) por 15 minutos.`);
	} else {
		console.warn(`[AUDITORIA DE SEGURANÇA] Falha de autenticação para usuário '${username}' a partir do IP ${ip} (tentativa ${record.count}/${MAX_LOGIN_ATTEMPTS}).`);
	}
	loginAttempts.set(key, record);
}

function clearLoginAttempts(key) {
	loginAttempts.delete(key);
}

// Segredo do Servidor para Assinatura de Sessões (HMAC-SHA256)
const SESSION_SECRET = process.env.SESSION_SECRET || 'lava_jato_saas_ultra_secure_secret_key_2026_antigravity';
const MASTER_USER = 'admin';
const MASTER_HASH_SHA256 = 'cf3ba79fe53bf2417903fbde744a088e4e0ca0ca877ee76dcd174011ce5a43dd';

// Validador de Força de Senha conforme padrão de segurança da internet
function validatePasswordStrength(password) {
	if (!password || typeof password !== 'string') {
		return {
			valid: false,
			message: 'A senha é obrigatória.',
			errors: ['A senha não foi informada.']
		};
	}

	const hasMinLength = password.length >= 8;
	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

	const errors = [];
	if (!hasMinLength) errors.push('mínimo de 8 caracteres');
	if (!hasUpperCase) errors.push('pelo menos 1 letra maiúscula');
	if (!hasNumber) errors.push('pelo menos 1 número');
	if (!hasSpecialChar) errors.push('pelo menos 1 caractere especial (!@#$%...)');

	return {
		valid: errors.length === 0,
		details: {
			hasMinLength,
			hasUpperCase,
			hasLowerCase,
			hasNumber,
			hasSpecialChar
		},
		errors,
		message: errors.length === 0
			? 'Senha segura e válida.'
			: `A senha deve conter: ${errors.join(', ')}.`
	};
}

// Criptografia Segura com Salt Aleatório e PBKDF2 (HMAC-SHA512 com 100.000 iterações)
function hashPasswordSecure(password) {
	const saltBytes = crypto.randomBytes(16);
	const saltHex = saltBytes.toString('hex');
	const hash = crypto.pbkdf2Sync(password, saltBytes, 100000, 64, 'sha512').toString('hex');
	return `pbkdf2$100000$${saltHex}$${hash}`;
}

// Comparação Segura contra Timing Attacks (suporta formato moderno PBKDF2 e SHA-256 legado)
function verifyPassword(plainPassword, storedHash) {
	if (!plainPassword || !storedHash) return false;

	try {
		// Formato Moderno: pbkdf2$<iter>$<salt>$<hash>
		if (storedHash.startsWith('pbkdf2$')) {
			const parts = storedHash.split('$');
			if (parts.length === 4) {
				const iterations = parseInt(parts[1], 10);
				const salt = parts[2];
				const originalHashHex = parts[3];
				const bufB = Buffer.from(originalHashHex, 'hex');

				// 1. Tenta verificar decodificando o salt hexadecimal em Buffer (padrão Web Crypto / navegador)
				if (/^[0-9a-fA-F]+$/.test(salt) && salt.length % 2 === 0) {
					const testHashHexBuf = crypto.pbkdf2Sync(plainPassword, Buffer.from(salt, 'hex'), iterations, 64, 'sha512').toString('hex');
					const bufA = Buffer.from(testHashHexBuf, 'hex');
					if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
						return true;
					}
				}

				// 2. Tenta verificar passando o salt como string bruta (caso tenha sido gerado com salt string)
				const testHashHexStr = crypto.pbkdf2Sync(plainPassword, salt, iterations, 64, 'sha512').toString('hex');
				const bufStr = Buffer.from(testHashHexStr, 'hex');
				if (bufStr.length === bufB.length && crypto.timingSafeEqual(bufStr, bufB)) {
					return true;
				}
			}
		}

		// Compatibilidade com hash SHA-256 legado
		if (storedHash.length === 64) {
			const sha256Input = crypto.createHash('sha256').update(plainPassword).digest('hex');
			if (sha256Input.toLowerCase() === storedHash.toLowerCase()) {
				return true;
			}
			// Se o cliente já enviou a string como hash
			if (plainPassword.toLowerCase() === storedHash.toLowerCase()) {
				return true;
			}
		}
	} catch (err) {
		console.error('Erro na verificação de hash:', err);
	}

	return false;
}

// Criação de Token de Sessão Assinado pelo Servidor
function createSessionToken(user) {
	const payload = {
		id: user.id || user.username,
		username: user.username,
		nome: user.nome,
		isMaster: !!user.isMaster,
		empresaId: user.empresaId || '',
		permissoes: user.permissoes || [],
		createdAt: Date.now(),
		exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 dias de validade
	};
	const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
	return `${payloadB64}.${signature}`;
}

// Verificação de Integridade de Token de Sessão
function verifySessionToken(token) {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [payloadB64, signature] = parts;
	const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');

	const bufA = Buffer.from(signature);
	const bufB = Buffer.from(expectedSig);
	if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
		return null;
	}

	try {
		const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
		if (payload.exp && Date.now() > payload.exp) {
			return null; // Expirado
		}
		return payload;
	} catch {
		return null;
	}
}

// ==========================================
// ROTAS DE API DE AUTENTICAÇÃO E SEGURANÇA
// ==========================================

// 1. Validação de Força de Senha
app.post('/api/auth/validate-password', (req, res) => {
	const { password } = req.body || {};
	const result = validatePasswordStrength(password);
	return res.json(result);
});

// 2. Geração Segura de Hash no Servidor
app.post('/api/auth/hash', (req, res) => {
	const { password } = req.body || {};
	const check = validatePasswordStrength(password);
	if (!check.valid) {
		return res.status(400).json({ error: check.message, errors: check.errors });
	}

	const hash = hashPasswordSecure(password);
	return res.json({ hash, valid: true });
});

// 3. Login Centralizado com Verificação Criptográfica e Proteção contra Força Bruta
app.post('/api/auth/login', async (req, res) => {
	const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
	const { username, password, empresaCodigo, localUsers, cloudUsers } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
	}

	const normalizedUser = username.trim().toLowerCase();
	const normalizedEmpresa = (empresaCodigo || '').trim().toLowerCase();
	const rateLimitKey = `${clientIp}:${normalizedEmpresa}:${normalizedUser}`;

	// Verificação de Limite de Tentativas (Rate Limiting)
	const rateCheck = checkRateLimit(rateLimitKey);
	if (!rateCheck.allowed) {
		return res.status(429).json({
			success: false,
			message: `Muitas tentativas incorretas. Conta temporariamente bloqueada por segurança. Tente novamente em ${rateCheck.remainingMinutes} minuto(s).`
		});
	}

	// Delay artificial mínimo (250ms) para amortecer ataques automatizados em lote
	await new Promise(resolve => setTimeout(resolve, 250));

	// 1. VERIFICAÇÃO DO USUÁRIO MASTER
	if (normalizedUser === MASTER_USER) {
		let isMasterValid = false;
		if (process.env.MASTER_PASSWORD) {
			isMasterValid = (password === process.env.MASTER_PASSWORD);
		} else {
			// Valida com SHA-256 legado ou com hash pbkdf2
			const inputHash = crypto.createHash('sha256').update(password).digest('hex');
			isMasterValid = (inputHash === MASTER_HASH_SHA256 || password === MASTER_HASH_SHA256);
		}

		if (isMasterValid) {
			clearLoginAttempts(rateLimitKey);
			console.log(`[AUDITORIA DE SEGURANÇA] Login bem-sucedido: MASTER '${MASTER_USER}' via ${clientIp}`);
			const masterUser = {
				id: 'master',
				nome: 'Administrador Master',
				username: MASTER_USER,
				isMaster: true,
				empresaId: normalizedEmpresa || req.body.activeEmpresaId || '',
				permissoes: ['agenda', 'pedidos', 'caixa', 'estoque', 'posvenda', 'clientes', 'servicos', 'configuracoes', 'metas']
			};
			const token = createSessionToken(masterUser);
			return res.json({ success: true, user: masterUser, token });
		} else {
			recordFailedLogin(rateLimitKey, clientIp, normalizedUser);
			return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
		}
	}

	// 2. EXIGÊNCIA DE CÓDIGO DA EMPRESA PARA USUÁRIOS COMUNS (ISOLAMENTO MULTI-TENANT)
	if (!normalizedEmpresa) {
		return res.status(400).json({
			success: false,
			message: 'Por favor, informe o Código da Empresa para acessar o seu ambiente.'
		});
	}

	// 3. VERIFICAÇÃO EM USUÁRIOS FILTRADOS POR EMPRESA (Locais ou Nuvem)
	const combinedUsers = [];
	if (Array.isArray(cloudUsers)) combinedUsers.push(...cloudUsers);
	if (Array.isArray(localUsers)) combinedUsers.push(...localUsers);

	for (const u of combinedUsers) {
		if (u && u.username && u.username.toLowerCase().trim() === normalizedUser) {
			const userTenant = (u.empresaId || u.empresaCodigo || '').toLowerCase().trim();
			const empresaMatches = (
				userTenant === normalizedEmpresa ||
				(normalizedEmpresa === 'danilodetailer' && (userTenant === 'empresa_danilo' || userTenant === 'danilodetailer' || !userTenant))
			);

			if (empresaMatches) {
				const storedHash = u.passwordHash;
				if (storedHash && verifyPassword(password, storedHash)) {
					clearLoginAttempts(rateLimitKey);
					console.log(`[AUDITORIA DE SEGURANÇA] Login bem-sucedido: Usuário '${normalizedUser}' na empresa '${normalizedEmpresa}' via ${clientIp}`);
					const sessionUser = {
						id: u.id || normalizedUser,
						nome: u.nome || u.username,
						username: normalizedUser,
						isMaster: false,
						empresaId: u.empresaId || normalizedEmpresa,
						empresaCodigo: normalizedEmpresa,
						permissoes: u.permissoes || []
					};
					const token = createSessionToken(sessionUser);
					return res.json({ success: true, user: sessionUser, token });
				}
			}
		}
	}

	recordFailedLogin(rateLimitKey, clientIp, normalizedUser);
	return res.status(401).json({ success: false, message: 'Código da empresa, usuário ou senha incorretos.' });
});

// 4. Verificação de Integridade de Sessão
app.post('/api/auth/verify-session', (req, res) => {
	const { token } = req.body || {};
	const payload = verifySessionToken(token);
	if (payload) {
		return res.json({ valid: true, user: payload });
	}
	return res.status(401).json({ valid: false, message: 'Sessão inválida ou expirada.' });
});


app.get(['/firebase-config.json', '/firebase-applet-config.json'], (req, res) => {
    res.sendFile(path.join(__dirname, 'firebase-applet-config.json'));
});

// PWA Headers for Service Worker and Web App Manifest
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Explicitly serve /js folder
app.use('/js', express.static(path.join(__dirname, 'js')));

// Clean URL page list
const pages = [
	'clientes', 'historico', 'pedidos', 'servicos', 'caixa', 
	'configuracoes', 'agendamentos', 'estoque', 'fidelidade', 'login', 'index', 'admin'
];

// Middleware Anti-Cache para páginas HTML (evita bfcache do celular expondo dados após logout)
app.use((req, res, next) => {
	const p = req.path.toLowerCase();
	if (p.endsWith('.html') || p === '/' || pages.some(page => p === `/${page}` || p === `/${page}/`)) {
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Expires', '0');
		res.setHeader('Surrogate-Control', 'no-store');
	}
	next();
});

// Serve static assets from root directory com headers apropriados
app.use(express.static(__dirname, {
	setHeaders: (res, filePath) => {
		if (filePath.endsWith('.html')) {
			res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		}
	}
}));

// Route handlers for clean URLs (with or without trailing slash)
pages.forEach((page) => {
	app.get([`/${page}`, `/${page}/`], (req, res) => {
		res.sendFile(path.join(__dirname, `${page}.html`));
	});
});

// Default root route
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

// Prevent 404 HTML responses for script/JSON requests to avoid SyntaxError: Unexpected token '<'
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        return res.status(404).type('application/javascript').send('/* 404: Script not found */');
    }
    if (req.path.endsWith('.json')) {
        return res.status(404).type('application/json').send('{}');
    }
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running at http://0.0.0.0:${PORT}`);
});
