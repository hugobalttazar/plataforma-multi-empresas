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

export function sanitizarPainelTv({ pedidos = [], empresa = {}, config = {} } = {}) {
    const isAuto = isSegmentoAutoConfig(config, empresa);
    const empresaId = limparTexto(empresa?.id || empresa?.codigo || config?.codigoEmpresa || 'danilodetailer', 80);
    const empresaNome = limparTexto(config?.nomeEstabelecimento || empresa?.nome || 'Estabelecimento', 120);
    const tipoNegocio = limparTexto(config?.tipoNegocio || empresa?.tipoNegocio || 'geral', 40);

    const abertos = Array.isArray(pedidos) ? pedidos.filter((p) => p && p.status === 'aberto') : [];
    const itens = abertos.slice(-80).reverse().map((p) => {
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
        icone: limparTexto(config?.iconeCustom || empresa?.icone || '🛠️', 12),
        tipoNegocio,
        segmentoAutomotivo: Boolean(isAuto),
        itens,
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
        return { empresa: { id: 'danilodetailer' }, config: {} };
    }
    const config = window.BrandService?.getConfig?.() || {};
    let empresa = window.EmpresaService?.getEmpresaAtiva?.();
    if (!empresa || !empresa.id) {
        const user = window.AuthService?.getCurrentUser?.();
        const empId = user?.empresaId || localStorage.getItem('master_active_empresaId') || 'danilodetailer';
        empresa = {
            id: empId,
            codigo: empId,
            nome: config.nomeEstabelecimento || empId,
            tipoNegocio: config.tipoNegocio || 'geral',
            icone: config.iconeCustom || '🛠️'
        };
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

    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const url = `${origin}/orcamento.html?token=${encodeURIComponent(token)}`;
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
        const statusAnt = ped.orcamentoStatus || 'pendente';
        const comentAnt = ped.orcamentoComentarioCliente || '';
        const mudouStatus = data.status && data.status !== statusAnt;
        const mudouComent = (data.comentarioCliente || '') !== comentAnt;

        if (!mudouStatus && !mudouComent && !(data.status === 'aprovado' && ped.status === 'orcamento')) {
            return;
        }

        lista[idx].orcamentoStatus = data.status;
        lista[idx].orcamentoComentarioCliente = data.comentarioCliente || '';
        lista[idx].orcamentoRespondidoEm = data.respondidoEm || data.atualizadoEm || new Date().toISOString();

        if (data.status === 'aprovado' && lista[idx].status === 'orcamento') {
            lista[idx].status = 'aberto';
            lista[idx].statusTV = lista[idx].statusTV || 'em_servico';
            lista[idx].aprovadoViaLinkEm = lista[idx].orcamentoRespondidoEm;
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
    if (!empresa || !empresa.id) return null;

    const pedidos = Array.isArray(pedidosOverride)
        ? pedidosOverride
        : (JSON.parse(localStorage.getItem('pedidos')) || []);

    const payload = sanitizarPainelTv({ pedidos, empresa, config });
    await setDoc(doc(db, 'painel_tv_publico', payload.empresaId), payload);
    return payload;
}

export function obterLinkPainelTv() {
    if (typeof window === 'undefined') return '';
    const { empresa } = getContextoRuntimeTenant();
    const codigo = encodeURIComponent(empresa?.codigo || empresa?.id || 'danilodetailer');
    return `${window.location.origin}/painel-tv.html?empresa=${codigo}`;
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
    return `${window.location.origin}/agenda-publica.html?empresa=${codigo}`;
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
}

export default PublicoService;
