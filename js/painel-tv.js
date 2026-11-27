import { db, doc, getDoc, onSnapshot } from './firebase-init.js';

function esc(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

const params = new URLSearchParams(window.location.search);
const empresaId = (params.get('empresa') || '').trim().toLowerCase();

let audioAtivo = false;
let prontosAnteriores = new Set();
let primeiroLoad = true;

function aplicarTemaTV(tema) {
    const temaValido = tema === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', temaValido);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', temaValido === 'dark' ? '#090d16' : '#f1f5f9');
    }
}

try {
    aplicarTemaTV(localStorage.getItem('app_theme'));
} catch (e) {
    aplicarTemaTV('light');
}

window.addEventListener('storage', (e) => {
    if (e && e.key === 'app_theme') {
        aplicarTemaTV(e.newValue);
    }
});

function tocarChime() {
    if (!audioAtivo) return;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.56);
    } catch (e) {}
}

function atualizarRelogio() {
    const el = document.getElementById('tvClock');
    if (!el) return;
    const now = new Date();
    el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function renderizarBoard(data) {
    if (!data) return;
    if (data.tema === 'light' || data.tema === 'dark') {
        aplicarTemaTV(data.tema);
    }
    document.getElementById('tvLogo').textContent = data.icone || '📺';
    document.getElementById('tvEmpresaNome').textContent = (data.empresaNome || 'PAINEL DE ATENDIMENTO').toUpperCase();
    document.title = `Painel TV | ${data.empresaNome || 'Atendimento'}`;

    const itens = Array.isArray(data.itens) ? data.itens : [];
    const emServico = itens.filter((i) => i.statusTV !== 'pronto');
    const prontos = itens.filter((i) => i.statusTV === 'pronto');

    if (!primeiroLoad) {
        const novoPronto = prontos.some((i) => !prontosAnteriores.has(i.id));
        if (novoPronto) tocarChime();
    }
    prontosAnteriores = new Set(prontos.map((i) => i.id));
    primeiroLoad = false;

    document.getElementById('tvCountServico').textContent = emServico.length;
    document.getElementById('tvCountPronto').textContent = prontos.length;

    const elServ = document.getElementById('tvListaServico');
    const elPronto = document.getElementById('tvListaPronto');

    elServ.innerHTML = emServico.length === 0
        ? '<div class="tv-empty">Nenhum atendimento em andamento no momento.</div>'
        : emServico.map((i) => `
            <div class="tv-item">
                <div>
                    <div class="tv-ident">${esc(i.identificador)}</div>
                    <div class="tv-subitem">${esc(i.subtitulo || 'Em serviço')}</div>
                </div>
                <div class="tv-hora">${i.horaEntrada ? 'Entrada ' + esc(i.horaEntrada) : 'Em serviço'}</div>
            </div>
        `).join('');

    elPronto.innerHTML = prontos.length === 0
        ? '<div class="tv-empty">Nenhum atendimento pronto no momento.</div>'
        : prontos.map((i) => `
            <div class="tv-item">
                <div>
                    <div class="tv-ident">${esc(i.identificador)}</div>
                    <div class="tv-subitem">${esc(i.subtitulo || 'Pronto para retirada')}</div>
                </div>
                <div class="tv-hora tv-hora-pronto">PRONTO ✅</div>
            </div>
        `).join('');
}

const btnTvAudio = document.getElementById('btnTvAudio');
if (btnTvAudio) {
    btnTvAudio.addEventListener('click', (e) => {
        audioAtivo = !audioAtivo;
        e.currentTarget.textContent = audioAtivo ? '🔊 Som Ligado' : '🔇 Som Desligado';
        if (audioAtivo) tocarChime();
    });
}

const btnTvFullscreen = document.getElementById('btnTvFullscreen');
if (btnTvFullscreen) {
    btnTvFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            if (document.documentElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    });
}

atualizarRelogio();
setInterval(atualizarRelogio, 15000);

let ultimaAssinaturaRender = '';
let pollingTimer = null;

function aplicarPayloadBoard(data) {
    if (!data) return;
    const assinatura = `${data.atualizadoEm || ''}|${(data.itens || []).length}|${data.tema || ''}`;
    if (assinatura && assinatura === ultimaAssinaturaRender) return;
    ultimaAssinaturaRender = assinatura;
    renderizarBoard(data);
}

function mostrarEstadoVazioBoard() {
    ultimaAssinaturaRender = '';
    document.getElementById('tvCountServico').textContent = '0';
    document.getElementById('tvCountPronto').textContent = '0';
    document.getElementById('tvListaServico').innerHTML =
        '<div class="tv-empty">Aguardando abertura de atendimentos no pátio.</div>';
    document.getElementById('tvListaPronto').innerHTML =
        '<div class="tv-empty">Nenhum atendimento pronto no momento.</div>';
}

function mostrarErroConexaoBoard(err) {
    const detalhe = err && err.message ? String(err.message) : 'Falha de conexão com o banco.';
    document.getElementById('tvListaServico').innerHTML =
        `<div class="tv-empty">Não foi possível carregar os atendimentos (${esc(detalhe)}). Tentando reconectar...</div>`;
}

async function resolverRefAtiva(codigoUrl) {
    const chaveNormalizada = codigoUrl.replace(/[^a-z0-9_-]/g, '');
    const candidatas = [chaveNormalizada];
    if (chaveNormalizada === 'danilodetailer') {
        candidatas.push('empresa_danilo');
    } else if (chaveNormalizada === 'empresa_danilo') {
        candidatas.push('danilodetailer');
    }

    for (const key of candidatas) {
        if (!key || key.length < 2) continue;
        const candidateRef = doc(db, 'painel_tv_publico', key);
        const snap = await getDoc(candidateRef);
        if (snap.exists()) {
            return { ref: candidateRef, snap };
        }
    }

    const primaryKey = candidatas[0] || chaveNormalizada;
    const primaryRef = doc(db, 'painel_tv_publico', primaryKey);
    return { ref: primaryRef, snap: null };
}

async function inicializar() {
    if (!empresaId) {
        document.getElementById('tvListaServico').innerHTML =
            '<div class="tv-empty">Informe o código da empresa na URL (?empresa=codigo).</div>';
        document.getElementById('tvListaPronto').innerHTML = '';
        return;
    }
    if (!db) {
        document.getElementById('tvListaServico').innerHTML =
            '<div class="tv-empty">Conexão com o banco indisponível.</div>';
        return;
    }

    try {
        const { ref, snap } = await resolverRefAtiva(empresaId);
        if (snap && snap.exists()) {
            aplicarPayloadBoard(snap.data());
        } else {
            mostrarEstadoVazioBoard();
        }

        onSnapshot(
            ref,
            (liveSnap) => {
                if (liveSnap.exists()) {
                    aplicarPayloadBoard(liveSnap.data());
                } else {
                    mostrarEstadoVazioBoard();
                }
            },
            (err) => {
                console.error('Erro no listener em tempo real do Painel TV:', err);
                mostrarErroConexaoBoard(err);
            }
        );

        // Fallback periódico para navegadores de Smart TV caso WebChannel/WebSocket oscile
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(async () => {
            try {
                const check = await getDoc(ref);
                if (check.exists()) {
                    aplicarPayloadBoard(check.data());
                } else if (empresaId === 'danilodetailer' || empresaId === 'empresa_danilo') {
                    const altRes = await resolverRefAtiva(empresaId);
                    if (altRes.snap && altRes.snap.exists()) {
                        aplicarPayloadBoard(altRes.snap.data());
                    }
                }
            } catch (pollErr) {
                console.warn('Falha na atualização periódica do Painel TV:', pollErr);
            }
        }, 20000);
    } catch (err) {
        console.error('Erro ao conectar Painel TV:', err);
        mostrarErroConexaoBoard(err);
    }
}

inicializar();

