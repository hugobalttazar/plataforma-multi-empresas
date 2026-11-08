// ==========================================================================
// EmpresaService: Gerenciamento Multi-Tenant de Empresas (Exclusivo Master)
// ==========================================================================
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from './firebase-init.js';
import AuthService from './auth-service.js';

const EMPRESA_PADRAO = {
    id: 'danilodetailer',
    codigo: 'danilodetailer',
    nome: 'Lava Jato Danilo Detailer',
    tipoNegocio: 'lava_jato',
    icone: '🚗',
    adminUsername: 'admin',
    adminNome: 'Danilo Master',
    telefone: '',
    status: 'ativo',
    criadoEm: '2026-09-01T12:00:00.000Z'
};

const ICONS_MAP = {
    'lava_jato': '🚗',
    'barbearia': '💈',
    'assistencia': '📱',
    'mecanica': '🔧',
    'petshop': '🐾',
    'geral': '🛠️'
};

const EmpresaService = {
    STORAGE_KEY: 'empresas_cadastradas',

    /**
     * Gera uma sugestão de código curto em minúsculas a partir do nome da empresa.
     * Exemplo: "Danilo Detailer Estética Automotiva" -> "danilo"
     * "Barbearia Retrô" -> "barbearia"
     * "Lava Jato Central" -> "lava"
     */
    gerarCodigoEmpresa(nome) {
        if (!nome || typeof nome !== 'string') return '';
        const palavras = nome.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^a-z0-9\s]/g, '') // remove pontuações
            .split(/\s+/)
            .filter(Boolean);

        if (palavras.length === 0) return '';

        // Prioriza a primeira palavra limpa (curta e direta)
        let slug = palavras[0];
        // Se a primeira palavra tiver menos de 3 caracteres e houver uma segunda palavra, junta com a segunda
        if (slug.length < 3 && palavras.length > 1) {
            slug = (palavras[0] + palavras[1]);
        }
        // Limita a no máximo 12 caracteres para garantir código enxuto
        slug = slug.replace(/[^a-z0-9]/g, '').substring(0, 12);
        return slug;
    },

    /**
     * Verifica unicidade do código (chave primária da empresa)
     */
    verificarDisponibilidadeCodigo(codigo, empresaIdAtual = null) {
        const clean = (codigo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!clean) return false;
        const empresas = this.getEmpresas();
        const existe = empresas.find(e => {
            if (empresaIdAtual && (e.id === empresaIdAtual || e.codigo === empresaIdAtual)) return false;
            const c = (e.codigo || e.id || '').toLowerCase();
            return c === clean || (clean === 'danilodetailer' && c === 'empresa_danilo');
        });
        return !existe;
    },

    /**
     * Gera código único garantido, incrementando sufixo numérico caso haja colisão (chave primária)
     */
    gerarCodigoUnico(nome, empresaIdAtual = null) {
        const base = this.gerarCodigoEmpresa(nome);
        let codigo = base;
        let contador = 2;
        while (!this.verificarDisponibilidadeCodigo(codigo, empresaIdAtual)) {
            codigo = `${base}${contador}`;
            contador++;
        }
        return codigo;
    },

    getEmpresas() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw !== null) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                    return list.map(e => ({
                        ...e,
                        codigo: (e.codigo || (e.id === 'empresa_danilo' ? 'danilodetailer' : e.id) || '').toLowerCase()
                    }));
                }
            }
            // Apenas se nunca foi inicializado antes
            if (!localStorage.getItem('empresas_initialized_once')) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify([EMPRESA_PADRAO]));
                return [EMPRESA_PADRAO];
            }
            return [];
        } catch (e) {
            return [];
        }
    },

    saveEmpresasLocais(list) {
        const normalized = (list || []).map(e => ({
            ...e,
            codigo: (e.codigo || (e.id === 'empresa_danilo' ? 'danilodetailer' : e.id) || '').toLowerCase()
        }));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
    },

    getEmpresaAtiva() {
        const user = AuthService.getCurrentUser();
        const list = this.getEmpresas();
        if (list.length === 0) {
            return {
                id: '',
                codigo: '',
                nome: 'Nenhum Estabelecimento Cadastrado',
                tipoNegocio: 'geral',
                icone: '🏢',
                status: 'inativo'
            };
        }
        const activeId = user?.empresaId || localStorage.getItem('master_active_empresaId');
        const found = list.find(e => 
            e.id === activeId || 
            e.codigo === activeId || 
            (activeId === 'empresa_danilo' && (e.id === 'danilodetailer' || e.codigo === 'danilodetailer'))
        );
        return found || list[0];
    },

    async init() {
        // 1. Tentar sincronizar lista de empresas do Firestore
        try {
            if (db) {
                const colRef = collection(db, 'empresas_lista');
                const snapshot = await getDocs(colRef);
                if (!snapshot.empty) {
                    const cloudList = [];
                    snapshot.forEach(docSnap => {
                        cloudList.push(docSnap.data());
                    });
                    if (cloudList.length > 0) {
                        this.saveEmpresasLocais(cloudList);
                        localStorage.setItem('empresas_initialized_once', 'true');
                    }
                } else {
                    // Se o Firestore está vazio, verifica se é a primeiríssima vez
                    const initializedOnce = localStorage.getItem('empresas_initialized_once');
                    if (!initializedOnce) {
                        // Seed inicial da empresa do Danilo apenas no primeiro uso absoluto
                        await setDoc(doc(db, 'empresas_lista', EMPRESA_PADRAO.id), EMPRESA_PADRAO);
                        this.saveEmpresasLocais([EMPRESA_PADRAO]);
                        localStorage.setItem('empresas_initialized_once', 'true');
                    } else {
                        // O usuário excluiu todas as empresas, mantém a lista vazia
                        this.saveEmpresasLocais([]);
                    }
                }
            }
        } catch (err) {
            console.warn('Não foi possível sincronizar empresas da nuvem:', err ? (err.message || String(err)) : '');
        }

        // 2. Renderizar barra do Master se for administrador Master
        this.renderMasterTenantBar();
    },

    renderMasterTenantBar() {
        const user = AuthService.getCurrentUser();
        if (!user || !user.isMaster) {
            const existing = document.getElementById('masterTenantBar');
            if (existing) existing.remove();
            return;
        }

        const p = window.location.pathname;
        if (p.includes('admin.html') || p === '/admin' || p.endsWith('/admin/')) {
            const existing = document.getElementById('masterTenantBar');
            if (existing) existing.remove();
            return;
        }

        // Se o Master ainda não tiver empresaId definida ou for 'empresa_master', atribui a ativa
        const activeEmpresa = this.getEmpresaAtiva();
        if (!user.empresaId || user.empresaId === 'empresa_master') {
            user.empresaId = activeEmpresa.id;
            if (AuthService && AuthService.setCurrentUser) {
                AuthService.setCurrentUser(user);
            } else {
                sessionStorage.setItem('logged_in_user', JSON.stringify(user));
            }
        }

        // Injeta o seletor no header se não existir
        let bar = document.getElementById('masterTenantBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'masterTenantBar';
            bar.className = 'master-tenant-bar';

            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                headerActions.parentNode.insertBefore(bar, headerActions);
            }
        }

        bar.innerHTML = `
            <div class="master-tenant-badge" title="Você está navegando em modo de teste da empresa. Clique para voltar à administração.">
                <span class="master-crown">🧪 MODO TESTE</span>
                <a href="admin.html" class="btn-manage-tenants" title="Retornar ao Painel do Administrador Master">
                    🛡️ Painel Master
                </a>
            </div>
        `;
    },

    trocarEmpresaMaster(empresaId, redirectUrl = null) {
        const user = AuthService.getCurrentUser();
        if (!user || !user.isMaster) {
            if (window.UI) window.UI.toast('Apenas o Administrador Master pode alternar entre empresas.', 'error');
            else if (typeof alert === 'function') alert('Apenas o Administrador Master pode alternar entre empresas.');
            return;
        }

        const empresas = this.getEmpresas();
        let target = empresas.find(e => e.id === empresaId);
        if (!target) {
            target = { id: empresaId, nome: empresaId };
        }

        // Atualiza empresa no usuário logado
        user.empresaId = target.id;
        if (AuthService && AuthService.setCurrentUser) {
            AuthService.setCurrentUser(user);
        } else {
            sessionStorage.setItem('logged_in_user', JSON.stringify(user));
        }
        localStorage.setItem('master_active_empresaId', target.id);
        sessionStorage.setItem('current_tenant_session', target.id);

        // Limpa coleções temporárias para recarregar da nova empresa sem resquícios
        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual', 'caixa_saidas',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];
        COLS.forEach(key => localStorage.removeItem(key));

        // Inicializa imediatamente a identidade da empresa para o BrandService exibir o nome correto
        const configInicial = {
            nomeEstabelecimento: target.nome,
            razaoSocial: target.nome,
            tipoNegocio: target.tipoNegocio || 'geral',
            telefone: target.telefone || '',
            responsavel: target.adminNome || '',
            iconeCustom: target.icone || ''
        };
        localStorage.setItem('config_negocio', JSON.stringify(configInicial));

        if (typeof window !== 'undefined' && window.BrandService && typeof window.BrandService.aplicarIdentidadeVisual === 'function') {
            window.BrandService.aplicarIdentidadeVisual();
        }

        if (redirectUrl) {
            window.location.href = redirectUrl;
        } else {
            window.location.reload();
        }
    },

    async criarEmpresa({ nome, codigo: codigoInformado, tipoNegocio, adminNome, adminUsername, adminPassword, telefone }) {
        const user = AuthService.getCurrentUser();
        if (!user || !user.isMaster) {
            throw new Error('Apenas o Administrador Master tem permissão para cadastrar novas empresas.');
        }

        if (!nome || !nome.trim()) throw new Error('O nome do estabelecimento é obrigatório.');
        if (!adminUsername || !adminUsername.trim()) throw new Error('O usuário de acesso é obrigatório.');
        
        const passCheck = AuthService.validarForcaSenha(adminPassword);
        if (!passCheck.valido) {
            throw new Error(`Senha do Administrador inválida: ${passCheck.mensagem}`);
        }

        const cleanUsername = adminUsername.trim().toLowerCase();
        if (cleanUsername === 'admin') {
            throw new Error('O usuário "admin" é reservado para o Master.');
        }

        // Define código primário único da empresa garantindo ausência de duplicidade
        let codigo = (codigoInformado || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!codigo) {
            codigo = this.gerarCodigoUnico(nome);
        } else {
            if (!this.verificarDisponibilidadeCodigo(codigo)) {
                throw new Error(`O código de empresa "${codigo}" já está em uso por outro estabelecimento.`);
            }
        }
        const empresaId = codigo; // Chave primária definida como o próprio código único da empresa
        const icone = ICONS_MAP[tipoNegocio] || '🛠️';

        const novaEmpresa = {
            id: empresaId,
            codigo: codigo,
            nome: nome.trim(),
            tipoNegocio: tipoNegocio || 'geral',
            icone: icone,
            adminUsername: cleanUsername,
            adminNome: adminNome.trim() || 'Administrador',
            telefone: telefone || '',
            status: 'ativo',
            criadoEm: new Date().toISOString()
        };

        // 1. Salvar no Firestore a Empresa
        if (db) {
            await setDoc(doc(db, 'empresas_lista', empresaId), novaEmpresa);

            // 2. Configuração inicial da empresa
            const configNegocio = {
                nomeEstabelecimento: nome.trim(),
                razaoSocial: nome.trim(),
                tipoNegocio: tipoNegocio || 'geral',
                telefone: telefone || '',
                iconeCustom: icone,
                codigoEmpresa: codigo
            };
            await setDoc(doc(db, 'empresas', empresaId, 'dados', 'config_negocio'), {
                data: JSON.stringify(configNegocio)
            });

            // 3. Criar usuário Administrador vinculado a esta empresa
            const hash = await AuthService.hashPassword(adminPassword);
            const userRecord = {
                nome: adminNome.trim() || 'Administrador',
                username: cleanUsername,
                passwordHash: hash,
                empresaId: empresaId,
                empresaCodigo: codigo,
                isMaster: false,
                permissoes: ['agenda', 'pedidos', 'caixa', 'estoque', 'posvenda', 'clientes', 'servicos', 'configuracoes']
            };
            // Salva na chave com prefixo do tenant para evitar colisão entre empresas no Firestore global
            await setDoc(doc(db, 'users', `${empresaId}_${cleanUsername}`), userRecord);
            // Salva também na chave direta se ainda não ocupada por outro tenant
            try {
                const snapDireto = await getDoc(doc(db, 'users', cleanUsername));
                if (!snapDireto.exists()) {
                    await setDoc(doc(db, 'users', cleanUsername), userRecord);
                }
            } catch (e) {}

            // Também salvar no subdocumento de usuários da própria empresa
            const usersData = [{
                id: Date.now().toString(),
                nome: adminNome.trim() || 'Administrador',
                username: cleanUsername,
                passwordHash: hash,
                empresaId: empresaId,
                empresaCodigo: codigo,
                permissoes: userRecord.permissoes
            }];
            await setDoc(doc(db, 'empresas', empresaId, 'dados', 'usuarios'), {
                data: JSON.stringify(usersData)
            });

            // 4. Pre-inicializar coleções limpas e isoladas no Firestore para a nova empresa
            const emptyCollections = [
                { key: 'clientes', data: '[]' },
                { key: 'servicos', data: '[]' },
                { key: 'pedidos', data: '[]' },
                { key: 'caixas_fechados', data: '[]' },
                { key: 'caixa_atual', data: '{}' },
                { key: 'caixa_saidas', data: '[]' },
                { key: 'agendamentos', data: '[]' },
                { key: 'estoque_produtos', data: '[]' },
                { key: 'equipe_membros', data: '[]' },
                { key: 'fidelidade_config', data: '{}' },
                { key: 'vistorias_pedidos', data: '{}' }
            ];
            for (const col of emptyCollections) {
                await setDoc(doc(db, 'empresas', empresaId, 'dados', col.key), {
                    data: col.data
                }).catch(() => {});
            }
        }

        // 4. Salvar localmente
        const list = this.getEmpresas();
        list.push(novaEmpresa);
        this.saveEmpresasLocais(list);

        return novaEmpresa;
    },

    /**
     * Atualiza dados de uma empresa existente (nome, código, proprietário, telefone, etc.)
     * e migra os dados do tenant caso o código da empresa tenha sido alterado.
     */
    async atualizarEmpresa(empresaIdOriginal, { nome, codigo, tipoNegocio, adminNome, adminUsername, adminPassword, telefone }) {
        const user = AuthService.getCurrentUser();
        if (!user || !user.isMaster) {
            throw new Error('Apenas o Administrador Master pode editar empresas.');
        }

        if (!nome || !nome.trim()) throw new Error('O nome do estabelecimento é obrigatório.');

        const list = this.getEmpresas();
        const index = list.findIndex(e => e.id === empresaIdOriginal || e.codigo === empresaIdOriginal);
        if (index === -1) {
            throw new Error('Empresa não encontrada para edição.');
        }

        const empresaAntiga = list[index];
        const novoCodigo = (codigo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!novoCodigo || novoCodigo.length < 2) {
            throw new Error('O código da empresa deve ter pelo menos 2 caracteres (apenas letras minúsculas e números).');
        }

        const codigoAntigo = (empresaAntiga.codigo || empresaAntiga.id || '').toLowerCase();
        if (novoCodigo !== codigoAntigo) {
            if (!this.verificarDisponibilidadeCodigo(novoCodigo, empresaIdOriginal)) {
                throw new Error(`O código "${novoCodigo}" já está em uso por outra empresa. Escolha outro código.`);
            }
        }

        const icone = ICONS_MAP[tipoNegocio] || empresaAntiga.icone || '🛠️';
        const novoId = novoCodigo;

        const empresaAtualizada = {
            ...empresaAntiga,
            id: novoId,
            codigo: novoCodigo,
            nome: nome.trim(),
            tipoNegocio: tipoNegocio || empresaAntiga.tipoNegocio || 'geral',
            icone: icone,
            adminNome: (adminNome || empresaAntiga.adminNome || '').trim(),
            adminUsername: (adminUsername || empresaAntiga.adminUsername || '').trim().toLowerCase(),
            telefone: (telefone || '').trim(),
            atualizadoEm: new Date().toISOString()
        };

        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual', 'caixa_saidas',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];

        // 1. Atualizar no Firestore
        if (db) {
            // Se o ID/Código mudou, migra os subdocumentos existentes para a nova chave do tenant
            if (empresaIdOriginal !== novoId) {
                try {
                    for (const col of COLS) {
                        const oldSnap = await getDoc(doc(db, 'empresas', empresaIdOriginal, 'dados', col));
                        if (oldSnap.exists()) {
                            await setDoc(doc(db, 'empresas', novoId, 'dados', col), oldSnap.data());
                            await deleteDoc(doc(db, 'empresas', empresaIdOriginal, 'dados', col)).catch(() => {});
                        }
                    }
                    await deleteDoc(doc(db, 'empresas_lista', empresaIdOriginal)).catch(() => {});
                    await deleteDoc(doc(db, 'empresas', empresaIdOriginal)).catch(() => {});
                } catch (migErr) {
                    console.warn('Aviso durante migração de subcoleções de tenant:', migErr);
                }
            }

            // Salva documento atualizado da empresa
            await setDoc(doc(db, 'empresas_lista', novoId), empresaAtualizada);

            // Atualiza config_negocio com o novo nome e código
            try {
                const configNegocioSnap = await getDoc(doc(db, 'empresas', novoId, 'dados', 'config_negocio'));
                let configObj = {};
                if (configNegocioSnap.exists()) {
                    try { configObj = JSON.parse(configNegocioSnap.data()?.data || '{}'); } catch (e) {}
                }
                configObj.nomeEstabelecimento = nome.trim();
                configObj.razaoSocial = nome.trim();
                configObj.tipoNegocio = tipoNegocio || 'geral';
                configObj.telefone = telefone || '';
                configObj.iconeCustom = icone;
                configObj.codigoEmpresa = novoCodigo;
                await setDoc(doc(db, 'empresas', novoId, 'dados', 'config_negocio'), {
                    data: JSON.stringify(configObj)
                });
            } catch (cfgErr) {
                console.warn('Aviso ao atualizar config_negocio:', cfgErr);
            }

            // Se foi fornecida nova senha para o administrador da empresa
            let newPasswordHash = null;
            if (adminPassword && adminPassword.trim()) {
                const passCheck = AuthService.validarForcaSenha(adminPassword);
                if (!passCheck.valido) {
                    throw new Error(`Senha do Administrador inválida: ${passCheck.mensagem}`);
                }
                newPasswordHash = await AuthService.hashPassword(adminPassword);
            }

            // Atualiza usuários associados na coleção users
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const userUpdates = [];
                usersSnap.forEach(uDoc => {
                    const uData = uDoc.data();
                    if (uData && (uData.empresaId === empresaIdOriginal || uData.empresaCodigo === codigoAntigo || uData.empresaId === novoId)) {
                        const updatedUser = {
                            ...uData,
                            empresaId: novoId,
                            empresaCodigo: novoCodigo
                        };
                        if (newPasswordHash && uData.username === empresaAtualizada.adminUsername) {
                            updatedUser.passwordHash = newPasswordHash;
                        }
                        userUpdates.push(setDoc(doc(db, 'users', `${novoId}_${uData.username}`), updatedUser));
                        userUpdates.push(setDoc(doc(db, 'users', uDoc.id), updatedUser));
                    }
                });
                await Promise.all(userUpdates);
            } catch (uErr) {
                console.warn('Aviso ao atualizar usuários no Firestore:', uErr);
            }
        }

        // 2. Atualizar usuários locais no localStorage
        let locais = AuthService.getUsers();
        locais = locais.map(u => {
            if (u.empresaId === empresaIdOriginal || u.empresaCodigo === codigoAntigo) {
                return { ...u, empresaId: novoId, empresaCodigo: novoCodigo };
            }
            return u;
        });
        AuthService.saveUsers(locais);

        // 3. Atualizar empresa na lista local
        list[index] = empresaAtualizada;
        this.saveEmpresasLocais(list);

        if (localStorage.getItem('master_active_empresaId') === empresaIdOriginal) {
            localStorage.setItem('master_active_empresaId', novoId);
        }

        return empresaAtualizada;
    },

    async excluirEmpresa(empresaId) {
        const user = AuthService.getCurrentUser();
        if (!user || !user.isMaster) {
            throw new Error('Apenas o Administrador Master pode excluir empresas.');
        }

        const list = this.getEmpresas();
        const target = list.find(e => e.id === empresaId);
        if (!target) {
            throw new Error('Empresa não encontrada para exclusão.');
        }

        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];

        // 1. Limpeza profunda na nuvem (Firestore)
        if (db) {
            try {
                // a) Deletar todos os subdocumentos de dados da empresa
                const deletePromises = COLS.map(key => 
                    deleteDoc(doc(db, 'empresas', empresaId, 'dados', key)).catch(e => console.warn(`Aviso ao apagar dados/${key}:`, e))
                );
                await Promise.all(deletePromises);

                // b) Deletar documento principal do tenant
                await deleteDoc(doc(db, 'empresas', empresaId)).catch(() => {});

                // c) Deletar da lista de empresas cadastradas
                await deleteDoc(doc(db, 'empresas_lista', empresaId)).catch(() => {});

                // d) Deletar usuários criados para esta empresa na coleção 'users'
                try {
                    const usersSnap = await getDocs(collection(db, 'users'));
                    const userDeletes = [];
                    usersSnap.forEach(uDoc => {
                        const uData = uDoc.data();
                        if (uData && (uData.empresaId === empresaId || uDoc.id === target.adminUsername)) {
                            userDeletes.push(deleteDoc(doc(db, 'users', uDoc.id)));
                        }
                    });
                    await Promise.all(userDeletes);
                } catch (userErr) {
                    console.warn('Aviso ao apagar usuários da empresa:', userErr);
                }
            } catch (err) {
                console.warn('Erro ao excluir empresa da nuvem:', err ? (err.message || String(err)) : '');
            }
        }

        // 2. Limpeza no LocalStorage
        const remaining = list.filter(e => e.id !== empresaId);
        this.saveEmpresasLocais(remaining);

        // Se a empresa excluída era a ativa atualmente
        const activeEmpresaId = localStorage.getItem('master_active_empresaId') || user.empresaId;
        if (activeEmpresaId === empresaId) {
            // Limpa as coleções de cache locais
            COLS.forEach(key => localStorage.removeItem(key));

            if (remaining.length > 0) {
                user.empresaId = remaining[0].id;
                localStorage.setItem('master_active_empresaId', remaining[0].id);
            } else {
                user.empresaId = '';
                localStorage.removeItem('master_active_empresaId');
            }
            if (AuthService && AuthService.setCurrentUser) {
                AuthService.setCurrentUser(user);
            } else {
                sessionStorage.setItem('logged_in_user', JSON.stringify(user));
            }
        }

        return remaining;
    },

    async exportarDadosEmpresa(empresaId) {
        const list = this.getEmpresas();
        const target = list.find(e => e.id === empresaId) || { id: empresaId, nome: empresaId };

        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];

        const backup = {
            tipo: 'BACKUP_DADOS_EMPRESA',
            dataExportacao: new Date().toISOString(),
            empresa: target,
            dados: {}
        };

        if (db) {
            try {
                for (const key of COLS) {
                    try {
                        const snap = await getDoc(doc(db, 'empresas', empresaId, 'dados', key));
                        if (snap.exists() && snap.data().data) {
                            try {
                                backup.dados[key] = JSON.parse(snap.data().data);
                            } catch (e) {
                                backup.dados[key] = snap.data().data;
                            }
                        } else {
                            backup.dados[key] = [];
                        }
                    } catch (err) {
                        backup.dados[key] = [];
                    }
                }
            } catch (err) {
                console.warn('Erro ao ler do Firestore para backup:', err);
            }
        } else {
            COLS.forEach(key => {
                const local = localStorage.getItem(key);
                try {
                    backup.dados[key] = local ? JSON.parse(local) : [];
                } catch (e) {
                    backup.dados[key] = local;
                }
            });
        }

        const safeSlug = (target.nome || empresaId).toLowerCase().replace(/[^a-z0-9]/g, '_');
        const dataStr = new Date().toISOString().slice(0, 10);
        this.downloadJSON(backup, `backup_${safeSlug}_${dataStr}.json`);
    },

    async exportarBancoCompleto() {
        const list = this.getEmpresas();
        const COLS = [
            'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual',
            'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
            'fidelidade_config', 'vistorias_pedidos', 'usuarios'
        ];

        const dumpCompleto = {
            tipo: 'BACKUP_BANCO_COMPLETO_SISTEMA',
            dataExportacao: new Date().toISOString(),
            totalEmpresas: list.length,
            empresasCadastradas: list,
            bancoPorEmpresa: {}
        };

        for (const emp of list) {
            dumpCompleto.bancoPorEmpresa[emp.id] = {
                empresa: emp,
                dados: {}
            };

            for (const key of COLS) {
                if (db) {
                    try {
                        const snap = await getDoc(doc(db, 'empresas', emp.id, 'dados', key));
                        if (snap.exists() && snap.data().data) {
                            try {
                                dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = JSON.parse(snap.data().data);
                            } catch (e) {
                                dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = snap.data().data;
                            }
                        } else {
                            dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = [];
                        }
                    } catch (err) {
                        dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = [];
                    }
                } else {
                    const local = localStorage.getItem(key);
                    try {
                        dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = local ? JSON.parse(local) : [];
                    } catch (e) {
                        dumpCompleto.bancoPorEmpresa[emp.id].dados[key] = local;
                    }
                }
            }
        }

        const dataStr = new Date().toISOString().slice(0, 10);
        this.downloadJSON(dumpCompleto, `backup_completo_banco_dados_${dataStr}.json`);
    },

    downloadJSON(dados, nomeArquivo) {
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

window.EmpresaService = EmpresaService;

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    EmpresaService.init();
});

export default EmpresaService;
export { EmpresaService };
