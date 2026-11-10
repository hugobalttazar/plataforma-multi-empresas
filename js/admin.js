// ==========================================================================
// Painel do Administrador Master (admin.js)
// Governança Multi-Tenant, Criação de Empresas e Usuários da Plataforma
// ==========================================================================

import AuthService from './auth-service.js';
import EmpresaService from './empresa-service.js';
import { db, collection, getDocs, doc, deleteDoc, setDoc } from './firebase-init.js';

let todasEmpresas = [];
let todosUsuarios = [];

// 1. Verificação Estrita de Segurança
function verificarPermissaoMaster() {
    const user = AuthService.getCurrentUser();
    if (!user || !user.isMaster) {
        if (window.UI) window.UI.toast('Acesso restrito ao Administrador Master da plataforma.', 'error');
        else alert('Acesso restrito ao Administrador Master da plataforma.');
        window.location.replace('index.html');
        return false;
    }
    return true;
}

// 2. Carregamento dos Dados da Plataforma
async function carregarDadosPlataforma() {
    if (!verificarPermissaoMaster()) return;

    try {
        await EmpresaService.init();
        todasEmpresas = EmpresaService.getEmpresas();

        // Carrega usuários da coleção global 'users' no Firestore com deduplicação rigorosa
        todosUsuarios = [];
        if (db) {
            try {
                const userSnapshot = await getDocs(collection(db, 'users'));
                const seenUserKeys = new Map();
                const duplicateDocsToDelete = [];

                userSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const username = (data.username || docSnap.id).toLowerCase().trim();
                    const empresaId = (data.empresaId || data.empresaCodigo || '').trim();
                    const uniqueKey = `${empresaId}:${username}`;
                    const permissoesArr = Array.isArray(data.permissoes) ? [...data.permissoes] : [];
                    if (!permissoesArr.includes('metas') && (permissoesArr.includes('configuracoes') || data.isMaster)) {
                        permissoesArr.push('metas');
                        if (db) {
                            setDoc(doc(db, 'users', docSnap.id), { ...data, permissoes: permissoesArr }).catch(() => {});
                        }
                    }

                    const candidate = {
                        id: docSnap.id,
                        username: username,
                        nome: data.nome || data.username || 'Sem nome',
                        empresaId: empresaId,
                        isMaster: !!data.isMaster,
                        permissoes: permissoesArr
                    };

                    if (seenUserKeys.has(uniqueKey)) {
                        const existing = seenUserKeys.get(uniqueKey);
                        // Prioriza o documento que possui a chave canônica do tenant (ex: vasconcellos_hugo)
                        if (docSnap.id.startsWith(`${empresaId}_`)) {
                            duplicateDocsToDelete.push(existing.id);
                            seenUserKeys.set(uniqueKey, candidate);
                        } else {
                            duplicateDocsToDelete.push(docSnap.id);
                        }
                    } else {
                        seenUserKeys.set(uniqueKey, candidate);
                    }
                });

                todosUsuarios = Array.from(seenUserKeys.values());

                // Remove do Firestore documentos duplicados legados
                if (duplicateDocsToDelete.length > 0) {
                    duplicateDocsToDelete.forEach(orphanId => {
                        deleteDoc(doc(db, 'users', orphanId)).catch(() => {});
                    });
                }
            } catch (err) {
                console.warn('Carregamento de usuários do Firestore:', err);
            }
        }

        // Se Firestore estiver sem usuários ou offline, mescla com usuários locais deduplicados
        if (todosUsuarios.length === 0) {
            const locais = AuthService.getUsers();
            const seenLocais = new Set();
            todosUsuarios = [];
            locais.forEach(u => {
                const username = (u.username || '').toLowerCase().trim();
                const empresaId = (u.empresaId || '').trim();
                const key = `${empresaId}:${username}`;
                if (!seenLocais.has(key)) {
                    seenLocais.add(key);
                    todosUsuarios.push({
                        id: u.id || username,
                        username: username,
                        nome: u.nome || username,
                        empresaId: empresaId,
                        isMaster: !!u.isMaster,
                        permissoes: u.permissoes || []
                    });
                }
            });
        }

        atualizarKPIs();
        renderizarTabelaEmpresas();
        atualizarSelectEmpresasNosModais();
        renderizarTabelaUsuarios();
    } catch (err) {
        console.error('Erro ao carregar dados da plataforma:', err);
        if (window.UI) window.UI.toast('Erro ao carregar dados da plataforma.', 'error');
    }
}

// 3. Atualização dos Cards de KPIs
function atualizarKPIs() {
    const elEmpresas = document.getElementById('kpiTotalEmpresas');
    const elUsuarios = document.getElementById('kpiTotalUsuarios');
    const badgeEmpresas = document.getElementById('badgeQtdEmpresas');
    const badgeUsuarios = document.getElementById('badgeQtdUsuarios');

    if (elEmpresas) elEmpresas.textContent = todasEmpresas.length;
    if (elUsuarios) elUsuarios.textContent = todosUsuarios.length;
    if (badgeEmpresas) badgeEmpresas.textContent = `${todasEmpresas.length} ativas`;
    if (badgeUsuarios) badgeUsuarios.textContent = `${todosUsuarios.length} cadastrados`;
}

// 4. Renderização da Tabela de Empresas
function renderizarTabelaEmpresas(filtro = '') {
    const tbody = document.getElementById('corpoTabelaEmpresas');
    if (!tbody) return;

    tbody.innerHTML = '';

    const termo = filtro.trim().toLowerCase();
    const filtradas = todasEmpresas.filter(emp => {
        if (!termo) return true;
        return (emp.nome && emp.nome.toLowerCase().includes(termo)) ||
               (emp.id && emp.id.toLowerCase().includes(termo)) ||
               (emp.adminNome && emp.adminNome.toLowerCase().includes(termo));
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table-message">
                    ${termo ? 'Nenhuma empresa encontrada para o filtro pesquisado.' : 'Nenhuma empresa cadastrada ainda. Clique em "+ Nova Empresa" para cadastrar.'}
                </td>
            </tr>
        `;
        return;
    }

    filtradas.forEach(emp => {
        const qtdUsers = todosUsuarios.filter(u => u.empresaId === emp.id).length;
        const tr = document.createElement('tr');

        const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;">${emp.icone || '🏢'}</span>
                    <div>
                        <strong style="font-size: 0.95rem; color: var(--text-main); display: block;">${esc(emp.nome)}</strong>
                        <small style="color: var(--text-muted); text-transform: capitalize;">${esc(emp.tipoNegocio ? emp.tipoNegocio.replace('_', ' ') : 'Geral')}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge" style="font-family: var(--font-mono); font-weight: 700; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 8px; border-radius: 6px;" title="Código de login dos colaboradores">
                    🔑 ${esc(emp.codigo || emp.id)}
                </span>
            </td>
            <td>
                <div><strong>${esc(emp.adminNome || emp.adminUsername || '-')}</strong></div>
                <small style="color: var(--text-muted);">${esc(emp.telefone || 'Sem telefone')}</small>
            </td>
            <td>
                <span class="badge" style="background: var(--success-light); color: var(--success); border: 1px solid var(--success-border);">
                    ✅ ${esc(emp.status || 'Ativo')}
                </span>
            </td>
            <td>
                <span class="badge" style="background: var(--primary-light); color: var(--primary);">
                    👤 ${qtdUsers} operador(es)
                </span>
            </td>
            <td style="text-align: center;">
                <div class="btn-action-group">
                    <button type="button" class="btn btn-sm btn-acessar-empresa" data-id="${emp.id}" style="background-color: var(--primary); color: #fff;" title="Acessar o ambiente desta empresa em modo de teste/suporte">
                        🧪 Acessar (Modo Teste)
                    </button>
                    <div style="display: flex; gap: 4px; justify-content: center; width: 100%; flex-wrap: wrap;">
                        <button type="button" class="btn btn-sm btn-secondary btn-editar-empresa" data-id="${emp.id}" title="Editar Dados da Empresa e Código de Acesso">
                            ✏️ Editar
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-filtrar-usuarios" data-id="${emp.id}" title="Ver usuários desta empresa">
                            👥 Usuários
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-excluir-empresa" data-id="${emp.id}" style="color: var(--danger);" title="Excluir Empresa">
                            🗑️
                        </button>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Vincular botões de Acessar Empresa (Modo Teste)
    document.querySelectorAll('.btn-acessar-empresa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            acessarEmpresaModoTeste(id);
        });
    });

    // Vincular botões de Editar Empresa
    document.querySelectorAll('.btn-editar-empresa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            abrirModalEditarEmpresa(id);
        });
    });

    // Vincular botões de Filtrar Usuários
    document.querySelectorAll('.btn-filtrar-usuarios').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const selectFiltro = document.getElementById('filtroEmpresaUsuarios');
            if (selectFiltro) {
                selectFiltro.value = id;
                renderizarTabelaUsuarios(id);
            }
        });
    });

    // Vincular botões de Excluir Empresa
    document.querySelectorAll('.btn-excluir-empresa').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await confirmarExclusaoEmpresa(id);
        });
    });
}

// 5. Renderização da Tabela de Usuários
function renderizarTabelaUsuarios(empresaIdFiltro = '') {
    const tbody = document.getElementById('corpoTabelaUsuarios');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtrados = todosUsuarios.filter(u => {
        if (!empresaIdFiltro) return true;
        return u.empresaId === empresaIdFiltro;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-table-message">
                    ${empresaIdFiltro ? 'Nenhum usuário cadastrado para esta empresa ainda. Clique em "+ Novo Usuário" para incluir.' : 'Nenhum usuário cadastrado.'}
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach(u => {
        const empresaVinculada = todasEmpresas.find(e => e.id === u.empresaId);
        const nomeEmpresa = empresaVinculada ? `${empresaVinculada.icone || '🏢'} ${empresaVinculada.nome}` : (u.empresaId ? u.empresaId : 'Global');
        
        const tr = document.createElement('tr');
        const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

        const permissoesBadge = u.isMaster 
            ? '<span class="badge" style="background:#fef3c7; color:#b45309;">👑 Acesso Total Master</span>'
            : (u.permissoes && u.permissoes.length > 0 
                ? u.permissoes.map(p => `<span class="badge" style="background:var(--bg-surface); margin-right:3px;">${esc(p)}</span>`).join('') 
                : '<span style="color:var(--text-muted); font-size:0.8rem;">Sem permissões</span>');

        tr.innerHTML = `
            <td>
                <strong>${esc(u.nome)}</strong>
                <small style="display: block; color: var(--text-muted); font-family: var(--font-mono);">${esc(u.username)}</small>
            </td>
            <td>
                <span class="badge" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main);">
                    ${esc(nomeEmpresa)}
                </span>
            </td>
            <td>
                ${u.isMaster 
                    ? '<span class="badge" style="background: var(--primary-light); color: var(--primary);">👑 Administrador Master</span>' 
                    : '<span class="badge" style="background: var(--bg-surface); color: var(--text-muted);">Operador</span>'}
            </td>
            <td>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${permissoesBadge}
                </div>
            </td>
            <td style="text-align: center;">
                ${u.isMaster ? '<span style="color:var(--text-muted); font-size:0.8rem;">Protegido</span>' : `
                    <button type="button" class="btn btn-sm btn-secondary btn-excluir-usuario" data-username="${u.username}" data-id="${u.id}" style="color: var(--danger);" title="Excluir Usuário">
                        🗑️ Excluir
                    </button>
                `}
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Vincular botões de exclusão de usuário
    document.querySelectorAll('.btn-excluir-usuario').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const username = e.currentTarget.getAttribute('data-username');
            const id = e.currentTarget.getAttribute('data-id');
            await confirmarExclusaoUsuario(username, id);
        });
    });
}

// 6. Atualização dos Selects de Empresas nos Modais
function atualizarSelectEmpresasNosModais() {
    const selectFiltro = document.getElementById('filtroEmpresaUsuarios');
    const selectModal = document.getElementById('usuarioEmpresaDestino');

    if (selectFiltro) {
        const valAtual = selectFiltro.value;
        selectFiltro.innerHTML = '<option value="">Todas as Empresas</option>';
        todasEmpresas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.icone || '🏢'} ${emp.nome}`;
            if (emp.id === valAtual) opt.selected = true;
            selectFiltro.appendChild(opt);
        });
    }

    if (selectModal) {
        selectModal.innerHTML = '<option value="">Selecione uma empresa...</option>';
        todasEmpresas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.icone || '🏢'} ${emp.nome}`;
            selectModal.appendChild(opt);
        });
    }
}

// 7. Acessar Empresa em Modo Teste
function acessarEmpresaModoTeste(empresaId) {
    const target = todasEmpresas.find(e => e.id === empresaId);
    const nomeEmpresa = target ? target.nome : empresaId;

    if (window.UI && window.UI.toast) {
        window.UI.toast(`Acessando ambiente de teste: ${nomeEmpresa}...`, 'info', 2000);
    }

    // Configura o Master para a empresa selecionada e navega diretamente para o painel operacional
    EmpresaService.trocarEmpresaMaster(empresaId, 'index.html');
}

// 8. Criação de Empresa
async function cadastrarNovaEmpresa(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEmpresa');
    const erroBox = document.getElementById('msgErroEmpresa');
    if (erroBox) erroBox.style.display = 'none';

    const nome = document.getElementById('empresaNome').value.trim();
    const codigo = (document.getElementById('empresaCodigo')?.value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const tipoNegocio = document.getElementById('empresaSegmento').value;
    const telefone = document.getElementById('empresaTelefone').value.trim();
    const adminNome = document.getElementById('empresaAdminNome').value.trim();
    const adminUsername = document.getElementById('empresaAdminUser').value.trim();
    const adminPassword = document.getElementById('empresaAdminPass').value;

    if (!codigo || codigo.length < 2) {
        if (erroBox) {
            erroBox.textContent = 'O código da empresa deve ter pelo menos 2 caracteres (apenas letras minúsculas e números).';
            erroBox.style.display = 'block';
        }
        document.getElementById('empresaCodigo')?.focus();
        return;
    }

    if (!EmpresaService.verificarDisponibilidadeCodigo(codigo)) {
        if (erroBox) {
            erroBox.textContent = `O código "${codigo}" já está sendo utilizado por outra empresa. Escolha outro código.`;
            erroBox.style.display = 'block';
        }
        document.getElementById('empresaCodigo')?.focus();
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando empresa e ambiente isolado...';

    try {
        const nova = await EmpresaService.criarEmpresa({
            nome,
            codigo,
            tipoNegocio,
            telefone,
            adminNome,
            adminUsername,
            adminPassword
        });

        if (window.UI) window.UI.toast(`Empresa "${nova.nome}" criada com sucesso!`, 'success');
        window.fecharModalEmpresa();
        document.getElementById('formNovaEmpresa').reset();
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (erroBox) {
            erroBox.textContent = err.message || 'Erro ao cadastrar empresa.';
            erroBox.style.display = 'block';
        } else if (window.UI) {
            window.UI.toast(err.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Criar e Ativar Empresa';
    }
}

// 8.1 Edição de Empresa Existente
async function salvarEdicaoEmpresa(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEditarEmpresa');
    const erroBox = document.getElementById('msgErroEditarEmpresa');
    if (erroBox) erroBox.style.display = 'none';

    const idOriginal = document.getElementById('editEmpresaIdOriginal').value;
    const nome = document.getElementById('editEmpresaNome').value.trim();
    const codigo = (document.getElementById('editEmpresaCodigo')?.value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const tipoNegocio = document.getElementById('editEmpresaSegmento').value;
    const telefone = document.getElementById('editEmpresaTelefone').value.trim();
    const adminNome = document.getElementById('editEmpresaAdminNome').value.trim();
    const adminUsername = document.getElementById('editEmpresaAdminUser').value.trim();
    const adminPassword = document.getElementById('editEmpresaAdminPass').value;

    if (!codigo || codigo.length < 2) {
        if (erroBox) {
            erroBox.textContent = 'O código da empresa deve ter pelo menos 2 caracteres (apenas letras minúsculas e números).';
            erroBox.style.display = 'block';
        }
        document.getElementById('editEmpresaCodigo')?.focus();
        return;
    }

    if (!EmpresaService.verificarDisponibilidadeCodigo(codigo, idOriginal)) {
        if (erroBox) {
            erroBox.textContent = `O código "${codigo}" já está sendo utilizado por outra empresa. Escolha outro código.`;
            erroBox.style.display = 'block';
        }
        document.getElementById('editEmpresaCodigo')?.focus();
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando alterações da empresa...';

    try {
        const atualizada = await EmpresaService.atualizarEmpresa(idOriginal, {
            nome,
            codigo,
            tipoNegocio,
            telefone,
            adminNome,
            adminUsername,
            adminPassword
        });

        if (window.UI) window.UI.toast(`Empresa "${atualizada.nome}" atualizada com sucesso!`, 'success');
        window.fecharModalEditarEmpresa();
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (erroBox) {
            erroBox.textContent = err.message || 'Erro ao salvar alterações da empresa.';
            erroBox.style.display = 'block';
        } else if (window.UI) {
            window.UI.toast(err.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Salvar Alterações';
    }
}

// 9. Criação de Usuário para Empresa
async function cadastrarNovoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarUsuario');
    const erroBox = document.getElementById('msgErroUsuario');
    if (erroBox) erroBox.style.display = 'none';

    const empresaId = document.getElementById('usuarioEmpresaDestino').value;
    const nome = document.getElementById('usuarioNome').value.trim();
    const username = document.getElementById('usuarioLogin').value.trim();
    const password = document.getElementById('usuarioSenha').value;

    const checkboxes = document.querySelectorAll('input[name="permissoesUsuario"]:checked');
    const permissoes = Array.from(checkboxes).map(c => c.value);

    if (!empresaId) {
        if (erroBox) {
            erroBox.textContent = 'Selecione a empresa à qual o usuário pertencerá.';
            erroBox.style.display = 'block';
        }
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando usuário...';

    try {
        // Validação de senha
        const check = AuthService.validarForcaSenha(password);
        if (!check.valido) throw new Error(check.mensagem);

        const cleanUsername = username.toLowerCase().trim();
        if (cleanUsername === 'admin') throw new Error('O login "admin" é exclusivo do Master.');

        // Salva na coleção global 'users'
        const hash = await AuthService.hashPassword(password);
        const novoUser = {
            id: Date.now().toString(),
            nome,
            username: cleanUsername,
            passwordHash: hash,
            empresaId,
            isMaster: false,
            permissoes
        };

        if (db) {
            await setDoc(doc(db, 'users', `${empresaId}_${cleanUsername}`), novoUser);
        }

        // Salva também localmente
        const locais = AuthService.getUsers();
        locais.push(novoUser);
        AuthService.saveUsers(locais);

        if (window.UI) window.UI.toast(`Usuário "${cleanUsername}" adicionado com sucesso!`, 'success');
        window.fecharModalUsuario();
        document.getElementById('formNovoUsuario').reset();
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (erroBox) {
            erroBox.textContent = err.message || 'Erro ao cadastrar usuário.';
            erroBox.style.display = 'block';
        } else if (window.UI) {
            window.UI.toast(err.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Salvar Usuário';
    }
}

// 10. Exclusão de Empresa
async function confirmarExclusaoEmpresa(empresaId) {
    const emp = todasEmpresas.find(e => e.id === empresaId);
    if (!emp) return;

    let confirmado = false;
    if (window.UI && window.UI.confirm) {
        confirmado = await window.UI.confirm({
            title: 'Excluir Empresa',
            message: `Tem certeza que deseja excluir a empresa "${emp.nome}" e todas as suas configurações isoladas? Esta ação não pode ser desfeita.`,
            confirmText: 'Excluir Definitivamente',
            danger: true
        });
    } else {
        confirmado = true;
    }

    if (!confirmado) return;

    try {
        await EmpresaService.excluirEmpresa(empresaId);
        if (window.UI && window.UI.toast) window.UI.toast(`Empresa "${emp.nome}" excluída com sucesso.`, 'success');
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (window.UI && window.UI.toast) window.UI.toast(err.message || 'Erro ao excluir empresa.', 'error');
    }
}

// 11. Exclusão de Usuário
async function confirmarExclusaoUsuario(username, id) {
    let confirmado = false;
    if (window.UI && window.UI.confirm) {
        confirmado = await window.UI.confirm({
            title: 'Excluir Usuário',
            message: `Tem certeza que deseja excluir o usuário "${username}"?`,
            confirmText: 'Excluir Usuário',
            danger: true
        });
    } else {
        confirmado = true;
    }

    if (!confirmado) return;

    try {
        if (db && username) {
            await deleteDoc(doc(db, 'users', username.toLowerCase().trim()));
        }
        let locais = AuthService.getUsers();
        locais = locais.filter(u => u.username !== username && u.id !== id);
        AuthService.saveUsers(locais);

        if (window.UI && window.UI.toast) window.UI.toast(`Usuário "${username}" excluído com sucesso.`, 'success');
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (window.UI && window.UI.toast) window.UI.toast(err.message || 'Erro ao excluir usuário.', 'error');
    }
}

// 12. Controle dos Modais
let codigoEditadoManualmente = false;

function atualizarStatusDisponibilidadeCodigo(codigo) {
    const elStatus = document.getElementById('statusDisponibilidadeCodigo');
    if (!elStatus) return;

    const clean = (codigo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) {
        elStatus.style.display = 'none';
        elStatus.textContent = '';
        return;
    }

    elStatus.style.display = 'block';
    if (clean.length < 2) {
        elStatus.style.color = '#f59e0b';
        elStatus.textContent = '⚠️ Digite pelo menos 2 caracteres (letras e números)';
        return;
    }

    const disponivel = EmpresaService.verificarDisponibilidadeCodigo(clean);
    if (!disponivel) {
        elStatus.style.color = '#ef4444';
        elStatus.textContent = `❌ O código "${clean}" já está em uso por outra empresa. Escolha outro.`;
    } else {
        elStatus.style.color = '#10b981';
        elStatus.textContent = `✅ Código "${clean}" disponível!`;
    }
}

window.abrirModalEmpresa = function() {
    codigoEditadoManualmente = false;
    const modal = document.getElementById('modalNovaEmpresa');
    if (modal) modal.classList.add('open');
    const elStatus = document.getElementById('statusDisponibilidadeCodigo');
    if (elStatus) elStatus.style.display = 'none';
    const form = document.getElementById('formNovaEmpresa');
    if (form) form.reset();
};

window.fecharModalEmpresa = function() {
    const modal = document.getElementById('modalNovaEmpresa');
    if (modal) modal.classList.remove('open');
    codigoEditadoManualmente = false;
};

// Funções do Modal de Edição de Empresa
function abrirModalEditarEmpresa(empresaId) {
    const emp = todasEmpresas.find(e => e.id === empresaId || e.codigo === empresaId);
    if (!emp) {
        if (window.UI) window.UI.toast('Empresa não encontrada para edição.', 'error');
        return;
    }

    const modal = document.getElementById('modalEditarEmpresa');
    if (!modal) return;

    document.getElementById('editEmpresaIdOriginal').value = emp.id;
    document.getElementById('editEmpresaCodigoOriginal').value = emp.codigo || emp.id;
    document.getElementById('editEmpresaNome').value = emp.nome || '';
    document.getElementById('editEmpresaCodigo').value = emp.codigo || emp.id || '';
    document.getElementById('editEmpresaSegmento').value = emp.tipoNegocio || 'geral';
    document.getElementById('editEmpresaTelefone').value = emp.telefone || '';
    document.getElementById('editEmpresaAdminNome').value = emp.adminNome || '';
    document.getElementById('editEmpresaAdminUser').value = emp.adminUsername || '';
    document.getElementById('editEmpresaAdminPass').value = '';

    const elStatus = document.getElementById('statusDisponibilidadeCodigoEdit');
    if (elStatus) elStatus.style.display = 'none';

    const erroBox = document.getElementById('msgErroEditarEmpresa');
    if (erroBox) erroBox.style.display = 'none';

    modal.classList.add('open');
}

window.fecharModalEditarEmpresa = function() {
    const modal = document.getElementById('modalEditarEmpresa');
    if (modal) modal.classList.remove('open');
};

window.abrirModalUsuario = function() {
    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.classList.add('open');
};

window.fecharModalUsuario = function() {
    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.classList.remove('open');
};

// 13. Event Listeners e Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosPlataforma();

    // Filtros
    const inputFiltroEmpresas = document.getElementById('filtroEmpresas');
    if (inputFiltroEmpresas) {
        inputFiltroEmpresas.addEventListener('input', (e) => {
            renderizarTabelaEmpresas(e.target.value);
        });
    }

    const selectFiltroUsuarios = document.getElementById('filtroEmpresaUsuarios');
    if (selectFiltroUsuarios) {
        selectFiltroUsuarios.addEventListener('change', (e) => {
            renderizarTabelaUsuarios(e.target.value);
        });
    }

    // Botões dos Modais
    const btnAbrirModalEmpresa = document.getElementById('btnAbrirModalEmpresa');
    if (btnAbrirModalEmpresa) btnAbrirModalEmpresa.onclick = () => window.abrirModalEmpresa();

    const btnNovaEmpresaTabela = document.getElementById('btnNovaEmpresaTabela');
    if (btnNovaEmpresaTabela) btnNovaEmpresaTabela.onclick = () => window.abrirModalEmpresa();

    const btnAbrirModalUsuario = document.getElementById('btnAbrirModalUsuario');
    if (btnAbrirModalUsuario) btnAbrirModalUsuario.onclick = () => window.abrirModalUsuario();

    const btnNovoUsuarioTabela = document.getElementById('btnNovoUsuarioTabela');
    if (btnNovoUsuarioTabela) btnNovoUsuarioTabela.onclick = () => window.abrirModalUsuario();

    // Submissão dos Formulários
    const formNovaEmpresa = document.getElementById('formNovaEmpresa');
    if (formNovaEmpresa) formNovaEmpresa.addEventListener('submit', cadastrarNovaEmpresa);

    const formEditarEmpresa = document.getElementById('formEditarEmpresa');
    if (formEditarEmpresa) formEditarEmpresa.addEventListener('submit', salvarEdicaoEmpresa);

    const formNovoUsuario = document.getElementById('formNovoUsuario');
    if (formNovoUsuario) formNovoUsuario.addEventListener('submit', cadastrarNovoUsuario);

    // Campo de Código da Empresa (Criação): 100% editável e com sugestão curta inicial
    const inputEmpresaNome = document.getElementById('empresaNome');
    const inputEmpresaCodigo = document.getElementById('empresaCodigo');

    if (inputEmpresaNome && inputEmpresaCodigo) {
        inputEmpresaNome.addEventListener('input', () => {
            if (!codigoEditadoManualmente) {
                const sugestaoCurta = EmpresaService.gerarCodigoEmpresa(inputEmpresaNome.value);
                inputEmpresaCodigo.value = sugestaoCurta;
                atualizarStatusDisponibilidadeCodigo(sugestaoCurta);
            }
        });

        inputEmpresaCodigo.addEventListener('input', (e) => {
            codigoEditadoManualmente = true;
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
            atualizarStatusDisponibilidadeCodigo(e.target.value);
        });
    }

    // Campo de Código da Empresa (Edição): validação em tempo real e minúsculas
    const inputEditCodigo = document.getElementById('editEmpresaCodigo');
    if (inputEditCodigo) {
        inputEditCodigo.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
            const clean = e.target.value;
            const originalId = document.getElementById('editEmpresaIdOriginal')?.value;
            const elStatus = document.getElementById('statusDisponibilidadeCodigoEdit');
            if (!elStatus) return;

            if (!clean) {
                elStatus.style.display = 'none';
                return;
            }
            elStatus.style.display = 'block';
            if (clean.length < 2) {
                elStatus.style.color = '#f59e0b';
                elStatus.textContent = '⚠️ Mínimo de 2 caracteres.';
                return;
            }
            const disponivel = EmpresaService.verificarDisponibilidadeCodigo(clean, originalId);
            if (!disponivel) {
                elStatus.style.color = '#ef4444';
                elStatus.textContent = `❌ O código "${clean}" já pertence a outra empresa.`;
            } else {
                elStatus.style.color = '#10b981';
                elStatus.textContent = `✅ Código "${clean}" disponível!`;
            }
        });
    }
});
