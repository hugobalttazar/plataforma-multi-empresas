// ==========================================================================
// EmpresaService: Gerenciamento Multi-Tenant de Empresas (Exclusivo Master)
// ==========================================================================
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from './firebase-init.js';
import AuthService from './auth-service.js';

const EMPRESA_PADRAO = {
    id: 'empresa_danilo',
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

    getEmpresas() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw !== null) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) return list;
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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    },

    getEmpresaAtiva() {
        const user = AuthService.getCurrentUser();
        const list = this.getEmpresas();
        if (list.length === 0) {
            return {
                id: '',
                nome: 'Nenhum Estabelecimento Cadastrado',
                tipoNegocio: 'geral',
                icone: '🏢',
                status: 'inativo'
            };
        }
        const activeId = user?.empresaId || localStorage.getItem('master_active_empresaId');
        const found = list.find(e => e.id === activeId);
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

    async criarEmpresa({ nome, tipoNegocio, adminNome, adminUsername, adminPassword, telefone }) {
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

        // Gera ID único da empresa
        const cleanSlug = nome.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 20);
        const empresaId = `empresa_${cleanSlug}_${Date.now().toString().slice(-4)}`;
        const icone = ICONS_MAP[tipoNegocio] || '🛠️';

        const novaEmpresa = {
            id: empresaId,
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
                iconeCustom: icone
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
                isMaster: false,
                permissoes: ['agenda', 'pedidos', 'caixa', 'estoque', 'posvenda', 'clientes', 'servicos', 'configuracoes']
            };
            await setDoc(doc(db, 'users', cleanUsername), userRecord);

            // Também salvar no subdocumento de usuários da própria empresa
            const usersData = [{
                id: Date.now().toString(),
                nome: adminNome.trim() || 'Administrador',
                username: cleanUsername,
                passwordHash: hash,
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
