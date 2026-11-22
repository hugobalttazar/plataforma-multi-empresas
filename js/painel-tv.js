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

document.getElementById('btnTvAudio')?.addEventListener('click', (e) => {
    audioAtivo = !audioAtivo;
    e.currentTarget.textContent = audioAtivo ? '🔊 Som Ligado' : '🔇 Som Desligado';
    if (audioAtivo) tocarChime();
});

document.getElementById('btnTvFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.().catch(() => {});
    }
});

atualizarRelogio();
setInterval(atualizarRelogio, 15000);

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

    const ref = doc(db, 'painel_tv_publico', empresaId);
    try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
            renderizarBoard(snap.data());
        } else {
            document.getElementById('tvListaServico').innerHTML =
                '<div class="tv-empty">Aguardando abertura de atendimentos no pátio.</div>';
            document.getElementById('tvListaPronto').innerHTML =
                '<div class="tv-empty">Nenhum atendimento pronto no momento.</div>';
        }
        onSnapshot(ref, (liveSnap) => {
            if (liveSnap.exists()) {
                renderizarBoard(liveSnap.data());
            }
        });
    } catch (err) {
        console.error('Erro ao conectar Painel TV:', err);
    }
}

inicializar();
