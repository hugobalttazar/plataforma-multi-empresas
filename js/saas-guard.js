// ==========================================================================
// SaasGuard: Planos, Assinaturas, Limite de Usuários, Bloqueio Seguro e Onboarding
// ==========================================================================

export const PLANOS_SAAS = {
    basico: {
        id: 'basico',
        nome: 'Básico',
        limiteUsuariosPadrao: 2,
        precoSugerido: 79.90
    },
    profissional: {
        id: 'profissional',
        nome: 'Profissional',
        limiteUsuariosPadrao: 5,
        precoSugerido: 149.90
    },
    multi_loja: {
        id: 'multi_loja',
        nome: 'Multi-Loja',
        limiteUsuariosPadrao: 20,
        precoSugerido: 299.90
    }
};

function obterHojeISO(referencia = new Date()) {
    const dt = referencia instanceof Date ? referencia : new Date(referencia);
    const ano = dt.getFullYear();
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const dia = String(dt.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function parseISODateUTC(iso) {
    if (!iso || typeof iso !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return null;
    const ano = Number(match[1]);
    const mes = Number(match[2]) - 1;
    const dia = Number(match[3]);
    return Date.UTC(ano, mes, dia);
}

export function formatarDataBRSaas(iso) {
    if (!iso || typeof iso !== 'string') return '-';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!match) return iso;
    return `${match[3]}/${match[2]}/${match[1]}`;
}

export function somarDiasISO(dataBaseISO, dias) {
    const baseMs = parseISODateUTC(dataBaseISO) || parseISODateUTC(obterHojeISO());
    const d = new Date(baseMs + (Number(dias) || 0) * 86400000);
    const ano = d.getUTCFullYear();
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(d.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

export function normalizarDadosAssinatura(empresa = {}) {
    const planoId = PLANOS_SAAS[empresa?.planoId] ? empresa.planoId : 'profissional';
    const plano = PLANOS_SAAS[planoId];
    const limiteRaw = Number(empresa?.limiteUsuarios);
    const limiteUsuarios = Number.isFinite(limiteRaw) && limiteRaw > 0
        ? Math.floor(limiteRaw)
        : plano.limiteUsuariosPadrao;

    const tolRaw = Number(empresa?.diasTolerancia);
    const diasTolerancia = Number.isFinite(tolRaw) && tolRaw >= 0
        ? Math.floor(tolRaw)
        : 5;

    const statusAssinatura = empresa?.statusAssinatura === 'suspenso' || empresa?.status === 'suspenso'
        ? 'suspenso'
        : 'ativo';

    const vencimentoMensalidade = typeof empresa?.vencimentoMensalidade === 'string'
        ? empresa.vencimentoMensalidade.trim().slice(0, 10)
        : '';

    return {
        planoId,
        planoNome: plano.nome,
        limiteUsuarios,
        vencimentoMensalidade,
        diasTolerancia,
        statusAssinatura
    };
}

export function avaliarAssinatura(empresa = {}, referencia = new Date()) {
    const info = normalizarDadosAssinatura(empresa);
    const hojeISO = obterHojeISO(referencia);
    const hojeMs = parseISODateUTC(hojeISO);
    const vencMs = parseISODateUTC(info.vencimentoMensalidade);

    let diasRestantes = null;
    let diasAtraso = 0;

    if (vencMs !== null && hojeMs !== null) {
        const diffDias = Math.round((vencMs - hojeMs) / 86400000);
        diasRestantes = diffDias;
        if (diffDias < 0) {
            diasAtraso = Math.abs(diffDias);
        }
    }

    if (info.statusAssinatura === 'suspenso') {
        return {
            ...info,
            situacao: 'suspenso',
            labelSituacao: 'Suspenso',
            bloqueadoNovosCadastros: true,
            emTolerancia: false,
            diasRestantes,
            diasAtraso,
            exibirAlerta: true,
            nivelAlerta: 'danger',
            mensagemAlerta: 'Assinatura suspensa. Novos cadastros e aberturas de O.S. estão bloqueados. Você ainda pode consultar dados e encerrar atendimentos abertos.'
        };
    }

    if (vencMs !== null && diasAtraso > info.diasTolerancia) {
        return {
            ...info,
            situacao: 'suspenso',
            labelSituacao: 'Vencida / Bloqueada',
            bloqueadoNovosCadastros: true,
            emTolerancia: false,
            diasRestantes,
            diasAtraso,
            exibirAlerta: true,
            nivelAlerta: 'danger',
            mensagemAlerta: `Mensalidade vencida há ${diasAtraso} dia(s) (tolerância de ${info.diasTolerancia} dias encerrada em ${formatarDataBRSaas(info.vencimentoMensalidade)}). Novos cadastros estão bloqueados até a renovação.`
        };
    }

    if (vencMs !== null && diasAtraso > 0 && diasAtraso <= info.diasTolerancia) {
        const restantesTol = Math.max(0, info.diasTolerancia - diasAtraso);
        return {
            ...info,
            situacao: 'tolerancia',
            labelSituacao: 'Em Tolerância',
            bloqueadoNovosCadastros: false,
            emTolerancia: true,
            diasRestantes,
            diasAtraso,
            exibirAlerta: true,
            nivelAlerta: 'warning',
            mensagemAlerta: `Mensalidade venceu em ${formatarDataBRSaas(info.vencimentoMensalidade)}. Restam ${restantesTol} dia(s) de tolerância antes do bloqueio de novos cadastros.`
        };
    }

    if (vencMs !== null && diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 5) {
        const textoDia = diasRestantes === 0
            ? 'vence hoje'
            : (diasRestantes === 1 ? 'vence amanhã' : `vence em ${diasRestantes} dias`);
        return {
            ...info,
            situacao: 'vencendo',
            labelSituacao: 'Vencimento Próximo',
            bloqueadoNovosCadastros: false,
            emTolerancia: false,
            diasRestantes,
            diasAtraso: 0,
            exibirAlerta: true,
            nivelAlerta: 'info',
            mensagemAlerta: `Lembrete de assinatura (${info.planoNome}): sua mensalidade ${textoDia} (${formatarDataBRSaas(info.vencimentoMensalidade)}).`
        };
    }

    return {
        ...info,
        situacao: 'ativo',
        labelSituacao: 'Ativo',
        bloqueadoNovosCadastros: false,
        emTolerancia: false,
        diasRestantes,
        diasAtraso: 0,
        exibirAlerta: false,
        nivelAlerta: 'success',
        mensagemAlerta: ''
    };
}

export function verificarPermissaoNovoCadastro({ empresa, user, tipoOperacao = 'novo registro', referencia = new Date() } = {}) {
    if (user && user.isMaster) {
        return {
            permitido: true,
            motivo: '',
            avaliacao: avaliarAssinatura(empresa || {}, referencia)
        };
    }

    const avaliacao = avaliarAssinatura(empresa || {}, referencia);
    if (avaliacao.bloqueadoNovosCadastros) {
        return {
            permitido: false,
            motivo: `Ação bloqueada (${tipoOperacao}): ${avaliacao.mensagemAlerta}`,
            avaliacao
        };
    }

    return {
        permitido: true,
        motivo: '',
        avaliacao
    };
}

export function verificarLimiteUsuarios({ empresa, usuariosDaEmpresa = [], editando = false } = {}) {
    const info = normalizarDadosAssinatura(empresa || {});
    const empresaId = empresa?.id || empresa?.codigo || '';
    const lista = Array.isArray(usuariosDaEmpresa)
        ? usuariosDaEmpresa.filter((u) => {
            if (!u || u.isMaster || (u.username || '').toLowerCase() === 'admin') return false;
            if (!empresaId) return true;
            return !u.empresaId || u.empresaId === empresaId || u.empresaCodigo === empresaId;
        })
        : [];

    const qtdAtual = lista.length;
    if (!editando && qtdAtual >= info.limiteUsuarios) {
        return {
            permitido: false,
            qtdAtual,
            limite: info.limiteUsuarios,
            planoNome: info.planoNome,
            motivo: `Limite do plano ${info.planoNome} atingido (${qtdAtual}/${info.limiteUsuarios} usuários). Atualize o plano ou aumente o limite no Painel Master.`
        };
    }

    return {
        permitido: true,
        qtdAtual,
        limite: info.limiteUsuarios,
        planoNome: info.planoNome,
        motivo: ''
    };
}

export function obterEmpresaAtivaRuntime() {
    if (typeof window === 'undefined') return null;
    try {
        if (window.EmpresaService && typeof window.EmpresaService.getEmpresaAtiva === 'function') {
            return window.EmpresaService.getEmpresaAtiva();
        }
        const raw = localStorage.getItem('empresas_cadastradas');
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
                const user = window.AuthService?.getCurrentUser?.();
                const activeId = user?.empresaId || localStorage.getItem('master_active_empresaId');
                return list.find((e) => e.id === activeId || e.codigo === activeId) || list[0];
            }
        }
    } catch (e) {}
    return null;
}

export function bloquearSeSuspenso(tipoOperacao = 'novo cadastro') {
    if (typeof window === 'undefined') return true;
    const user = window.AuthService?.getCurrentUser?.() || null;
    const empresa = obterEmpresaAtivaRuntime();
    if (!empresa || !empresa.id) return true;

    const res = verificarPermissaoNovoCadastro({ empresa, user, tipoOperacao });
    if (!res.permitido) {
        if (window.UI && typeof window.UI.toast === 'function') {
            window.UI.toast(res.motivo, 'error', 5500);
        } else if (window.UI && typeof window.UI.alert === 'function') {
            window.UI.alert(res.motivo, 'Assinatura Suspensa');
        }
        renderizarBannerAssinatura();
        return false;
    }
    return true;
}

export function renderizarBannerAssinatura() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const p = window.location.pathname || '';
    if (p.includes('login') || p.includes('admin') || p.includes('orcamento') || p.includes('agenda-publica') || p.includes('painel-tv')) {
        return;
    }

    const empresa = obterEmpresaAtivaRuntime();
    const user = window.AuthService?.getCurrentUser?.() || null;
    if (!empresa || !empresa.id) return;

    const existing = document.getElementById('saasAssinaturaBanner');
    const avaliacao = avaliarAssinatura(empresa);

    if (!avaliacao.exibirAlerta) {
        if (existing) existing.remove();
        return;
    }

    const container = document.querySelector('main.container') || document.querySelector('main');
    if (!container) return;

    const palette = avaliacao.nivelAlerta === 'danger'
        ? { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '⛔' }
        : (avaliacao.nivelAlerta === 'warning'
            ? { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '⚠️' }
            : { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '📅' });

    const el = existing || document.createElement('div');
    el.id = 'saasAssinaturaBanner';
    el.style.cssText = `margin-bottom: 16px; padding: 12px 16px; border-radius: 10px; border: 1px solid ${palette.border}; background: ${palette.bg}; color: ${palette.text}; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; font-size: 0.88rem;`;

    const masterNote = user && user.isMaster
        ? ' <strong style="text-decoration:underline;">(Modo Master: acesso administrativo liberado)</strong>'
        : '';

    const escapeFn = typeof window.escapeHTML === 'function'
        ? window.escapeHTML
        : (s) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    el.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:220px;">
            <span style="font-size:1.2rem;">${palette.icon}</span>
            <div>
                <strong style="display:block;">Plano ${escapeFn(avaliacao.planoNome)} • ${escapeFn(avaliacao.labelSituacao)}</strong>
                <span>${escapeFn(avaliacao.mensagemAlerta)}${masterNote}</span>
            </div>
        </div>
        ${user && user.isMaster ? '<a href="admin.html" class="btn btn-sm" style="background:#0f172a; color:#fff; white-space:nowrap;">Gerenciar no Master</a>' : ''}
    `;

    if (!existing) {
        container.insertBefore(el, container.firstChild);
    }
}

export function calcularProgressoOnboarding({ config, servicos, clientes, pedidos, agendamentos } = {}) {
    const cfgOk = Boolean(config && typeof config.nomeEstabelecimento === 'string' && config.nomeEstabelecimento.trim().length >= 2);
    const srvOk = Array.isArray(servicos) && servicos.length > 0;
    const cliOk = Array.isArray(clientes) && clientes.length > 0;
    const movOk = (Array.isArray(pedidos) && pedidos.length > 0) || (Array.isArray(agendamentos) && agendamentos.length > 0);

    const etapas = [
        {
            id: 'config_negocio',
            titulo: 'Configurar dados do estabelecimento',
            descricao: 'Defina nome, segmento, telefone e dias de atendimento.',
            concluida: cfgOk,
            href: 'configuracoes.html?aba=negocio',
            acaoTexto: 'Configurar'
        },
        {
            id: 'servicos',
            titulo: 'Cadastrar catálogo de serviços',
            descricao: 'Adicione ao menos 1 serviço com valor para usar nas O.S. e na agenda.',
            concluida: srvOk,
            href: 'servicos.html',
            acaoTexto: 'Cadastrar Serviços'
        },
        {
            id: 'clientes',
            titulo: 'Cadastrar primeiro cliente',
            descricao: 'Registre o contato e os dados de atendimento do cliente.',
            concluida: cliOk,
            href: 'clientes.html',
            acaoTexto: 'Cadastrar Cliente'
        },
        {
            id: 'movimentacao',
            titulo: 'Abrir primeira O.S., Orçamento ou Agendamento',
            descricao: 'Inicie um atendimento no pátio, orçamento digital ou reserva de horário.',
            concluida: movOk,
            href: 'pedidos.html',
            acaoTexto: 'Abrir O.S.'
        }
    ];

    const concluidas = etapas.filter((e) => e.concluida).length;
    const total = etapas.length;
    const percentual = Math.round((concluidas / total) * 100);

    return {
        etapas,
        concluidas,
        total,
        percentual,
        completo: concluidas === total
    };
}

export function isOnboardingDispensado(empresaId) {
    if (typeof localStorage === 'undefined') return false;
    const key = `onboarding_dispensado_${empresaId || 'default'}`;
    return localStorage.getItem(key) === 'true';
}

export function dispensarOnboarding(empresaId) {
    if (typeof localStorage === 'undefined') return;
    const key = `onboarding_dispensado_${empresaId || 'default'}`;
    localStorage.setItem(key, 'true');
}

const SaasGuard = {
    PLANOS_SAAS,
    normalizarDadosAssinatura,
    avaliarAssinatura,
    verificarPermissaoNovoCadastro,
    verificarLimiteUsuarios,
    bloquearSeSuspenso,
    renderizarBannerAssinatura,
    calcularProgressoOnboarding,
    isOnboardingDispensado,
    dispensarOnboarding,
    formatarDataBRSaas,
    somarDiasISO
};

if (typeof window !== 'undefined') {
    window.SaasGuard = SaasGuard;
    window.addEventListener('cloudDataChanged', (e) => {
        if (e && (e.detail === 'config_negocio' || e.detail === 'usuarios')) {
            renderizarBannerAssinatura();
        }
    });
}

export default SaasGuard;
