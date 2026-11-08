import './error-guard.js';
import './ui-feedback.js';
import { initFirebase, db, auth, signInWithEmailAndPassword, signOut as fbSignOut, doc, getDoc, setDoc, deleteDoc } from './firebase-init.js';
import './firebase-sync.js';
import './empresa-service.js';
import './pwa-install.js';

// Higienização de sessão persistente legada:
// Garante que logins antigos salvos no localStorage sejam removidos para respeitar o controle estrito de sessão por aba/janela
try {
    localStorage.removeItem('logged_in_user');
    localStorage.removeItem('session_token');
    localStorage.removeItem('current_tenant_session');
    localStorage.removeItem('last_active_timestamp');
} catch (e) {}

const AuthService = {
    MASTER_USER: 'admin',
    MASTER_HASH: 'cf3ba79fe53bf2417903fbde744a088e4e0ca0ca877ee76dcd174011ce5a43dd',

    /**
     * Validador de Força de Senha no Padrão da Internet:
     * - Mínimo 8 caracteres
     * - Pelo menos 1 letra maiúscula
     * - Pelo menos 1 número
     * - Pelo menos 1 caractere especial
     */
    validarForcaSenha(password) {
        if (!password || typeof password !== 'string') {
            return {
                valido: false,
                erros: ['A senha não foi informada.'],
                detalhes: { temMinimo: false, temMaiuscula: false, temNumero: false, temEspecial: false },
                mensagem: 'Por favor, digite uma senha.'
            };
        }

        const temMinimo = password.length >= 8;
        const temMaiuscula = /[A-Z]/.test(password);
        const temNumero = /[0-9]/.test(password);
        const temEspecial = /[^A-Za-z0-9]/.test(password);

        const erros = [];
        if (!temMinimo) erros.push('mínimo de 8 caracteres');
        if (!temMaiuscula) erros.push('pelo menos 1 letra maiúscula (A-Z)');
        if (!temNumero) erros.push('pelo menos 1 número (0-9)');
        if (!temEspecial) erros.push('pelo menos 1 caractere especial (!@#$%...)');

        return {
            valido: erros.length === 0,
            erros,
            detalhes: {
                temMinimo,
                temMaiuscula,
                temNumero,
                temEspecial
            },
            mensagem: erros.length === 0 
                ? 'Senha segura e válida.' 
                : `A senha deve conter: ${erros.join(', ')}.`
        };
    },

    /**
     * Criptografia da Senha:
     * Prioriza a API do servidor Node.js (/api/auth/hash) com PBKDF2 e Salt.
     * Caso o app esteja offline (PWA), utiliza a Web Crypto API nativa do navegador com PBKDF2 e Salt.
     */
    async hashPassword(password) {
        // 1. Tenta gerar via Servidor Node.js
        try {
            const resp = await fetch('/api/auth/hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.hash) return data.hash;
            }
        } catch (e) {
            console.warn('API de hash no servidor indisponível, usando Web Crypto local:', e ? e.message : e);
        }

        // 2. Fallback offline seguro: Web Crypto PBKDF2 (100.000 iterações + Salt)
        try {
            if (window.crypto && window.crypto.subtle) {
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
                const keyMaterial = await window.crypto.subtle.importKey(
                    'raw',
                    new TextEncoder().encode(password),
                    { name: 'PBKDF2' },
                    false,
                    ['deriveBits']
                );
                const derivedBits = await window.crypto.subtle.deriveBits(
                    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-512' },
                    keyMaterial,
                    512
                );
                const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
                return `pbkdf2$100000$${saltHex}$${hashHex}`;
            }
        } catch (e) {
            console.warn('Web Crypto PBKDF2 falhou, usando SHA-256 fallback:', e);
        }

        // Fallback básico SHA-256
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    getUsers() {
        return JSON.parse(localStorage.getItem('usuarios')) || [];
    },

    saveUsers(users) {
        localStorage.setItem('usuarios', JSON.stringify(users));
    },

    async carregarUsuariosEmpresa() {
        const currentUser = this.getCurrentUser();
        const empresaId = currentUser?.empresaId || localStorage.getItem('master_active_empresaId');
        if (!empresaId || !db) return this.getUsers();

        try {
            const snap = await getDoc(doc(db, 'empresas', empresaId, 'dados', 'usuarios'));
            if (snap.exists()) {
                const data = snap.data();
                if (data && data.data) {
                    const parsed = JSON.parse(data.data);
                    if (Array.isArray(parsed)) {
                        this.saveUsers(parsed);
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar usuários da empresa no Firestore:', e);
        }
        return this.getUsers();
    },

    async sincronizarUsuariosGlobais() {
        if (!db) return;
        try {
            const users = this.getUsers();
            const currentUser = this.getCurrentUser();
            const empresaId = currentUser?.empresaId || localStorage.getItem('master_active_empresaId') || '';
            for (const u of users) {
                if (u && u.username && u.passwordHash) {
                    const uName = u.username.toLowerCase().trim();
                    const snap = await getDoc(doc(db, 'users', uName));
                    if (!snap.exists()) {
                        await setDoc(doc(db, 'users', uName), {
                            id: u.id || uName,
                            nome: u.nome || u.username,
                            username: uName,
                            passwordHash: u.passwordHash,
                            empresaId: u.empresaId || empresaId,
                            isMaster: false,
                            permissoes: u.permissoes || []
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Aviso ao sincronizar usuários com a nuvem:', e);
        }
    },

    async addUser(nome, username, password, permissoes) {
        // Validação obrigatória da nova senha
        const check = this.validarForcaSenha(password);
        if (!check.valido) {
            throw new Error(check.mensagem);
        }

        const cleanUsername = username.trim().toLowerCase();
        if (!cleanUsername) {
            throw new Error('Nome de usuário inválido.');
        }

        if (cleanUsername === this.MASTER_USER.toLowerCase()) {
            throw new Error('O nome de usuário "admin" é reservado para o Administrador Master.');
        }

        // Obtém a empresa atual vinculada
        const currentUser = this.getCurrentUser();
        const empresaId = currentUser?.empresaId || localStorage.getItem('master_active_empresaId') || '';

        // 1. Verifica se já existe localmente nesta empresa
        const users = this.getUsers();
        if (users.find(u => u.username && u.username.toLowerCase() === cleanUsername && (u.empresaId || '') === empresaId)) {
            throw new Error(`O usuário "${cleanUsername}" já existe nesta empresa.`);
        }

        // 2. Verifica unicidade na empresa no Firestore (evita colisões dentro da mesma empresa)
        if (db && empresaId) {
            try {
                const userDoc = await getDoc(doc(db, 'users', `${empresaId}_${cleanUsername}`));
                if (userDoc.exists()) {
                    throw new Error(`O usuário "${cleanUsername}" já existe nesta empresa.`);
                }
            } catch (err) {
                if (err.message && err.message.includes('já existe')) {
                    throw err;
                }
                console.warn('Aviso ao checar unicidade de usuário no Firestore:', err);
            }
        }

        // 3. Gera hash seguro (PBKDF2)
        const hash = await this.hashPassword(password);
        const newId = Date.now().toString();

        const newUser = {
            id: newId,
            nome: nome.trim(),
            username: cleanUsername,
            passwordHash: hash,
            empresaId: empresaId,
            empresaCodigo: empresaId,
            isMaster: false,
            permissoes: Array.isArray(permissoes) ? permissoes : []
        };

        // 4. Salva no Firestore isolado pelo tenant (chave composta e fallback direto)
        if (db) {
            try {
                if (empresaId) {
                    await setDoc(doc(db, 'users', `${empresaId}_${cleanUsername}`), newUser);
                }
                const snapDireto = await getDoc(doc(db, 'users', cleanUsername));
                if (!snapDireto.exists()) {
                    await setDoc(doc(db, 'users', cleanUsername), newUser);
                }
            } catch (err) {
                console.error('Erro ao salvar usuário no Firestore (users):', err);
            }
        }

        // 5. Adiciona na lista local e salva na coleção privada da empresa
        users.push(newUser);
        this.saveUsers(users);

        if (db && empresaId) {
            try {
                await setDoc(doc(db, 'empresas', empresaId, 'dados', 'usuarios'), {
                    data: JSON.stringify(users)
                });
            } catch (err) {
                console.warn('Erro ao sincronizar subcoleção de usuários da empresa:', err);
            }
        }

        return newUser;
    },

    async updateUser(id, nome, username, password, permissoes) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('Usuário não encontrado');
        
        const oldUser = users[index];
        const oldUsername = (oldUser.username || '').toLowerCase().trim();
        const cleanUsername = username.trim().toLowerCase();

        if (!cleanUsername) {
            throw new Error('Nome de usuário inválido.');
        }

        if (cleanUsername === this.MASTER_USER.toLowerCase() && !oldUser.isMaster) {
            throw new Error('O nome de usuário "admin" é reservado para o Administrador Master.');
        }

        if (users.find(u => u.id !== id && u.username && u.username.toLowerCase() === cleanUsername)) {
            throw new Error(`O usuário "${cleanUsername}" já existe nesta empresa.`);
        }

        // Se o username mudou, verifica unicidade global
        if (oldUsername !== cleanUsername && db) {
            try {
                const userDoc = await getDoc(doc(db, 'users', cleanUsername));
                if (userDoc.exists()) {
                    throw new Error(`O usuário "${cleanUsername}" já está em uso no sistema.`);
                }
            } catch (err) {
                if (err.message && err.message.includes('já está em uso')) {
                    throw err;
                }
                console.warn('Aviso ao checar unicidade de usuário no Firestore:', err);
            }
        }

        let newPasswordHash = oldUser.passwordHash;
        if (password && password.trim() !== '') {
            const check = this.validarForcaSenha(password);
            if (!check.valido) {
                throw new Error(check.mensagem);
            }
            newPasswordHash = await this.hashPassword(password);
        }

        const currentUser = this.getCurrentUser();
        const empresaId = oldUser.empresaId || currentUser?.empresaId || localStorage.getItem('master_active_empresaId') || '';

        users[index].nome = nome.trim();
        users[index].username = cleanUsername;
        users[index].passwordHash = newPasswordHash;
        users[index].permissoes = Array.isArray(permissoes) ? permissoes : [];
        users[index].empresaId = empresaId;

        // Atualiza no Firestore global 'users'
        if (db) {
            try {
                if (oldUsername && oldUsername !== cleanUsername) {
                    await deleteDoc(doc(db, 'users', oldUsername)).catch(() => {});
                }
                await setDoc(doc(db, 'users', cleanUsername), {
                    id: users[index].id,
                    nome: users[index].nome,
                    username: cleanUsername,
                    passwordHash: newPasswordHash,
                    empresaId: empresaId,
                    isMaster: !!oldUser.isMaster,
                    permissoes: users[index].permissoes
                });
            } catch (err) {
                console.error('Erro ao atualizar usuário no Firestore (users):', err);
            }
        }

        this.saveUsers(users);

        if (db && empresaId) {
            try {
                await setDoc(doc(db, 'empresas', empresaId, 'dados', 'usuarios'), {
                    data: JSON.stringify(users)
                });
            } catch (err) {}
        }

        return users[index];
    },

    async removerUser(id) {
        let users = this.getUsers();
        const userToRemove = users.find(u => u.id === id);
        if (!userToRemove) return;

        const usernameNormalized = (userToRemove.username || '').toLowerCase().trim();
        const empresaId = userToRemove.empresaId || this.getCurrentUser()?.empresaId || '';

        // Remove do Firestore global 'users'
        if (db && usernameNormalized) {
            try {
                await deleteDoc(doc(db, 'users', usernameNormalized));
            } catch (err) {
                console.warn('Erro ao remover usuário de users no Firestore:', err);
            }
        }

        users = users.filter(u => u.id !== id);
        this.saveUsers(users);

        if (db && empresaId) {
            try {
                await setDoc(doc(db, 'empresas', empresaId, 'dados', 'usuarios'), {
                    data: JSON.stringify(users)
                });
            } catch (err) {}
        }
    },

    async login(username, password, empresaCodigo = '') {
        const usernameNormalized = (username || '').trim().toLowerCase();
        const empresaCodigoNormalized = (empresaCodigo || '').trim().toLowerCase();
        
        let activeEmpresa = empresaCodigoNormalized || localStorage.getItem('master_active_empresaId');
        if (!activeEmpresa) {
            try {
                const saved = JSON.parse(localStorage.getItem('empresas_cadastradas') || '[]');
                activeEmpresa = saved.length > 0 ? (saved[0].codigo || saved[0].id) : '';
            } catch (e) {
                activeEmpresa = '';
            }
        }

        const localUsers = this.getUsers();
        const cloudUsers = [];

        // 1. Tenta carregar usuário do Firestore com isolamento de tenant
        try {
            if (db) {
                // Tenta chave composta tenant_usuario (ex: danilodetailer_robson)
                if (empresaCodigoNormalized) {
                    const tenantUserDoc = await getDoc(doc(db, 'users', `${empresaCodigoNormalized}_${usernameNormalized}`));
                    if (tenantUserDoc.exists()) {
                        cloudUsers.push(tenantUserDoc.data());
                    }
                    // Tenta também carregar do subdocumento de usuários da própria empresa
                    const empUsersSnap = await getDoc(doc(db, 'empresas', empresaCodigoNormalized, 'dados', 'usuarios'));
                    if (empUsersSnap.exists()) {
                        const parsed = JSON.parse(empUsersSnap.data()?.data || '[]');
                        if (Array.isArray(parsed)) {
                            parsed.forEach(u => {
                                if (u && u.username && u.username.toLowerCase() === usernameNormalized) {
                                    cloudUsers.push({ ...u, empresaId: empresaCodigoNormalized, empresaCodigo: empresaCodigoNormalized });
                                }
                            });
                        }
                    }
                }
                // Tenta chave direta legado se ainda não encontrou
                if (cloudUsers.length === 0) {
                    const userDoc = await getDoc(doc(db, 'users', usernameNormalized));
                    if (userDoc.exists()) {
                        cloudUsers.push(userDoc.data());
                    }
                }
            }
        } catch (err) {
            console.warn('Busca no Firestore em nuvem:', err ? (err.message || String(err)) : '');
        }

        // 2. Tenta autenticar pelo Servidor Node.js (/api/auth/login)
        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameNormalized,
                    password,
                    empresaCodigo: empresaCodigoNormalized,
                    localUsers,
                    cloudUsers,
                    activeEmpresaId: activeEmpresa
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data && data.success && data.user) {
                    if (data.token) {
                        sessionStorage.setItem('session_token', data.token);
                    }
                    const targetEmpresa = data.user.empresaId || empresaCodigoNormalized || activeEmpresa;
                    const prevTenant = sessionStorage.getItem('current_tenant_session') || localStorage.getItem('current_tenant_session');
                    if (prevTenant !== targetEmpresa) {
                        this.limparCacheTenantLocal();
                        sessionStorage.setItem('current_tenant_session', targetEmpresa);
                    }
                    this.setCurrentUser(data.user);
                    if (window.FirebaseSync) window.FirebaseSync.start();
                    return true;
                }
            } else if (resp.status === 429) {
                const data = await resp.json().catch(() => ({}));
                const msg = data.message || 'Muitas tentativas incorretas. Conta temporariamente bloqueada por segurança.';
                throw new Error(msg);
            } else if (resp.status === 400 || resp.status === 401) {
                const data = await resp.json().catch(() => ({}));
                if (data && data.message && resp.status === 400) {
                    throw new Error(data.message);
                }
                return false;
            }
        } catch (err) {
            if (err && err.message && (err.message.includes('Muitas tentativas') || err.message.includes('bloqueada') || err.message.includes('Código da Empresa'))) {
                throw err;
            }
            console.warn('API de login do servidor inacessível, testando fallback local:', err);
        }

        // 3. FALLBACK LOCAL OFFLINE (Garante funcionamento se sem internet no PWA)
        const shaBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const shaHash = Array.from(new Uint8Array(shaBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Master local
        if (usernameNormalized === this.MASTER_USER.toLowerCase() && shaHash === this.MASTER_HASH) {
            const masterData = { 
                id: 'master', 
                nome: 'Administrador Master', 
                username: 'admin', 
                isMaster: true, 
                empresaId: activeEmpresa 
            };
            const prevTenant = sessionStorage.getItem('current_tenant_session') || localStorage.getItem('current_tenant_session');
            if (prevTenant !== activeEmpresa) {
                this.limparCacheTenantLocal();
                sessionStorage.setItem('current_tenant_session', activeEmpresa);
            }
            this.setCurrentUser(masterData);
            if (window.FirebaseSync) window.FirebaseSync.start();
            return true;
        }

        // Operador comum: exige código de empresa para direcionar o tenant
        if (!empresaCodigoNormalized) {
            throw new Error('Por favor, informe o Código da Empresa para acessar o seu ambiente.');
        }

        // Usuários Firestore ou Locais filtrados estritamente pela empresa
        const allCandidates = [...cloudUsers, ...localUsers];
        for (const u of allCandidates) {
            if (u && u.username && u.username.toLowerCase().trim() === usernameNormalized) {
                const userTenant = (u.empresaId || u.empresaCodigo || '').toLowerCase().trim();
                const tenantMatches = (
                    userTenant === empresaCodigoNormalized ||
                    (empresaCodigoNormalized === 'danilodetailer' && (userTenant === 'empresa_danilo' || userTenant === 'danilodetailer' || !userTenant))
                );

                if (!tenantMatches) continue;

                let match = false;
                if (u.passwordHash === shaHash) {
                    match = true;
                } else if (u.passwordHash && u.passwordHash.startsWith('pbkdf2$')) {
                    // Verificação PBKDF2 local
                    try {
                        const parts = u.passwordHash.split('$');
                        if (parts.length === 4) {
                            const saltHex = parts[2];
                            const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                            const keyMaterial = await window.crypto.subtle.importKey(
                                'raw',
                                new TextEncoder().encode(password),
                                { name: 'PBKDF2' },
                                false,
                                ['deriveBits']
                            );
                            const derivedBits = await window.crypto.subtle.deriveBits(
                                { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-512' },
                                keyMaterial,
                                512
                            );
                            const testHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
                            match = (testHex === parts[3]);
                        }
                    } catch (e) {
                        console.error('Erro na checagem PBKDF2 local:', e);
                    }
                }

                if (match) {
                    const targetEmpresa = u.empresaId || empresaCodigoNormalized || activeEmpresa;
                    const prevTenant = sessionStorage.getItem('current_tenant_session') || localStorage.getItem('current_tenant_session');
                    if (prevTenant !== targetEmpresa) {
                        this.limparCacheTenantLocal();
                        sessionStorage.setItem('current_tenant_session', targetEmpresa);
                    }
                    const sessionData = {
                        id: u.id || usernameNormalized,
                        nome: u.nome || u.username,
                        username: usernameNormalized,
                        isMaster: !!u.isMaster,
                        empresaId: targetEmpresa,
                        empresaCodigo: empresaCodigoNormalized,
                        permissoes: u.permissoes || []
                    };
                    this.setCurrentUser(sessionData);
                    if (window.FirebaseSync) window.FirebaseSync.start();
                    return true;
                }
            }
        }

        return false;
    },

    limparCacheTenantLocal() {
        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual', 'caixa_saidas',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];
        COLS.forEach(key => localStorage.removeItem(key));
    },

    async logout(isAutoLogout = false) {
        this.limparCacheTenantLocal();
        sessionStorage.removeItem('logged_in_user');
        sessionStorage.removeItem('session_token');
        sessionStorage.removeItem('current_tenant_session');
        sessionStorage.removeItem('last_active_timestamp');
        localStorage.removeItem('logged_in_user');
        localStorage.removeItem('session_token');
        localStorage.removeItem('current_tenant_session');
        localStorage.removeItem('last_active_timestamp');
        if (this._inactivityInterval) clearInterval(this._inactivityInterval);
        if (window.FirebaseSync) window.FirebaseSync.stop();
        try {
            if (auth) await fbSignOut(auth);
        } catch (e) {
            console.error('Erro ao sair:', e ? (e.message || String(e)) : '');
        }

        if (isAutoLogout) {
            sessionStorage.setItem('logout_reason', 'inactivity');
            window.location.replace('login.html?reason=inactivity');
        } else {
            sessionStorage.removeItem('logout_reason');
            window.location.replace('login.html');
        }
    },

    getCurrentUser() {
        try {
            const data = sessionStorage.getItem('logged_in_user');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    setCurrentUser(user) {
        try {
            if (!user) {
                sessionStorage.removeItem('logged_in_user');
            } else {
                sessionStorage.setItem('logged_in_user', typeof user === 'string' ? user : JSON.stringify(user));
            }
        } catch (e) {}
    },

    iniciarMonitorInatividade() {
        const user = this.getCurrentUser();
        const p = window.location.pathname;
        const isLoginPage = p.endsWith('login.html') || p.endsWith('/login') || p === '/login' || p.endsWith('/login/');
        if (!user || isLoginPage) return;

        const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos de inatividade
        let lastSave = 0;

        const registrarAtividade = () => {
            const now = Date.now();
            if (now - lastSave > 5000) {
                lastSave = now;
                sessionStorage.setItem('last_active_timestamp', now.toString());
            }
        };

        if (!sessionStorage.getItem('last_active_timestamp')) {
            sessionStorage.setItem('last_active_timestamp', Date.now().toString());
        }

        const eventos = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
        eventos.forEach(evt => {
            window.addEventListener(evt, registrarAtividade, { passive: true });
        });

        if (this._inactivityInterval) clearInterval(this._inactivityInterval);
        this._inactivityInterval = setInterval(() => {
            const u = this.getCurrentUser();
            if (!u) {
                clearInterval(this._inactivityInterval);
                return;
            }
            const last = parseInt(sessionStorage.getItem('last_active_timestamp') || '0', 10);
            if (last > 0 && (Date.now() - last) >= TIMEOUT_MS) {
                clearInterval(this._inactivityInterval);
                console.warn('Sessão encerrada por 10 minutos de inatividade.');
                this.logout(true);
            }
        }, 5000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const last = parseInt(sessionStorage.getItem('last_active_timestamp') || '0', 10);
                if (last > 0 && (Date.now() - last) >= TIMEOUT_MS) {
                    this.logout(true);
                } else {
                    registrarAtividade();
                }
            }
        });
    },

    configurarNavegacaoMobile() {
        const p = window.location.pathname;
        const isLoginPage = p.endsWith('login.html') || p.endsWith('/login') || p === '/login' || p.endsWith('/login/');
        const isIndexPage = p.endsWith('index.html') || p === '/' || p.endsWith('/');
        if (isLoginPage) return;

        // 1. Intercepta links do menu e painel para usar replace() e nunca empilhar páginas no celular
        const aplicarNavegacaoReplace = () => {
            const seletores = [
                '.navbar a',
                '.header-actions a',
                '#btnConfiguracoes',
                '.brand-wrapper',
                '.quick-actions a',
                '.action-btn'
            ];
            
            document.querySelectorAll(seletores.join(', ')).forEach(link => {
                if (link.dataset.navBound === 'true') return;
                link.dataset.navBound = 'true';
                
                link.addEventListener('click', (e) => {
                    const href = link.getAttribute('href');
                    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
                    
                    if (href.endsWith('.html') || href.includes('.html?') || href.includes('.html#')) {
                        e.preventDefault();
                        window.location.replace(href);
                    }
                });
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', aplicarNavegacaoReplace);
        } else {
            aplicarNavegacaoReplace();
        }

        // 2. Controle do Botão "Voltar" (Back) no celular
        if (!isIndexPage) {
            // Em qualquer submódulo (Agenda, Caixa, O.S., Estoque, Configurações, etc.):
            // Injeta um estado inicial para capturar o botão voltar nativo
            try {
                history.pushState({ modulo: true }, '', window.location.href);
            } catch (err) {}

            window.addEventListener('popstate', () => {
                // Ao pressionar voltar no celular dentro de um módulo, volta diretamente ao Início sem empilhar
                window.location.replace('index.html');
            });
        } else {
            // Na página principal (Início):
            try {
                history.pushState({ inicio: true }, '', window.location.href);
            } catch (err) {}

            let backPressCount = 0;
            let backTimeout = null;

            window.addEventListener('popstate', () => {
                backPressCount++;
                if (backPressCount === 1) {
                    if (window.UI) {
                        window.UI.toast('Pressione voltar novamente para sair', 'info');
                    }
                    try {
                        history.pushState({ inicio: true }, '', window.location.href);
                    } catch (err) {}
                    backTimeout = setTimeout(() => {
                        backPressCount = 0;
                    }, 2500);
                } else {
                    clearTimeout(backTimeout);
                    history.back();
                }
            });
        }
    },

    async checkAuth() {
        const user = this.getCurrentUser();
        const p = window.location.pathname;
        const isLoginPage = p.endsWith('login.html') || p.endsWith('/login') || p === '/login' || p.endsWith('/login/');
        const isAdminPage = p.endsWith('admin.html') || p.endsWith('/admin') || p === '/admin' || p.endsWith('/admin/');
        
        if (!user && !isLoginPage) {
            window.location.replace('login.html');
            return;
        }
        
        if (user && isLoginPage) {
            if (user.isMaster) {
                window.location.replace('admin.html');
            } else {
                window.location.replace('index.html');
            }
            return;
        }

        if (isAdminPage && (!user || !user.isMaster)) {
            if (window.UI) window.UI.toast('Acesso restrito ao Administrador Master.', 'error');
            else alert('Acesso restrito ao Administrador Master.');
            window.location.replace('index.html');
            return;
        }

        // Validação criptográfica assíncrona do Token de Sessão se estiver logado
        const token = sessionStorage.getItem('session_token');
        if (user && token && !isLoginPage) {
            try {
                const resp = await fetch('/api/auth/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (!data.valid) {
                        console.warn('Sessão expirada ou inválida. Desconectando por segurança.');
                        this.logout();
                        return;
                    }
                }
            } catch (err) {
                // Silencioso em caso de ausência de conexão no PWA
            }
        }

        if (user && !isLoginPage) {
            if (window.FirebaseSync) window.FirebaseSync.start();
            this.iniciarMonitorInatividade();
            this.configurarNavegacaoMobile();
        }

        if (user && !user.isMaster && !isLoginPage) {
            this.applyPermissions(user);
        }
    },

    hasPermission(moduleName) {
        const user = this.getCurrentUser();
        if (!user) return false;
        if (user.isMaster) return true;
        return user.permissoes && user.permissoes.includes(moduleName);
    },

    applyPermissions(user) {
        const path = window.location.pathname;
        let currentModule = '';
        if (path.includes('agendamentos.html')) currentModule = 'agenda';
        if (path.includes('pedidos.html')) currentModule = 'pedidos';
        if (path.includes('caixa.html')) currentModule = 'caixa';
        if (path.includes('estoque.html')) currentModule = 'estoque';
        if (path.includes('fidelidade.html')) currentModule = 'posvenda';
        if (path.includes('clientes.html')) currentModule = 'clientes';
        if (path.includes('servicos.html')) currentModule = 'servicos';
        if (path.includes('configuracoes.html')) currentModule = 'configuracoes';

        if (currentModule && !this.hasPermission(currentModule)) {
            if (window.UI) window.UI.toast('Seu usuário não tem permissão para acessar esta área.', 'error');
            else alert('Seu usuário não tem permissão para acessar esta área.');
            window.location.replace('index.html');
        }

        document.addEventListener('DOMContentLoaded', () => {
            const navMap = {
                'agenda': 'a[href="agendamentos.html"]',
                'pedidos': 'a[href="pedidos.html"]',
                'caixa': 'a[href="caixa.html"]',
                'estoque': 'a[href="estoque.html"]',
                'posvenda': 'a[href="fidelidade.html"]',
                'clientes': 'a[href="clientes.html"]',
                'servicos': 'a[href="servicos.html"]',
                'configuracoes': '.btn-settings-gear'
            };

            for (const [module, selector] of Object.entries(navMap)) {
                if (!this.hasPermission(module)) {
                    const el = document.querySelector(selector);
                    if (el) el.style.display = 'none';
                }
            }
        });
    }
};

window.AuthService = AuthService;
AuthService.checkAuth();

// Proteção contra Bfcache do navegador no celular (evita reabrir sessão após logout)
window.addEventListener('pageshow', (event) => {
    if (event.persisted || (window.performance && window.performance.navigation && window.performance.navigation.type === 2)) {
        AuthService.checkAuth();
    }
});

export default AuthService;
export { AuthService };
