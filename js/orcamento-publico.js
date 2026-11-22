import { db, doc, getDoc, updateDoc, onSnapshot } from './firebase-init.js';

function esc(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function formatarMoeda(val) {
    return `R$ ${(Number(val || 0) || 0).toFixed(2).replace('.', ',')}`;
}

function formatarDataBR(iso) {
    if (!iso || typeof iso !== 'string') return '-';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatarDataHoraBR(iso) {
    if (!iso || typeof iso !== 'string') return '-';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return formatarDataBR(iso);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${min}:${ss}`;
}

async function obterIpCliente() {
    const consultarJson = async (url, timeoutMs = 2200) => {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const resp = await fetch(url, {
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            });
            if (!resp.ok) return '';
            const json = await resp.json().catch(() => null);
            const ip = json && typeof json.ip === 'string' ? json.ip.trim() : '';
            if (ip && /^[a-fA-F0-9:.]{3,64}$/.test(ip)) return ip;
            return '';
        } catch (e) {
            return '';
        } finally {
            if (timer) clearTimeout(timer);
        }
    };

    try {
        const ipProprio = await consultarJson('api/publico/client-ip', 1800);
        if (ipProprio && ipProprio !== '127.0.0.1') return ipProprio;

        const ipPublico = await consultarJson('https://api64.ipify.org?format=json', 2400);
        if (ipPublico) return ipPublico;

        const ipFallback = await consultarJson('https://api.ipify.org?format=json', 2000);
        if (ipFallback) return ipFallback;

        if (ipProprio) return ipProprio;
    } catch (e) {}
    return 'Não identificado';
}

const params = new URLSearchParams(window.location.search);
const token = (params.get('token') || '').trim();

const elLoading = document.getElementById('orcLoading');
const elErro = document.getElementById('orcErro');
const elErroTexto = document.getElementById('orcErroTexto');
const elConteudo = document.getElementById('orcConteudo');

let dadosAtuais = null;
let enviando = false;

function mostrarErro(msg) {
    if (elLoading) elLoading.style.display = 'none';
    if (elConteudo) elConteudo.style.display = 'none';
    if (elErroTexto && msg) elErroTexto.textContent = msg;
    if (elErro) elErro.style.display = 'block';
}

function mostrarFeedback(texto, tipo = 'info') {
    const el = document.getElementById('orcFeedbackMsg');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = texto;
    if (tipo === 'success') {
        el.style.background = '#dcfce7';
        el.style.color = '#166534';
        el.style.border = '1px solid #86efac';
    } else if (tipo === 'warning') {
        el.style.background = '#fef3c7';
        el.style.color = '#92400e';
        el.style.border = '1px solid #fde68a';
    } else {
        el.style.background = '#fee2e2';
        el.style.color = '#991b1b';
        el.style.border = '1px solid #fecaca';
    }
}

function renderizarOrcamento(d) {
    dadosAtuais = d;
    if (elLoading) elLoading.style.display = 'none';
    if (elErro) elErro.style.display = 'none';
    if (elConteudo) elConteudo.style.display = 'flex';

    document.getElementById('orcEmpresaIcone').textContent = d.icone || '🛠️';
    document.getElementById('orcEmpresaNome').textContent = d.empresaNome || 'Estabelecimento';
    document.title = `Orçamento | ${d.empresaNome || 'Atendimento'}`;

    document.getElementById('orcClienteNome').textContent = d.clientePrimeiroNome || 'Cliente';
    const isAuto = !d.tipoNegocio || d.tipoNegocio === 'lava_jato' || d.tipoNegocio === 'mecanica';
    document.getElementById('orcIdentLabel').textContent = isAuto ? 'Veículo / Placa' : 'Atendimento / Item';
    document.getElementById('orcIdentValor').textContent = d.identificador || '-';
    document.getElementById('orcData').textContent = formatarDataBR(d.dataEntrada || d.criadoEm);

    const listaEl = document.getElementById('orcListaItens');
    const linhas = [];
    if (Array.isArray(d.servicos)) {
        d.servicos.forEach((s) => {
            const precoStr = Number(s.preco || 0) > 0 ? formatarMoeda(s.preco) : 'Incluso';
            linhas.push(`
                <div class="item-row">
                    <span>🛠️ ${esc(s.nome)}</span>
                    <span class="money">${esc(precoStr)}</span>
                </div>
            `);
        });
    }
    if (Array.isArray(d.produtos)) {
        d.produtos.forEach((p) => {
            const qtd = Number(p.quantidade || 1) || 1;
            const sub = qtd * (Number(p.precoUnitario || 0) || 0);
            linhas.push(`
                <div class="item-row">
                    <span>🛍️ ${qtd}x ${esc(p.nome)}</span>
                    <span class="money">${esc(formatarMoeda(sub))}</span>
                </div>
            `);
        });
    }
    listaEl.innerHTML = linhas.length > 0
        ? linhas.join('')
        : '<div style="color:var(--muted); font-size:0.9rem;">Itens conforme atendimento combinado.</div>';

    document.getElementById('orcValorTotal').textContent = formatarMoeda(d.valorTotal || 0);
    document.getElementById('orcVistoriaTexto').textContent = d.vistoriaResumo || 'Sem apontamentos registrados.';

    const imgEl = document.getElementById('orcFotoImg');
    if (d.fotoUrl && typeof d.fotoUrl === 'string' && d.fotoUrl.startsWith('data:image/')) {
        imgEl.src = d.fotoUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    const bannerEl = document.getElementById('orcStatusBanner');
    const botoesEl = document.getElementById('orcBotoesAcao');
    const boxAjuste = document.getElementById('orcBoxAjuste');
    const respRegEl = document.getElementById('orcRespostaRegistrada');

    if (d.status === 'aprovado') {
        bannerEl.className = 'status-banner status-aprovado';
        bannerEl.innerHTML = '<span>✅</span><span>Orçamento Aprovado! Serviço autorizado para execução.</span>';
        botoesEl.style.display = 'none';
        boxAjuste.style.display = 'none';
        respRegEl.style.display = 'block';
        respRegEl.innerHTML = `Resposta registrada em ${esc(formatarDataHoraBR(d.respondidoEm || d.atualizadoEm))}. O estabelecimento já recebeu sua aprovação.`;
    } else if (d.status === 'ajuste_solicitado') {
        bannerEl.className = 'status-banner status-ajuste';
        bannerEl.innerHTML = '<span>✏️</span><span>Solicitação de ajuste enviada ao estabelecimento.</span>';
        botoesEl.style.display = 'none';
        boxAjuste.style.display = 'none';
        respRegEl.style.display = 'block';
        respRegEl.innerHTML = `<strong>Seu comentário:</strong> "${esc(d.comentarioCliente || 'Solicitou ajuste')}"<br><small>Enviado em ${esc(formatarDataHoraBR(d.respondidoEm || d.atualizadoEm))}. Aguarde o estabelecimento atualizar o orçamento ou entrar em contato.</small>`;
    } else {
        bannerEl.className = 'status-banner status-pendente';
        bannerEl.innerHTML = '<span>⏳</span><span>Aguardando sua aprovação para iniciar o atendimento</span>';
        botoesEl.style.display = 'flex';
        respRegEl.style.display = 'none';
    }
}

async function enviarResposta(novoStatus, comentario = '') {
    if (!db || !token || !dadosAtuais || enviando) return;
    if (dadosAtuais.status !== 'pendente') return;

    enviando = true;
    const btnAprovar = document.getElementById('btnAprovarOrcamento');
    const btnAjuste = document.getElementById('btnConfirmarAjuste');
    if (btnAprovar) btnAprovar.disabled = true;
    if (btnAjuste) btnAjuste.disabled = true;

    try {
        const clienteIp = await obterIpCliente();
        const agora = new Date().toISOString();
        await updateDoc(doc(db, 'orcamentos_publicos', token), {
            status: novoStatus,
            comentarioCliente: String(comentario || '').trim().slice(0, 580),
            clienteIp: String(clienteIp || 'Não identificado').slice(0, 64),
            respondidoEm: agora,
            atualizadoEm: agora
        });
        mostrarFeedback(
            novoStatus === 'aprovado'
                ? 'Orçamento aprovado com sucesso! Obrigado pela confirmação.'
                : 'Solicitação de ajuste enviada! O estabelecimento foi notificado.',
            novoStatus === 'aprovado' ? 'success' : 'warning'
        );
    } catch (err) {
        console.error('Erro ao registrar resposta:', err);
        mostrarFeedback('Não foi possível registrar sua resposta agora. Tente novamente em instantes.', 'error');
    } finally {
        enviando = false;
        if (btnAprovar) btnAprovar.disabled = false;
        if (btnAjuste) btnAjuste.disabled = false;
    }
}

document.getElementById('btnAprovarOrcamento')?.addEventListener('click', () => {
    enviarResposta('aprovado', '');
});

document.getElementById('btnAbrirAjusteOrcamento')?.addEventListener('click', () => {
    const box = document.getElementById('orcBoxAjuste');
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
        if (box.style.display === 'block') {
            document.getElementById('orcComentarioAjuste')?.focus();
        }
    }
});

document.getElementById('btnConfirmarAjuste')?.addEventListener('click', () => {
    const txt = (document.getElementById('orcComentarioAjuste')?.value || '').trim();
    if (!txt || txt.length < 3) {
        mostrarFeedback('Escreva brevemente qual ajuste você deseja antes de enviar.', 'warning');
        document.getElementById('orcComentarioAjuste')?.focus();
        return;
    }
    enviarResposta('ajuste_solicitado', txt);
});

async function inicializar() {
    if (!token || token.length < 16) {
        mostrarErro('Link de orçamento inválido ou incompleto.');
        return;
    }
    if (!db) {
        mostrarErro('Conexão com o banco de dados indisponível.');
        return;
    }

    try {
        const ref = doc(db, 'orcamentos_publicos', token);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            mostrarErro('Este orçamento não existe ou foi removido.');
            return;
        }
        renderizarOrcamento(snap.data());
        onSnapshot(ref, (liveSnap) => {
            if (liveSnap.exists()) {
                renderizarOrcamento(liveSnap.data());
            }
        });
    } catch (err) {
        console.error('Erro ao carregar orçamento:', err);
        mostrarErro('Não foi possível carregar este orçamento no momento.');
    }
}

inicializar();
