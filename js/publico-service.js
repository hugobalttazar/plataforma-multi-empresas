// ==========================================================================
// PublicoService: Sanitização e Sincronização Segura dos Módulos Públicos
// (Orçamento Digital Aprovável, Autoagendamento Público e Painel TV)
// ==========================================================================

import {
    db,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    collection,
    query,
    where,
    onSnapshot
} from './firebase-init.js';

export function gerarTokenSeguro(bytes = 18) {
    const arr = new Uint8Array(bytes);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(arr);
    } else {
        for (let i = 0; i < bytes; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function extrairPrimeiroNome(nomeCompleto = '') {
    const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
    return partes[0] || 'Cliente';
}

function limparTexto(str, maxLen = 120) {
    return String(str || '').trim().slice(0, maxLen);
}

export function resolverUrlPublica(caminhoRelativo = '', baseHref = null) {
    const cleanPath = String(caminhoRelativo || '').replace(/^\/+/, '');
    const base = baseHref || (typeof window !== 'undefined' && window.location ? window.location.href : '');
    if (!base) return cleanPath;
    try {
        return new URL(cleanPath, base).href;
    } catch (e) {
        const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
        return origin ? `${origin}/${cleanPath}` : cleanPath;
    }
}

function isSegmentoAutoConfig(config = {}, empresa = {}) {
    const tipo = config?.tipoNegocio || empresa?.tipoNegocio || '';
    return !tipo || tipo === 'lava_jato' || tipo === 'mecanica';
}

function sanitizarUrlFoto(foto) {
    if (typeof foto !== 'string') return '';
    const trimmed = foto.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:image/') && trimmed.length <= 340000) {
        return trimmed;
    }
    return '';
}

function formatarVistoriaResumo(vistoria) {
    if (!vistoria || typeof vistoria !== 'object') return 'Sem apontamentos de vistoria registrados.';
    const itens = [];
    itens.push(vistoria.pertences ? 'Pertences conferidos' : 'Sem pertences declarados');
    itens.push(vistoria.avarias ? 'Com marcas/avarias prévias' : 'Sem avarias prévias apontadas');
    itens.push(vistoria.vidros ? 'Vidros/travas intactos' : 'Ressalva em vidros/travas');
    itens.push(vistoria.estepe ? 'Estepe/ferramentas presentes' : 'Sem estepe/ferramentas');
    if (vistoria.observacoes && String(vistoria.observacoes).trim()) {
        itens.push(`Obs: ${String(vistoria.observacoes).trim()}`);
    }
    return itens.join(' • ').slice(0, 580);
}

export function sanitizarOrcamentoParaPublico({
    pedido = {},
    empresa = {},
    config = {},
    vistoria = null,
    servicosCatalogo = [],
    token = ''
} = {}) {
    const finalToken = token && token.length >= 16 ? token : gerarTokenSeguro(18);
    const isAuto = isSegmentoAutoConfig(config, empresa);
    const empresaId = limparTexto(empresa?.id || empresa?.codigo || config?.codigoEmpresa || 'danilodetailer', 80);
    const empresaNome = limparTexto(config?.nomeEstabelecimento || empresa?.nome || 'Estabelecimento', 120);
    const tipoNegocio = limparTexto(config?.tipoNegocio || empresa?.tipoNegocio || 'geral', 40);

    let servicosDetalhe = [];
    if (Array.isArray(pedido.servicosDetalhe) && pedido.servicosDetalhe.length > 0) {
        servicosDetalhe = pedido.servicosDetalhe
            .map((s) => ({
                nome: limparTexto(s?.nome || '', 80),
                preco: Math.max(0, Number(s?.preco || 0) || 0)
            }))
            .filter((s) => s.nome)
            .slice(0, 50);
    } else if (pedido.servicos) {
        const nomes = String(pedido.servicos).split(',').map((x) => x.trim()).filter(Boolean);
        servicosDetalhe = nomes.slice(0, 50).map((nome) => {
            const match = Array.isArray(servicosCatalogo)
                ? servicosCatalogo.find((s) => s && s.nome && s.nome.trim().toLowerCase() === nome.toLowerCase())
                : null;
            return {
                nome: limparTexto(nome, 80),
                preco: match ? Math.max(0, Number(match.preco || 0) || 0) : 0
            };
        });
    }

    const produtos = Array.isArray(pedido.produtosVendidos)
        ? pedido.produtosVendidos.slice(0, 50).map((p) => ({
            nome: limparTexto(p?.nome || 'Produto', 80),
            quantidade: Math.max(1, Number(p?.quantidade || 1) || 1),
            precoUnitario: Math.max(0, Number(p?.precoUnitario || 0) || 0)
        }))
        : [];

    const placaLimpa = limparTexto(pedido.placa || '', 20).toUpperCase();
    const modeloLimpo = limparTexto(pedido.modelo || pedido.itemDescricao || '', 60);
    const identificador = isAuto
        ? (placaLimpa ? `${placaLimpa}${modeloLimpo ? ' • ' + modeloLimpo : ''}` : (modeloLimpo || 'Veículo'))
        : (limparTexto(pedido.itemDescricao || pedido.modelo || 'Atendimento / Serviço', 100));

    const agoraISO = new Date().toISOString();

    return {
        token: finalToken,
        empresaId,
        empresaNome,
        empresaTelefone: limparTexto(config?.telefone || empresa?.telefone || '', 30),
        icone: limparTexto(config?.iconeCustom || empresa?.icone || '🛠️', 12),
        tipoNegocio,
        pedidoId: limparTexto(pedido.id || `os_${Date.now()}`, 80),
        clientePrimeiroNome: limparTexto(extrairPrimeiroNome(pedido.cliente), 60),
        identificador: limparTexto(identificador, 120),
        placaMask: placaLimpa,
        modelo: modeloLimpo,
        dataEntrada: limparTexto(pedido.data || '', 20),
        servicos: servicosDetalhe,
        produtos,
        valorTotal: Math.max(0, Math.round((Number(pedido.valor || 0) || 0) * 100) / 100),
        vistoriaResumo: formatarVistoriaResumo(vistoria),
        fotoUrl: sanitizarUrlFoto(pedido.foto || vistoria?.foto || ''),
        status: 'pendente',
        comentarioCliente: '',
        criadoEm: agoraISO,
        atualizadoEm: agoraISO
    };
}

export function registrarEventoOrcamentoHistorico(pedido, evento = {}) {
    if (!pedido || typeof pedido !== 'object') return { lista: [], inserido: false };
    if (!Array.isArray(pedido.orcamentoHistorico)) {
        pedido.orcamentoHistorico = [];
    }

    const tipo = limparTexto(evento.tipo || 'registro', 40);
    const dataHora = limparTexto(evento.dataHora || new Date().toISOString(), 40);
    const autor = limparTexto(evento.autor || 'Sistema', 80);
    const titulo = limparTexto(evento.titulo || 'Atualização do orçamento', 120);
    const comentario = limparTexto(evento.comentario || '', 600);
    const ip = limparTexto(evento.ip || '', 64);
    const token = limparTexto(evento.token || '', 96);
    const valorAnterior = (evento.valorAnterior !== null && evento.valorAnterior !== undefined && !Number.isNaN(Number(evento.valorAnterior)))
        ? Number(evento.valorAnterior)
        : null;
    const valorNovo = (evento.valorNovo !== null && evento.valorNovo !== undefined && !Number.isNaN(Number(evento.valorNovo)))
        ? Number(evento.valorNovo)
        : null;
    const alteracoes = Array.isArray(evento.alteracoes)
        ? evento.alteracoes.map((a) => limparTexto(a, 240)).filter(Boolean).slice(0, 20)
        : [];

    const existente = pedido.orcamentoHistorico.find((h) =>
        h &&
        h.tipo === tipo &&
        String(h.token || '') === token &&
        String(h.comentario || '') === comentario &&
        (String(h.dataHora || '') === dataHora || (token && (tipo === 'cliente_ajuste' || tipo === 'cliente_aprovado')))
    );

    if (existente) {
        let atualizado = false;
        if (ip && (!existente.ip || existente.ip === 'Não identificado') && existente.ip !== ip) {
            existente.ip = ip;
            atualizado = true;
        }
        if (dataHora && !existente.dataHora) {
            existente.dataHora = dataHora;
            atualizado = true;
        }
        return { lista: pedido.orcamentoHistorico, inserido: atualizado };
    }

    pedido.orcamentoHistorico.push({
        id: limparTexto(evento.id || `oh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 60),
        tipo,
        dataHora,
        autor,
        titulo,
        comentario,
        ip,
        token,
        valorAnterior,
        valorNovo,
        alteracoes
    });

    if (pedido.orcamentoHistorico.length > 200) {
        pedido.orcamentoHistorico = pedido.orcamentoHistorico.slice(-200);
    }

    return { lista: pedido.orcamentoHistorico, inserido: true };
}

export function garantirHistoricoInicialOrcamento(pedido) {
    if (!pedido || typeof pedido !== 'object') return false;
    let mudou = false;

    if (!Array.isArray(pedido.orcamentoHistorico)) {
        pedido.orcamentoHistorico = [];
        mudou = true;
    }

    if (pedido.orcamentoHistorico.length === 0) {
        let dataCriacao = pedido.criadoEm || '';
        if (!dataCriacao && pedido.data) {
            const horaBase = /^\d{2}:\d{2}/.test(String(pedido.horaEntrada || '')) ? String(pedido.horaEntrada).slice(0, 5) : '00:00';
            dataCriacao = `${String(pedido.data).slice(0, 10)}T${horaBase}:00`;
        }
        const itensResumo = [];
        if (pedido.servicos) itensResumo.push(`Serviços: ${pedido.servicos}`);
        if (Array.isArray(pedido.produtosVendidos) && pedido.produtosVendidos.length > 0) {
            itensResumo.push(`Produtos: ${pedido.produtosVendidos.map((pv) => `${pv.quantidade || 1}x ${pv.nome}`).join(', ')}`);
        }
        registrarEventoOrcamentoHistorico(pedido, {
            tipo: 'criado',
            dataHora: dataCriacao || new Date().toISOString(),
            autor: pedido.operadorNome || 'Atendimento',
            titulo: 'Orçamento criado no sistema',
            alteracoes: itensResumo,
            valorNovo: Number(pedido.valor || 0) || 0
        });
        mudou = true;
    }

    if (pedido.orcamentoToken && !pedido.orcamentoHistorico.some((h) => h && h.tipo === 'link_gerado' && h.token === pedido.orcamentoToken)) {
        registrarEventoOrcamentoHistorico(pedido, {
            tipo: 'link_gerado',
            dataHora: pedido.orcamentoRespondidoEm || new Date().toISOString(),
            autor: 'Sistema',
            titulo: 'Link público de aprovação gerado',
            token: pedido.orcamentoToken,
            valorNovo: Number(pedido.valor || 0) || 0
        });
        mudou = true;
    }

    if (pedido.orcamentoComentarioCliente) {
        const resAj = registrarEventoOrcamentoHistorico(pedido, {
            tipo: 'cliente_ajuste',
            dataHora: pedido.orcamentoRespondidoEm || new Date().toISOString(),
            autor: 'Cliente (via Link)',
            titulo: 'Cliente solicitou ajuste pelo link',
            comentario: pedido.orcamentoComentarioCliente,
            ip: pedido.orcamentoUltimoIp || pedido.orcamentoAprovadoIp || '',
            token: pedido.orcamentoToken || ''
        });
        if (resAj.inserido) mudou = true;
    }

    if (pedido.orcamentoStatus === 'aprovado') {
        const jaTemAprov = pedido.orcamentoHistorico.some((h) => h && (h.tipo === 'cliente_aprovado' || h.tipo === 'aprovado_manual'));
        if (!jaTemAprov) {
            const viaLink = Boolean(pedido.aprovadoViaLinkEm || pedido.orcamentoAprovadoIp);
            registrarEventoOrcamentoHistorico(pedido, {
                tipo: viaLink ? 'cliente_aprovado' : 'aprovado_manual',
                dataHora: pedido.orcamentoAprovadoEm || pedido.aprovadoViaLinkEm || pedido.orcamentoRespondidoEm || new Date().toISOString(),
                autor: viaLink ? 'Cliente (via Link)' : 'Atendimento',
                titulo: viaLink ? 'Orçamento aprovado pelo cliente' : 'Orçamento aprovado manualmente',
                ip: viaLink ? (pedido.orcamentoAprovadoIp || pedido.orcamentoUltimoIp || 'Não identificado') : '',
                token: pedido.orcamentoToken || '',
                valorNovo: Number(pedido.valor || 0) || 0
            });
            mudou = true;
        }
    }

    return mudou;
}

export function resolverChavePublicaEmpresa(empresa = {}, config = {}) {
    const bruto = empresa?.codigo || empresa?.id || config?.codigoEmpresa || 'danilodetailer';
    const limpo = String(bruto).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (limpo === 'empresa_danilo') return 'danilodetailer';
    return limpo.length >= 2 ? limpo : 'danilodetailer';
}

function obterTimestampAberturaPedido(pedido, fallbackIndex = 0) {
    if (!pedido || typeof pedido !== 'object') return fallbackIndex;
    if (pedido.criadoEm) {
        const tsCriado = Date.parse(pedido.criadoEm);
        if (!Number.isNaN(tsCriado)) return tsCriado;
    }
    if (pedido.data) {
        const dataStr = String(pedido.data).trim().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
            const horaStr = /^\d{2}:\d{2}/.test(String(pedido.horaEntrada || '').trim())
                ? String(pedido.horaEntrada).trim().slice(0, 5)
                : '00:00';
            const tsData = Date.parse(`${dataStr}T${horaStr}:00`);
            if (!Number.isNaN(tsData)) return tsData;
        }
    }
    const idMatch = /(\d{10,13})/.exec(String(pedido.id || ''));
    if (idMatch) {
        const num = Number(idMatch[1]);
        if (Number.isFinite(num)) return num < 1e12 ? num * 1000 : num;
    }
    return fallbackIndex;
}

export function sanitizarPainelTv({ pedidos = [], empresa = {}, config = {}, tema = null } = {}) {
    const isAuto = isSegmentoAutoConfig(config, empresa);
    const empresaId = resolverChavePublicaEmpresa(empresa, config);
    const empresaNome = limparTexto(config?.nomeEstabelecimento, 120)
        || limparTexto(empresa?.nome, 120)
        || 'Estabelecimento';
    const tipoNegocio = limparTexto(config?.tipoNegocio, 40)
        || limparTexto(empresa?.tipoNegocio, 40)
        || 'geral';
    const icone = limparTexto(config?.iconeCustom, 12)
        || limparTexto(empresa?.icone, 12)
        || '🛠️';

    let temaResolvido = 'light';
    if (tema === 'dark' || tema === 'light') {
        temaResolvido = tema;
    } else if (typeof window !== 'undefined') {
        const themeAtual = window.ThemeService?.getTheme?.()
            || (typeof localStorage !== 'undefined' ? localStorage.getItem('app_theme') : '')
            || document?.documentElement?.getAttribute?.('data-theme');
        temaResolvido = themeAtual === 'dark' ? 'dark' : 'light';
    }

    const abertos = Array.isArray(pedidos)
        ? pedidos
            .filter((p) => p && (p.status === 'aberto' || (!p.status && !p.formaPagamento)))
            .map((p, idx) => ({ p, idx, ts: obterTimestampAberturaPedido(p, idx) }))
            .sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.idx - b.idx))
            .map((entry) => entry.p)
        : [];

    const itens = abertos.slice(0, 80).map((p) => {
        const placa = limparTexto(p.placa || '', 20).toUpperCase();
        const modelo = limparTexto(p.modelo || '', 50);
        const itemDesc = limparTexto(p.itemDescricao || p.modelo || 'Atendimento', 60);
        const primeiroNome = extrairPrimeiroNome(p.cliente);

        const identificador = isAuto
            ? (placa || 'EM ATEND.')
            : `${primeiroNome} • ${itemDesc}`.slice(0, 80);

        const subtitulo = isAuto
            ? (modelo || limparTexto(p.servicos || 'Em serviço', 60))
            : limparTexto(p.servicos || 'Em atendimento', 60);

        return {
            id: limparTexto(p.id || '', 60),
            identificador,
            subtitulo,
            statusTV: p.statusTV === 'pronto' ? 'pronto' : 'em_servico',
            horaEntrada: limparTexto(p.horaEntrada || '', 10)
        };
    });

    return {
        empresaId,
        empresaNome,
        icone,
        tipoNegocio,
        segmentoAutomotivo: Boolean(isAuto),
        itens,
        tema: temaResolvido,
        atualizadoEm: new Date().toISOString()
    };
}

export function sanitizarAgendaConfigParaPublico({
    empresa = {},
    config = {},
    servicos = [],
    agendamentos = []
} = {}) {
    const isAuto = isSegmentoAutoConfig(config, empresa);
    const empresaId = limparTexto(empresa?.id || empresa?.codigo || config?.codigoEmpresa || 'danilodetailer', 80);
    const empresaNome = limparTexto(config?.nomeEstabelecimento || empresa?.nome || 'Estabelecimento', 120);
    const tipoNegocio = limparTexto(config?.tipoNegocio || empresa?.tipoNegocio || 'geral', 40);

    const diasTrabalhoSemana = Array.isArray(config?.diasTrabalhoSemana) && config.diasTrabalhoSemana.length > 0
        ? config.diasTrabalhoSemana.map(Number).filter((n) => n >= 0 && n <= 6).slice(0, 7)
        : [1, 2, 3, 4, 5, 6];

    const servicosSanitizados = (Array.isArray(servicos) ? servicos : []).slice(0, 150).map((s) => ({
        id: limparTexto(s?.id || s?.nome || '', 60),
        nome: limparTexto(s?.nome || 'Serviço', 80),
        preco: Math.max(0, Number(s?.preco || 0) || 0),
        duracao: Math.max(15, Number(s?.duracaoMinutos || s?.duracao || 60) || 60)
    }));

    const hoje = new Date().toISOString().slice(0, 10);
    const ocupadosSet = new Set();
    (Array.isArray(agendamentos) ? agendamentos : []).forEach((ag) => {
        if (!ag || (ag.status !== 'agendado' && ag.status !== 'em_andamento')) return;
        if (ag.data && ag.data >= hoje && ag.hora) {
            ocupadosSet.add(`${String(ag.data).slice(0, 10)}|${String(ag.hora).slice(0, 5)}`);
        }
    });

    return {
        empresaId,
        empresaNome,
        icone: limparTexto(config?.iconeCustom || empresa?.icone || '🛠️', 12),
        telefone: limparTexto(config?.telefone || empresa?.telefone || '', 30),
        tipoNegocio,
        segmentoAutomotivo: Boolean(isAuto),
        diasTrabalhoSemana,
        horarioInicio: limparTexto(config?.horarioInicio || '08:00', 5),
        horarioFim: limparTexto(config?.horarioFim || '18:00', 5),
        intervaloMinutos: Math.max(15, Number(config?.intervaloMinutos || 30) || 30),
        servicos: servicosSanitizados,
        horariosOcupados: Array.from(ocupadosSet).slice(0, 400),
        atualizadoEm: new Date().toISOString()
    };
}

export function gerarSlotsDisponiveis({ configPublica = {}, dataISO = '', referenciaAgora = new Date() } = {}) {
    if (!dataISO || !/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
        return { diaAtivo: false, motivo: 'Data inválida.', slots: [] };
    }

    const dt = new Date(`${dataISO}T12:00:00`);
    const diaSemana = dt.getDay();
    const diasPermitidos = Array.isArray(configPublica.diasTrabalhoSemana) && configPublica.diasTrabalhoSemana.length > 0
        ? configPublica.diasTrabalhoSemana.map(Number)
        : [1, 2, 3, 4, 5, 6];

    if (!diasPermitidos.includes(diaSemana)) {
        return {
            diaAtivo: false,
            motivo: 'O estabelecimento não atende neste dia da semana. Escolha outra data.',
            slots: []
        };
    }

    const parseMinutos = (hhmm, padrao) => {
        const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
        if (!m) return padrao;
        return Number(m[1]) * 60 + Number(m[2]);
    };

    const inicioMin = parseMinutos(configPublica.horarioInicio, 8 * 60);
    const fimMin = parseMinutos(configPublica.horarioFim, 18 * 60);
    const passo = Math.max(15, Number(configPublica.intervaloMinutos || 30) || 30);
    const ocupados = new Set(Array.isArray(configPublica.horariosOcupados) ? configPublica.horariosOcupados : []);

    const hojeISO = `${referenciaAgora.getFullYear()}-${String(referenciaAgora.getMonth() + 1).padStart(2, '0')}-${String(referenciaAgora.getDate()).padStart(2, '0')}`;
    const agoraMin = referenciaAgora.getHours() * 60 + referenciaAgora.getMinutes();

    const slots = [];
    for (let min = inicioMin; min < fimMin; min += passo) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        const horaStr = `${hh}:${mm}`;
        const ocupado = ocupados.has(`${dataISO}|${horaStr}`);
        const passado = (dataISO < hojeISO) || (dataISO === hojeISO && min <= agoraMin + 15);
        slots.push({
            hora: horaStr,
            disponivel: !ocupado && !passado,
            motivoIndisponivel: ocupado ? 'ocupado' : (passado ? 'passado' : '')
        });
    }

    return {
        diaAtivo: true,
        motivo: '',
        slots
    };
}

function getContextoRuntimeTenant() {
    if (typeof window === 'undefined') {
        return { empresa: { id: 'danilodetailer', codigo: 'danilodetailer' }, config: {} };
    }
    const config = window.BrandService?.getConfig?.() || {};
    let empresa = window.EmpresaService?.getEmpresaAtiva?.();
    const user = window.AuthService?.getCurrentUser?.();
    const fallbackId = user?.empresaCodigo || user?.empresaId || localStorage.getItem('master_active_empresaId') || config?.codigoEmpresa || 'danilodetailer';

    if (!empresa || (!empresa.id && !empresa.codigo)) {
        empresa = {
            id: fallbackId,
            codigo: fallbackId,
            nome: config.nomeEstabelecimento || fallbackId,
            tipoNegocio: config.tipoNegocio || 'geral',
            icone: config.iconeCustom || '🛠️'
        };
    } else if (!empresa.codigo) {
        empresa = { ...empresa, codigo: empresa.id };
    }
    return { empresa, config };
}

function getVistoriaPedidoCompat(pedidoId) {
    if (typeof window === 'undefined') return null;
    try {
        if (window.VistoriaService && typeof window.VistoriaService.getVistoriaPorPedidoId === 'function') {
            const v1 = window.VistoriaService.getVistoriaPorPedidoId(pedidoId);
            if (v1) return v1;
        }
        const raw2 = JSON.parse(localStorage.getItem('vistorias_pedidos') || '{}');
        if (raw2 && raw2[pedidoId]) return raw2[pedidoId];
    } catch (e) {}
    return null;
}

export async function publicarOrcamentoPublico(pedido, opts = {}) {
    if (!db || !pedido) {
        throw new Error('Banco de dados indisponível para gerar o link do orçamento.');
    }
    const { empresa, config } = getContextoRuntimeTenant();
    const servicosCatalogo = typeof localStorage !== 'undefined' ? (JSON.parse(localStorage.getItem('servicos')) || []) : [];
    const vistoria = opts.vistoria || getVistoriaPedidoCompat(pedido.id);

    // Sempre gera um novo token quando reenviado para manter estado terminal imutável após resposta do cliente
    const token = gerarTokenSeguro(18);
    const payload = sanitizarOrcamentoParaPublico({
        pedido,
        empresa,
        config,
        vistoria,
        servicosCatalogo,
        token
    });

    await setDoc(doc(db, 'orcamentos_publicos', token), payload);

    const url = resolverUrlPublica(`orcamento.html?token=${encodeURIComponent(token)}`);
    return { token, url, payload };
}

const _unsubsOrcamentos = new Map();

export function iniciarSincronizacaoOrcamentos(onSyncPedido) {
    if (!db || typeof localStorage === 'undefined') return () => {};
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    const tokensAtivos = new Set();

    const processarDoc = (token, data) => {
        if (!data || !data.pedidoId) return;
        const lista = JSON.parse(localStorage.getItem('pedidos')) || [];
        const idx = lista.findIndex((p) => String(p.id) === String(data.pedidoId) || p.orcamentoToken === token);
        if (idx === -1) return;

        const ped = lista[idx];
        let alterou = garantirHistoricoInicialOrcamento(ped);

        const statusAnt = ped.orcamentoStatus || 'pendente';
        const comentAnt = ped.orcamentoComentarioCliente || '';
        const ipRecebido = limparTexto(data.clienteIp || '', 64);
        const respEm = data.respondidoEm || data.atualizadoEm || new Date().toISOString();
        const mudouStatus = Boolean(data.status && data.status !== statusAnt);
        const mudouComent = (data.comentarioCliente || '') !== comentAnt;
        const mudouIp = Boolean(ipRecebido && ipRecebido !== (ped.orcamentoUltimoIp || ''));

        if (data.status === 'aprovado' || data.status === 'ajuste_solicitado') {
            const resEv = registrarEventoOrcamentoHistorico(ped, {
                tipo: data.status === 'aprovado' ? 'cliente_aprovado' : 'cliente_ajuste',
                dataHora: respEm,
                autor: 'Cliente (via Link)',
                titulo: data.status === 'aprovado'
                    ? 'Orçamento aprovado pelo cliente'
                    : 'Cliente solicitou ajuste pelo link',
                comentario: data.comentarioCliente || '',
                ip: ipRecebido || 'Não identificado',
                token,
                valorNovo: Number(ped.valor || 0) || 0
            });
            if (resEv.inserido) alterou = true;
        }

        if (!mudouStatus && !mudouComent && !mudouIp && !alterou && !(data.status === 'aprovado' && ped.status === 'orcamento')) {
            return;
        }

        if (data.status) lista[idx].orcamentoStatus = data.status;
        if (mudouComent || data.comentarioCliente !== undefined) {
            lista[idx].orcamentoComentarioCliente = data.comentarioCliente || '';
        }
        if (data.status === 'aprovado' || data.status === 'ajuste_solicitado') {
            lista[idx].orcamentoRespondidoEm = respEm;
            if (ipRecebido) {
                lista[idx].orcamentoUltimoIp = ipRecebido;
            }
        }

        if (data.status === 'aprovado') {
            lista[idx].orcamentoAprovadoEm = respEm;
            lista[idx].orcamentoAprovadoIp = ipRecebido || lista[idx].orcamentoAprovadoIp || 'Não identificado';
            if (lista[idx].status === 'orcamento') {
                lista[idx].status = 'aberto';
                lista[idx].statusTV = lista[idx].statusTV || 'em_servico';
                lista[idx].aprovadoViaLinkEm = respEm;
            }
        }

        localStorage.setItem('pedidos', JSON.stringify(lista));
        if (typeof onSyncPedido === 'function') {
            onSyncPedido(lista[idx], data.status);
        }
    };

    pedidos.forEach((p) => {
        if (p && p.orcamentoToken && (p.status === 'orcamento' || p.orcamentoStatus === 'pendente')) {
            tokensAtivos.add(p.orcamentoToken);
            if (!_unsubsOrcamentos.has(p.orcamentoToken)) {
                try {
                    const unsub = onSnapshot(doc(db, 'orcamentos_publicos', p.orcamentoToken), (snap) => {
                        if (snap.exists()) {
                            processarDoc(p.orcamentoToken, snap.data());
                        }
                    }, () => {});
                    _unsubsOrcamentos.set(p.orcamentoToken, unsub);
                } catch (e) {}
            }
        }
    });

    for (const [tok, unsub] of _unsubsOrcamentos.entries()) {
        if (!tokensAtivos.has(tok)) {
            try { unsub(); } catch (e) {}
            _unsubsOrcamentos.delete(tok);
        }
    }

    return () => {
        for (const unsub of _unsubsOrcamentos.values()) {
            try { unsub(); } catch (e) {}
        }
        _unsubsOrcamentos.clear();
    };
}

export async function publicarPainelTv(pedidosOverride = null) {
    if (!db || typeof localStorage === 'undefined') return null;
    const { empresa, config } = getContextoRuntimeTenant();
    const user = typeof window !== 'undefined' ? window.AuthService?.getCurrentUser?.() : null;
    if ((!empresa || (!empresa.id && !empresa.codigo)) && !user?.empresaId) return null;

    const pedidos = Array.isArray(pedidosOverride)
        ? pedidosOverride
        : (JSON.parse(localStorage.getItem('pedidos')) || []);

    const payload = sanitizarPainelTv({ pedidos, empresa, config });
    await setDoc(doc(db, 'painel_tv_publico', payload.empresaId), payload);

    // Mantém espelho em chaves alternativas legadas (ex.: empresa_danilo <-> danilodetailer)
    const candidatosAlt = [
        empresa?.id,
        empresa?.codigo,
        user?.empresaId,
        user?.empresaCodigo
    ]
        .map((v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
        .filter((v) => v.length >= 2 && v !== payload.empresaId);

    for (const altId of new Set(candidatosAlt)) {
        setDoc(doc(db, 'painel_tv_publico', altId), { ...payload, empresaId: altId }).catch(() => {});
    }

    return payload;
}

export function obterLinkPainelTv() {
    if (typeof window === 'undefined') return '';
    const { empresa, config } = getContextoRuntimeTenant();
    const codigo = encodeURIComponent(resolverChavePublicaEmpresa(empresa, config));
    return resolverUrlPublica(`painel-tv.html?empresa=${codigo}`);
}

export async function publicarAgendaPublicaConfig(agendamentosOverride = null) {
    if (!db || typeof localStorage === 'undefined') return null;
    const { empresa, config } = getContextoRuntimeTenant();
    if (!empresa || !empresa.id) return null;

    const servicos = JSON.parse(localStorage.getItem('servicos')) || [];
    const agendamentos = Array.isArray(agendamentosOverride)
        ? agendamentosOverride
        : (JSON.parse(localStorage.getItem('agendamentos')) || []);

    const payload = sanitizarAgendaConfigParaPublico({ empresa, config, servicos, agendamentos });
    await setDoc(doc(db, 'agenda_publica_config', payload.empresaId), payload);
    return payload;
}

export function obterLinkAgendaPublica() {
    if (typeof window === 'undefined') return '';
    const { empresa } = getContextoRuntimeTenant();
    const codigo = encodeURIComponent(empresa?.codigo || empresa?.id || 'danilodetailer');
    return resolverUrlPublica(`agenda-publica.html?empresa=${codigo}`);
}

let _unsubAgendaPublica = null;

export function iniciarListenerAgendamentosPublicos(onImportados) {
    if (!db || typeof localStorage === 'undefined') return () => {};
    const { empresa } = getContextoRuntimeTenant();
    const empresaId = empresa?.id || empresa?.codigo;
    if (!empresaId) return () => {};

    if (_unsubAgendaPublica) {
        try { _unsubAgendaPublica(); } catch (e) {}
        _unsubAgendaPublica = null;
    }

    const importarDocs = async (docsSnap) => {
        const existentes = JSON.parse(localStorage.getItem('agendamentos')) || [];
        let adicionados = 0;

        for (const docSnap of docsSnap.docs) {
            const pub = docSnap.data();
            if (!pub || pub.status !== 'pendente_importacao') continue;

            const jaExiste = existentes.some((a) => String(a.id) === String(pub.id) || String(a.publicoOrigemId) === String(docSnap.id));
            if (!jaExiste) {
                existentes.push({
                    id: pub.id || `ag_${Date.now()}`,
                    publicoOrigemId: docSnap.id,
                    origem: 'publico',
                    clienteNome: pub.clienteNome || 'Cliente Online',
                    clienteTelefone: pub.clienteTelefone || '',
                    veiculoTipo: pub.veiculoTipo || 'carro',
                    placa: (pub.placa || '').toUpperCase(),
                    cor: pub.cor || 'prata',
                    modelo: pub.modelo || pub.itemDescricao || '',
                    itemDescricao: pub.itemDescricao || '',
                    data: pub.data,
                    hora: pub.hora,
                    duracaoMinutos: Number(pub.duracaoMinutos || 60),
                    servicos: pub.servicos || 'Atendimento',
                    valor: Number(pub.valor || 0),
                    observacoes: pub.observacoes ? `[Autoagendamento] ${pub.observacoes}` : '[Autoagendamento Online]',
                    status: 'agendado',
                    criadoEm: pub.criadoEm || new Date().toISOString()
                });
                adicionados++;
            }

            try {
                await deleteDoc(doc(db, 'agendamentos_publicos', docSnap.id));
            } catch (e) {}
        }

        if (adicionados > 0) {
            localStorage.setItem('agendamentos', JSON.stringify(existentes));
            await publicarAgendaPublicaConfig(existentes).catch(() => {});
            if (typeof onImportados === 'function') {
                onImportados(adicionados, existentes);
            }
        }
    };

    try {
        const q = query(collection(db, 'agendamentos_publicos'), where('empresaId', '==', empresaId));
        _unsubAgendaPublica = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                importarDocs(snapshot);
            }
        }, (err) => {
            console.warn('Listener autoagendamento público:', err?.message || err);
        });
    } catch (e) {}

    return () => {
        if (_unsubAgendaPublica) {
            try { _unsubAgendaPublica(); } catch (e) {}
            _unsubAgendaPublica = null;
        }
    };
}

const PublicoService = {
    gerarTokenSeguro,
    extrairPrimeiroNome,
    resolverUrlPublica,
    resolverChavePublicaEmpresa,
    registrarEventoOrcamentoHistorico,
    garantirHistoricoInicialOrcamento,
    sanitizarOrcamentoParaPublico,
    sanitizarPainelTv,
    sanitizarAgendaConfigParaPublico,
    gerarSlotsDisponiveis,
    publicarOrcamentoPublico,
    iniciarSincronizacaoOrcamentos,
    publicarPainelTv,
    obterLinkPainelTv,
    publicarAgendaPublicaConfig,
    obterLinkAgendaPublica,
    iniciarListenerAgendamentosPublicos
};

if (typeof window !== 'undefined') {
    window.PublicoService = PublicoService;

    let _timerThemeSync = null;
    window.addEventListener('themechange', () => {
        if (_timerThemeSync) clearTimeout(_timerThemeSync);
        _timerThemeSync = setTimeout(() => {
            try {
                const user = window.AuthService?.getCurrentUser?.();
                if (user && user.empresaId) {
                    publicarPainelTv().catch(() => {});
                }
            } catch (e) {}
        }, 250);
    });
}

export default PublicoService;
