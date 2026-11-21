import { db, doc, getDoc, setDoc } from './firebase-init.js';
import { gerarSlotsDisponiveis } from './publico-service.js';

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
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const params = new URLSearchParams(window.location.search);
const empresaId = (params.get('empresa') || '').trim().toLowerCase();

let configPublica = null;
const servicosSelecionados = new Set();

function mostrarErro(msg) {
    document.getElementById('agPubLoading').style.display = 'none';
    document.getElementById('formAgendaPublica').style.display = 'none';
    document.getElementById('agPubErroTexto').textContent = msg;
    document.getElementById('agPubErro').style.display = 'block';
}

function atualizarTotal() {
    if (!configPublica) return;
    let total = 0;
    (configPublica.servicos || []).forEach((s) => {
        if (servicosSelecionados.has(s.nome)) {
            total += Number(s.preco || 0) || 0;
        }
    });
    document.getElementById('agPubTotal').textContent = formatarMoeda(total);
}

function renderizarServicos() {
    const grid = document.getElementById('agPubServicosGrid');
    if (!grid || !configPublica) return;
    const lista = Array.isArray(configPublica.servicos) ? configPublica.servicos : [];
    if (lista.length === 0) {
        grid.innerHTML = '<div style="color:var(--muted); font-size:0.9rem;">Atendimento padrão sob consulta no local.</div>';
        return;
    }

    grid.innerHTML = '';
    lista.forEach((s) => {
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'srv-option' + (servicosSelecionados.has(s.nome) ? ' selected' : '');
        div.innerHTML = `
            <span style="text-align:left; font-weight:600; font-size:0.9rem;">${esc(s.nome)}</span>
            <span class="srv-price">${Number(s.preco || 0) > 0 ? esc(formatarMoeda(s.preco)) : 'A combinar'}</span>
        `;
        div.addEventListener('click', () => {
            if (servicosSelecionados.has(s.nome)) {
                servicosSelecionados.delete(s.nome);
                div.classList.remove('selected');
            } else {
                servicosSelecionados.add(s.nome);
                div.classList.add('selected');
            }
            atualizarTotal();
        });
        grid.appendChild(div);
    });
}

function renderizarSlots() {
    const dataISO = document.getElementById('agPubData').value;
    const avisoEl = document.getElementById('agPubDiaAviso');
    const slotsGrid = document.getElementById('agPubSlotsGrid');
    const horaHidden = document.getElementById('agPubHoraSelecionada');
    horaHidden.value = '';
    slotsGrid.innerHTML = '';

    const res = gerarSlotsDisponiveis({ configPublica, dataISO });
    if (!res.diaAtivo) {
        avisoEl.textContent = res.motivo;
        avisoEl.style.display = 'block';
        return;
    }

    const disponiveis = res.slots.filter((s) => s.disponivel);
    if (disponiveis.length === 0) {
        avisoEl.textContent = 'Todos os horários desta data já foram preenchidos. Escolha outra data.';
        avisoEl.style.display = 'block';
        return;
    }

    avisoEl.style.display = 'none';
    res.slots.forEach((slot) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.textContent = slot.hora;
        btn.disabled = !slot.disponivel;
        if (slot.disponivel) {
            btn.addEventListener('click', () => {
                slotsGrid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                horaHidden.value = slot.hora;
            });
        }
        slotsGrid.appendChild(btn);
    });
}

function mostrarFeedbackForm(msg) {
    const el = document.getElementById('agPubFeedback');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.style.border = '1px solid #fecaca';
    el.textContent = msg;
}

document.getElementById('agPubPlaca')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
});

document.getElementById('agPubData')?.addEventListener('change', renderizarSlots);

document.getElementById('formAgendaPublica')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!db || !configPublica) return;

    const hora = (document.getElementById('agPubHoraSelecionada').value || '').trim();
    const data = (document.getElementById('agPubData').value || '').trim();
    const nome = (document.getElementById('agPubNome').value || '').trim();
    const telefone = (document.getElementById('agPubTelefone').value || '').trim();

    if (!data || !hora) {
        mostrarFeedbackForm('Selecione uma data e um horário disponível.');
        return;
    }
    if (nome.length < 2 || telefone.replace(/\D/g, '').length < 8) {
        mostrarFeedbackForm('Informe seu nome completo e um telefone/WhatsApp válido.');
        return;
    }

    const listaServicos = Array.from(servicosSelecionados);
    if ((configPublica.servicos || []).length > 0 && listaServicos.length === 0) {
        mostrarFeedbackForm('Selecione pelo menos um serviço desejado.');
        return;
    }

    let valor = 0;
    let duracao = 60;
    (configPublica.servicos || []).forEach((s) => {
        if (servicosSelecionados.has(s.nome)) {
            valor += Number(s.preco || 0) || 0;
            duracao = Math.max(duracao, Number(s.duracao || 60) || 60);
        }
    });

    const isAuto = Boolean(configPublica.segmentoAutomotivo);
    const placa = isAuto ? (document.getElementById('agPubPlaca').value || '').trim().toUpperCase() : '';
    const modelo = isAuto ? (document.getElementById('agPubModelo').value || '').trim() : '';
    const itemDesc = !isAuto ? (document.getElementById('agPubItemDesc').value || '').trim() : '';
    const obs = (document.getElementById('agPubObs').value || '').trim();

    const btn = document.getElementById('btnConfirmarAgendaPub');
    btn.disabled = true;
    btn.textContent = 'Enviando agendamento...';

    try {
        const agId = `agpub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const agora = new Date().toISOString();
        const payload = {
            id: agId,
            empresaId: configPublica.empresaId,
            clienteNome: nome.slice(0, 110),
            clienteTelefone: telefone.slice(0, 28),
            veiculoTipo: 'carro',
            placa: placa.slice(0, 12),
            modelo: modelo.slice(0, 60),
            cor: 'prata',
            itemDescricao: itemDesc.slice(0, 80),
            data,
            hora,
            duracaoMinutos: duracao,
            servicos: (listaServicos.join(', ') || 'Atendimento').slice(0, 380),
            valor: Math.max(0, Math.round(valor * 100) / 100),
            observacoes: obs.slice(0, 220),
            status: 'pendente_importacao',
            criadoEm: agora,
            atualizadoEm: agora
        };

        await setDoc(doc(db, 'agendamentos_publicos', agId), payload);

        if (!Array.isArray(configPublica.horariosOcupados)) configPublica.horariosOcupados = [];
        configPublica.horariosOcupados.push(`${data}|${hora}`);

        document.getElementById('formAgendaPublica').style.display = 'none';
        document.getElementById('agPubSucesso').style.display = 'block';
        document.getElementById('agPubResumoSucesso').textContent =
            `${nome}, seu horário em ${configPublica.empresaNome} foi reservado para ${formatarDataBR(data)} às ${hora} (${payload.servicos}).`;
    } catch (err) {
        console.error('Erro ao salvar agendamento público:', err);
        mostrarFeedbackForm('Erro ao enviar agendamento. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Confirmar Pré-Agendamento';
    }
});

document.getElementById('btnNovoAgPub')?.addEventListener('click', () => {
    document.getElementById('agPubSucesso').style.display = 'none';
    document.getElementById('formAgendaPublica').style.display = 'flex';
    document.getElementById('agPubFeedback').style.display = 'none';
    renderizarSlots();
});

async function inicializar() {
    if (!empresaId) {
        mostrarErro('Informe o código da empresa na URL (?empresa=codigo) para abrir o autoagendamento.');
        return;
    }
    if (!db) {
        mostrarErro('Serviço de agenda online temporariamente indisponível.');
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'agenda_publica_config', empresaId));
        if (!snap.exists()) {
            mostrarErro('Este estabelecimento ainda não ativou ou sincronizou a agenda pública.');
            return;
        }
        configPublica = snap.data();
        document.getElementById('agPubLoading').style.display = 'none';
        document.getElementById('formAgendaPublica').style.display = 'flex';

        document.getElementById('agPubIcone').textContent = configPublica.icone || '📅';
        document.getElementById('agPubEmpresaNome').textContent = configPublica.empresaNome || empresaId;
        document.title = `Agendar | ${configPublica.empresaNome || 'Atendimento'}`;

        const isAuto = Boolean(configPublica.segmentoAutomotivo);
        document.getElementById('agPubCamposAuto').style.display = isAuto ? 'grid' : 'none';
        document.getElementById('agPubCamposOutro').style.display = isAuto ? 'none' : 'block';

        const hoje = new Date();
        const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        const inputData = document.getElementById('agPubData');
        inputData.min = hojeISO;
        inputData.value = hojeISO;

        renderizarServicos();
        renderizarSlots();
    } catch (err) {
        console.error('Erro ao carregar agenda pública:', err);
        mostrarErro('Não foi possível carregar os horários do estabelecimento.');
    }
}

inicializar();
