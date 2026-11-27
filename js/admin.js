// ==========================================================================
// Painel do Administrador Master (admin.js)
// Governança Multi-Tenant, Criação de Empresas e Usuários da Plataforma
// ==========================================================================

import AuthService from './auth-service.js';
import EmpresaService from './empresa-service.js';
import SaasGuard, { PLANOS_SAAS } from './saas-guard.js';
import { db, collection, getDocs, getDoc, doc, deleteDoc, setDoc } from './firebase-init.js';

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
                    const permissoesV2 = !!data.permissoesV2;

                    const candidate = {
                        id: docSnap.id,
                        userId: data.id || docSnap.id,
                        username: username,
                        nome: data.nome || data.username || 'Sem nome',
                        passwordHash: data.passwordHash || '',
                        empresaId: empresaId,
                        isMaster: !!data.isMaster,
                        permissoes: permissoesArr,
                        permissoesV2
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
                        userId: u.id || username,
                        username: username,
                        nome: u.nome || username,
                        passwordHash: u.passwordHash || '',
                        empresaId: empresaId,
                        isMaster: !!u.isMaster,
                        permissoes: u.permissoes || [],
                        permissoesV2: !!u.permissoesV2
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
        const usersEmpresa = todosUsuarios.filter(u => u.empresaId === emp.id && !u.isMaster && u.username !== 'admin');
        const qtdUsers = usersEmpresa.length;
        const aval = SaasGuard.avaliarAssinatura(emp);
        const tr = document.createElement('tr');

        const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
        const vencBR = aval.vencimentoMensalidade ? SaasGuard.formatarDataBRSaas(aval.vencimentoMensalidade) : 'Sem venc.';

        let statusStyle = 'background: var(--success-light); color: var(--success); border: 1px solid var(--success-border);';
        let statusIcon = '✅';
        if (aval.situacao === 'suspenso') {
            statusStyle = 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;';
            statusIcon = '⛔';
        } else if (aval.situacao === 'tolerancia') {
            statusStyle = 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
            statusIcon = '⚠️';
        } else if (aval.situacao === 'vencendo') {
            statusStyle = 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;';
            statusIcon = '📅';
        }

        const isSuspensa = aval.statusAssinatura === 'suspenso';

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;">${emp.icone || '🏢'}</span>
                    <div>
                        <strong style="font-size: 0.95rem; color: var(--text-main); display: block;">${esc(emp.nome)}</strong>
                        <small style="color: var(--text-muted); text-transform: capitalize;">${esc(emp.tipoNegocio ? emp.tipoNegocio.replace('_', ' ') : 'Geral')} • ${esc(emp.adminNome || emp.adminUsername || '-')}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge" style="font-family: var(--font-mono); font-weight: 700; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 8px; border-radius: 6px;" title="Código de login dos colaboradores">
                    🔑 ${esc(emp.codigo || emp.id)}
                </span>
            </td>
            <td>
                <strong style="display:block; font-size:0.88rem; color:var(--text-main);">${esc(aval.planoNome)}</strong>
                <small style="color:var(--text-muted);">Máx. ${aval.limiteUsuarios} usuário(s) • Tol. ${aval.diasTolerancia}d</small>
            </td>
            <td>
                <div style="margin-bottom:4px;">
                    <span class="badge" style="${statusStyle}">
                        ${statusIcon} ${esc(aval.labelSituacao)}
                    </span>
                </div>
                <small style="color:var(--text-muted); font-variant-numeric: tabular-nums;">Venc: ${esc(vencBR)}</small>
            </td>
            <td>
                <span class="badge" style="background: ${qtdUsers >= aval.limiteUsuarios ? '#fef3c7' : 'var(--primary-light)'}; color: ${qtdUsers >= aval.limiteUsuarios ? '#92400e' : 'var(--primary)'}; font-variant-numeric: tabular-nums;">
                    👤 ${qtdUsers}/${aval.limiteUsuarios}
                </span>
            </td>
            <td style="text-align: center;">
                <div class="btn-action-group">
                    <button type="button" class="btn btn-sm btn-acessar-empresa" data-id="${emp.id}" style="background-color: var(--primary); color: #fff;" title="Acessar o ambiente desta empresa em modo de teste/suporte">
                        🧪 Acessar (Modo Teste)
                    </button>
                    <div style="display: flex; gap: 4px; justify-content: center; width: 100%; flex-wrap: wrap;">
                        <button type="button" class="btn btn-sm btn-secondary btn-renovar-empresa" data-id="${emp.id}" style="color:#15803d;" title="Renovar mensalidade por +30 dias e manter ativo">
                            🔄 +30d
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-toggle-suspensao" data-id="${emp.id}" style="color:${isSuspensa ? '#15803d' : '#b45309'};" title="${isSuspensa ? 'Reativar assinatura' : 'Suspender novos cadastros'}">
                            ${isSuspensa ? '▶️ Ativar' : '⏸️ Suspender'}
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-editar-empresa" data-id="${emp.id}" title="Editar Dados da Empresa, Plano e Código">
                            ✏️ Editar
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-filtrar-usuarios" data-id="${emp.id}" title="Ver usuários desta empresa">
                            👥
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

    // Vincular botões de Renovação Rápida +30 dias
    document.querySelectorAll('.btn-renovar-empresa').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await renovarEmpresa30Dias(id);
        });
    });

    // Vincular botões de Suspender / Reativar
    document.querySelectorAll('.btn-toggle-suspensao').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await alternarSuspensaoEmpresa(id);
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

async function renovarEmpresa30Dias(empresaId) {
    const emp = todasEmpresas.find(e => e.id === empresaId || e.codigo === empresaId);
    if (!emp) return;
    const hojeISO = new Date().toISOString().slice(0, 10);
    const baseData = (emp.vencimentoMensalidade && emp.vencimentoMensalidade > hojeISO)
        ? emp.vencimentoMensalidade
        : hojeISO;
    const novoVenc = SaasGuard.somarDiasISO(baseData, 30);

    try {
        await EmpresaService.atualizarAssinaturaEmpresa(emp.id, {
            vencimentoMensalidade: novoVenc,
            statusAssinatura: 'ativo'
        });
        if (window.UI) window.UI.toast(`Mensalidade de "${emp.nome}" renovada até ${SaasGuard.formatarDataBRSaas(novoVenc)}!`, 'success');
        await carregarDadosPlataforma();
    } catch (err) {
        if (window.UI) window.UI.toast(err.message || 'Erro ao renovar mensalidade.', 'error');
    }
}

async function alternarSuspensaoEmpresa(empresaId) {
    const emp = todasEmpresas.find(e => e.id === empresaId || e.codigo === empresaId);
    if (!emp) return;
    const atualSuspenso = emp.statusAssinatura === 'suspenso' || emp.status === 'suspenso';
    const novoStatus = atualSuspenso ? 'ativo' : 'suspenso';

    try {
        await EmpresaService.atualizarAssinaturaEmpresa(emp.id, {
            statusAssinatura: novoStatus
        });
        if (window.UI) {
            window.UI.toast(
                novoStatus === 'ativo'
                    ? `Assinatura de "${emp.nome}" reativada!`
                    : `Assinatura de "${emp.nome}" suspensa (novos cadastros bloqueados).`,
                novoStatus === 'ativo' ? 'success' : 'warning'
            );
        }
        await carregarDadosPlataforma();
    } catch (err) {
        if (window.UI) window.UI.toast(err.message || 'Erro ao atualizar status da assinatura.', 'error');
    }
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

        const efetivas = AuthService.getEffectivePermissions(u);
        const totalDisponivel = Array.isArray(AuthService.ALL_PERMISSION_KEYS) ? AuthService.ALL_PERMISSION_KEYS.length : 15;
        const permissoesBadge = u.isMaster 
            ? '<span class="badge" style="background:#fef3c7; color:#b45309;">👑 Acesso Total Master</span>'
            : (efetivas.length >= totalDisponivel
                ? `<span class="badge badge-perm-all">✅ Acesso Total (${efetivas.length}/${totalDisponivel})</span>`
                : (efetivas.length > 0 
                    ? efetivas.map(p => `<span class="perm-badge-item">${esc(AuthService.getPermissionLabel(p))}</span>`).join('') 
                    : '<span style="color:var(--text-muted); font-size:0.8rem;">Sem permissões</span>'));

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
                    : '<span class="badge" style="background: var(--bg-surface); color: var(--text-muted);">Operador / Admin Empresa</span>'}
            </td>
            <td>
                <div class="perm-badge-list">
                    ${permissoesBadge}
                </div>
            </td>
            <td style="text-align: center;">
                ${u.isMaster ? '<span style="color:var(--text-muted); font-size:0.8rem;">Protegido</span>' : `
                    <div class="btn-action-group">
                        <button type="button" class="btn btn-sm btn-secondary btn-editar-usuario" data-id="${esc(u.id)}" title="Editar Usuário e Permissões">
                            ✏️ Editar
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-excluir-usuario" data-username="${esc(u.username)}" data-empresa="${esc(u.empresaId)}" data-id="${esc(u.id)}" style="color: var(--danger);" title="Excluir Usuário">
                            🗑️ Excluir
                        </button>
                    </div>
                `}
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Vincular botões de edição de usuário
    document.querySelectorAll('.btn-editar-usuario').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            abrirModalEditarUsuario(id);
        });
    });

    // Vincular botões de exclusão de usuário
    document.querySelectorAll('.btn-excluir-usuario').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const username = e.currentTarget.getAttribute('data-username');
            const empresaId = e.currentTarget.getAttribute('data-empresa');
            const id = e.currentTarget.getAttribute('data-id');
            await confirmarExclusaoUsuario(username, id, empresaId);
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
    const planoId = document.getElementById('empresaPlano')?.value || 'profissional';
    const limiteUsuarios = parseInt(document.getElementById('empresaLimiteUsuarios')?.value || '5', 10);
    const vencimentoMensalidade = document.getElementById('empresaVencimento')?.value || '';
    const diasTolerancia = parseInt(document.getElementById('empresaTolerancia')?.value || '5', 10);
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
            planoId,
            limiteUsuarios,
            vencimentoMensalidade,
            diasTolerancia,
            statusAssinatura: 'ativo',
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
    const planoId = document.getElementById('editEmpresaPlano')?.value || 'profissional';
    const limiteUsuarios = parseInt(document.getElementById('editEmpresaLimiteUsuarios')?.value || '5', 10);
    const vencimentoMensalidade = document.getElementById('editEmpresaVencimento')?.value || '';
    const diasTolerancia = parseInt(document.getElementById('editEmpresaTolerancia')?.value || '5', 10);
    const statusAssinatura = document.getElementById('editEmpresaStatusAssinatura')?.value || 'ativo';
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
            planoId,
            limiteUsuarios,
            vencimentoMensalidade,
            diasTolerancia,
            statusAssinatura,
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

// 9. Criação / Edição de Usuário para Empresa
async function sincronizarSubdocUsuariosEmpresa(empresaId, callbackMutate) {
    if (!db || !empresaId) return;
    try {
        const ref = doc(db, 'empresas', empresaId, 'dados', 'usuarios');
        const snap = await getDoc(ref);
        let lista = [];
        if (snap.exists() && snap.data()?.data) {
            try { lista = JSON.parse(snap.data().data); } catch (e) {}
        }
        if (!Array.isArray(lista)) lista = [];
        const atualizada = callbackMutate(lista);
        await setDoc(ref, { data: JSON.stringify(atualizada) });
    } catch (err) {
        console.warn('Aviso ao sincronizar subdocumento usuarios da empresa:', err);
    }
}

async function cadastrarNovoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarUsuario');
    const erroBox = document.getElementById('msgErroUsuario');
    if (erroBox) erroBox.style.display = 'none';

    const editDocId = (document.getElementById('usuarioEditDocId')?.value || '').trim();
    const editUserId = (document.getElementById('usuarioEditId')?.value || '').trim();
    const editUsernameOrig = (document.getElementById('usuarioEditUsernameOriginal')?.value || '').trim().toLowerCase();
    const isEdit = !!editDocId;

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
        const empDestino = todasEmpresas.find(emp => emp.id === empresaId || emp.codigo === empresaId);
        const cleanUsername = username.toLowerCase().trim();
        if (!cleanUsername) throw new Error('Informe um login válido.');
        if (cleanUsername === 'admin') throw new Error('O login "admin" é exclusivo do Master.');

        if (!isEdit) {
            const checkLimite = SaasGuard.verificarLimiteUsuarios({
                empresa: empDestino || { id: empresaId },
                usuariosDaEmpresa: todosUsuarios,
                editando: false
            });
            if (!checkLimite.permitido) {
                throw new Error(checkLimite.motivo);
            }
        }

        // Validação de senha (obrigatória na criação; opcional na edição)
        let hash = '';
        if (!isEdit || (password && password.trim() !== '')) {
            const check = AuthService.validarForcaSenha(password);
            if (!check.valido) throw new Error(check.mensagem);
            hash = await AuthService.hashPassword(password);
        } else {
            const existente = todosUsuarios.find(u => u.id === editDocId || u.username === editUsernameOrig);
            hash = existente?.passwordHash || '';
        }

        const canonicalDocId = `${empresaId}_${cleanUsername}`;
        if (!isEdit && db) {
            const dupCheck = await getDoc(doc(db, 'users', canonicalDocId));
            if (dupCheck.exists()) {
                throw new Error(`O usuário "${cleanUsername}" já existe nesta empresa.`);
            }
        } else if (isEdit && editUsernameOrig !== cleanUsername && db) {
            const dupCheck = await getDoc(doc(db, 'users', canonicalDocId));
            if (dupCheck.exists()) {
                throw new Error(`O usuário "${cleanUsername}" já existe nesta empresa.`);
            }
        }

        const userPayload = {
            id: editUserId || Date.now().toString(),
            nome,
            username: cleanUsername,
            passwordHash: hash,
            empresaId,
            empresaCodigo: empDestino?.codigo || empresaId,
            isMaster: false,
            permissoes,
            permissoesV2: true
        };

        if (db) {
            if (isEdit && editDocId && editDocId !== canonicalDocId) {
                await deleteDoc(doc(db, 'users', editDocId)).catch(() => {});
            }
            await setDoc(doc(db, 'users', canonicalDocId), userPayload);
            await sincronizarSubdocUsuariosEmpresa(empresaId, (lista) => {
                const filtered = lista.filter(u => u.id !== userPayload.id && (u.username || '').toLowerCase() !== (editUsernameOrig || cleanUsername));
                filtered.push(userPayload);
                return filtered;
            });
        }

        // Atualiza também localmente
        let locais = AuthService.getUsers();
        locais = locais.filter(u => u.id !== userPayload.id && !((u.empresaId || '') === empresaId && (u.username || '').toLowerCase() === (editUsernameOrig || cleanUsername)));
        locais.push(userPayload);
        AuthService.saveUsers(locais);

        if (window.UI) {
            window.UI.toast(
                isEdit ? `Usuário "${cleanUsername}" atualizado com sucesso!` : `Usuário "${cleanUsername}" adicionado com sucesso!`,
                'success'
            );
        }
        window.fecharModalUsuario();
        document.getElementById('formNovoUsuario').reset();
        await carregarDadosPlataforma();
    } catch (err) {
        console.error(err);
        if (erroBox) {
            erroBox.textContent = err.message || 'Erro ao salvar usuário.';
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
async function confirmarExclusaoUsuario(username, id, empresaId = '') {
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
        const cleanUser = (username || '').toLowerCase().trim();
        if (db && cleanUser) {
            if (id) await deleteDoc(doc(db, 'users', id)).catch(() => {});
            if (empresaId) await deleteDoc(doc(db, 'users', `${empresaId}_${cleanUser}`)).catch(() => {});
            await deleteDoc(doc(db, 'users', cleanUser)).catch(() => {});
            if (empresaId) {
                await sincronizarSubdocUsuariosEmpresa(empresaId, (lista) =>
                    lista.filter(u => (u.username || '').toLowerCase() !== cleanUser && u.id !== id)
                );
            }
        }
        let locais = AuthService.getUsers();
        locais = locais.filter(u => !((u.username || '').toLowerCase() === cleanUser && (!empresaId || u.empresaId === empresaId)) && u.id !== id);
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
    const elVenc = document.getElementById('empresaVencimento');
    if (elVenc) elVenc.value = SaasGuard.somarDiasISO(new Date().toISOString().slice(0, 10), 30);
    const elLim = document.getElementById('empresaLimiteUsuarios');
    if (elLim) elLim.value = String(PLANOS_SAAS.profissional.limiteUsuariosPadrao);
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

    const dadosAssin = SaasGuard.normalizarDadosAssinatura(emp);
    document.getElementById('editEmpresaIdOriginal').value = emp.id;
    document.getElementById('editEmpresaCodigoOriginal').value = emp.codigo || emp.id;
    document.getElementById('editEmpresaNome').value = emp.nome || '';
    document.getElementById('editEmpresaCodigo').value = emp.codigo || emp.id || '';
    document.getElementById('editEmpresaSegmento').value = emp.tipoNegocio || 'geral';
    document.getElementById('editEmpresaTelefone').value = emp.telefone || '';
    document.getElementById('editEmpresaPlano').value = dadosAssin.planoId;
    document.getElementById('editEmpresaLimiteUsuarios').value = String(dadosAssin.limiteUsuarios);
    document.getElementById('editEmpresaVencimento').value = dadosAssin.vencimentoMensalidade || '';
    document.getElementById('editEmpresaTolerancia').value = String(dadosAssin.diasTolerancia);
    document.getElementById('editEmpresaStatusAssinatura').value = dadosAssin.statusAssinatura;
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

window.selecionarPermissoesMaster = function(marcar = true) {
    document.querySelectorAll('input[name="permissoesUsuario"]').forEach(cb => {
        cb.checked = !!marcar;
    });
};

window.abrirModalUsuario = function() {
    const form = document.getElementById('formNovoUsuario');
    if (form) form.reset();
    document.getElementById('usuarioEditDocId').value = '';
    document.getElementById('usuarioEditId').value = '';
    document.getElementById('usuarioEditUsernameOriginal').value = '';
    document.getElementById('tituloModalUsuario').textContent = '👤 Incluir Novo Usuário para Empresa';
    const selEmp = document.getElementById('usuarioEmpresaDestino');
    if (selEmp) selEmp.disabled = false;
    const inpPass = document.getElementById('usuarioSenha');
    if (inpPass) inpPass.required = true;
    const dica = document.getElementById('usuarioSenhaDica');
    if (dica) dica.textContent = '*';
    const erroBox = document.getElementById('msgErroUsuario');
    if (erroBox) erroBox.style.display = 'none';

    // Por padrão, todas as funcionalidades iniciam liberadas para usuários criados pelo Master
    window.selecionarPermissoesMaster(true);

    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.classList.add('open');
};

function abrirModalEditarUsuario(docId) {
    const user = todosUsuarios.find(u => u.id === docId);
    if (!user) return;

    document.getElementById('usuarioEditDocId').value = user.id;
    document.getElementById('usuarioEditId').value = user.userId || user.id;
    document.getElementById('usuarioEditUsernameOriginal').value = user.username || '';
    document.getElementById('tituloModalUsuario').textContent = '✏️ Editar Usuário e Permissões';

    const selEmp = document.getElementById('usuarioEmpresaDestino');
    if (selEmp) {
        selEmp.value = user.empresaId || '';
        selEmp.disabled = true;
    }
    document.getElementById('usuarioNome').value = user.nome || '';
    document.getElementById('usuarioLogin').value = user.username || '';

    const inpPass = document.getElementById('usuarioSenha');
    if (inpPass) {
        inpPass.value = '';
        inpPass.required = false;
    }
    const dica = document.getElementById('usuarioSenhaDica');
    if (dica) dica.textContent = '(Opcional — deixe em branco para manter)';

    const efetivas = AuthService.getEffectivePermissions(user);
    document.querySelectorAll('input[name="permissoesUsuario"]').forEach(cb => {
        cb.checked = efetivas.includes(cb.value);
    });

    const erroBox = document.getElementById('msgErroUsuario');
    if (erroBox) erroBox.style.display = 'none';

    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.classList.add('open');
}

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

    // Auto-preenche sugestão de limite ao trocar o plano nos modais
    const selPlanoNovo = document.getElementById('empresaPlano');
    const inpLimNovo = document.getElementById('empresaLimiteUsuarios');
    if (selPlanoNovo && inpLimNovo) {
        selPlanoNovo.addEventListener('change', () => {
            const p = PLANOS_SAAS[selPlanoNovo.value];
            if (p) inpLimNovo.value = String(p.limiteUsuariosPadrao);
        });
    }

    const selPlanoEdit = document.getElementById('editEmpresaPlano');
    const inpLimEdit = document.getElementById('editEmpresaLimiteUsuarios');
    if (selPlanoEdit && inpLimEdit) {
        selPlanoEdit.addEventListener('change', () => {
            const p = PLANOS_SAAS[selPlanoEdit.value];
            if (p) inpLimEdit.value = String(p.limiteUsuariosPadrao);
        });
    }
});
