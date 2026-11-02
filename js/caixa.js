// ==========================================================================
// Lógica do Livro Caixa e Fechamento Diário
// ==========================================================================

const dataCaixaHoje = document.getElementById('dataCaixaHoje');
const badgeStatusCaixa = document.getElementById('badgeStatusCaixa');
const btnAbrirModalFecharCaixa = document.getElementById('btnAbrirModalFecharCaixa');
const btnReabrirCaixa = document.getElementById('btnReabrirCaixa');

const caixaTotalEntradas = document.getElementById('caixaTotalEntradas');
const caixaTotalSaidas = document.getElementById('caixaTotalSaidas');
const caixaSaldoReal = document.getElementById('caixaSaldoReal');

const caixaValorPix = document.getElementById('caixaValorPix');
const caixaValorDinheiro = document.getElementById('caixaValorDinheiro');
const caixaValorCredito = document.getElementById('caixaValorCredito');
const caixaValorDebito = document.getElementById('caixaValorDebito');
const caixaValorPrazo = document.getElementById('caixaValorPrazo');

const corpoRecebimentosHoje = document.getElementById('corpoRecebimentosHoje');
const corpoHistoricoCaixas = document.getElementById('corpoHistoricoCaixas');

const btnAbrirModalSaida = document.getElementById('btnAbrirModalSaida');
const modalSaidaCaixa = document.getElementById('modalSaidaCaixa');
const formRegistrarSaidaCaixa = document.getElementById('formRegistrarSaidaCaixa');
const modalSaidaCaixaX = document.getElementById('modalSaidaCaixaX');
const modalCancelarSaidaBtn = document.getElementById('modalCancelarSaidaBtn');

// Modal de Fechamento
const modalFecharCaixa = document.getElementById('modalFecharCaixa');
const formConfirmarFechamentoCaixa = document.getElementById('formConfirmarFechamentoCaixa');
const modalFecharCaixaX = document.getElementById('modalFecharCaixaX');
const modalCancelarFechamentoBtn = document.getElementById('modalCancelarFechamentoBtn');
const modalDataHojeTexto = document.getElementById('modalDataHojeTexto');
const modalResumoAtendimentos = document.getElementById('modalResumoAtendimentos');
const modalResumoValor = document.getElementById('modalResumoValor');
const modalFundoTrocoInput = document.getElementById('modalFundoTrocoInput');
const modalObservacoesFechamento = document.getElementById('modalObservacoesFechamento');

// Modal de Reabertura
const modalReabrirCaixa = document.getElementById('modalReabrirCaixa');
const modalReabrirCaixaX = document.getElementById('modalReabrirCaixaX');
const modalCancelarReabrirBtn = document.getElementById('modalCancelarReabrirBtn');
const btnConfirmarReabrirCaixaModal = document.getElementById('btnConfirmarReabrirCaixaModal');

// Modal de Exclusão de Saída
const modalConfirmarExclusaoSaida = document.getElementById('modalConfirmarExclusaoSaida');
const modalExcluirSaidaX = document.getElementById('modalExcluirSaidaX');
const modalCancelarExcluirSaidaBtn = document.getElementById('modalCancelarExcluirSaidaBtn');
const btnConfirmarExclusaoSaidaModal = document.getElementById('btnConfirmarExclusaoSaidaModal');
let idSaidaParaExcluir = null;

function formatarDataBR(dataISO) {
	if (!dataISO) return '--/--/----';
	const partes = dataISO.split('-');
	if (partes.length === 3) {
		return `${partes[2]}/${partes[1]}/${partes[0]}`;
	}
	return dataISO;
}

function carregarDadosCaixa() {
	const statusHoje = CaixaService.getStatusHoje();
	const hoje = statusHoje.data;

	if (dataCaixaHoje) {
		dataCaixaHoje.textContent = formatarDataBR(hoje);
	}

	// Status e botões
	if (statusHoje.status === 'fechado') {
		if (badgeStatusCaixa) {
			badgeStatusCaixa.className = 'badge badge-caixa-fechado';
			badgeStatusCaixa.textContent = '🔒 Caixa Fechado';
		}
		if (btnAbrirModalFecharCaixa) btnAbrirModalFecharCaixa.style.display = 'none';
		if (btnAbrirModalSaida) btnAbrirModalSaida.style.display = 'none';
		if (btnReabrirCaixa) btnReabrirCaixa.style.display = 'inline-flex';
	} else {
		if (badgeStatusCaixa) {
			badgeStatusCaixa.className = 'badge badge-caixa-aberto';
			badgeStatusCaixa.textContent = '● Caixa Aberto';
		}
		if (btnAbrirModalFecharCaixa) btnAbrirModalFecharCaixa.style.display = 'inline-flex';
		if (btnAbrirModalSaida) btnAbrirModalSaida.style.display = 'inline-flex';
		if (btnReabrirCaixa) btnReabrirCaixa.style.display = 'none';
	}

	// Estatísticas de Hoje
	if (caixaTotalEntradas) {
		caixaTotalEntradas.textContent = `R$ ${(statusHoje.totalValor || 0).toFixed(2)}`;
	}
	if (caixaTotalSaidas) {
		caixaTotalSaidas.textContent = `R$ ${(statusHoje.totalSaidas || 0).toFixed(2)}`;
	}
	if (caixaSaldoReal) {
        const saldoLíquido = (statusHoje.totalValor || 0) + (statusHoje.fundoTroco || 0) - (statusHoje.totalSaidas || 0);
		caixaSaldoReal.textContent = `R$ ${saldoLíquido.toFixed(2)}`;
	}

	// Breakdown
	const b = statusHoje.breakdown;
	if (caixaValorPix) caixaValorPix.textContent = `R$ ${(b['Pix'] || 0).toFixed(2)}`;
	if (caixaValorDinheiro) caixaValorDinheiro.textContent = `R$ ${(b['Dinheiro'] || 0).toFixed(2)}`;
	if (caixaValorCredito) caixaValorCredito.textContent = `R$ ${(b['Cartão de Crédito'] || 0).toFixed(2)}`;
	if (caixaValorDebito) caixaValorDebito.textContent = `R$ ${(b['Cartão de Débito'] || 0).toFixed(2)}`;
	if (caixaValorPrazo) caixaValorPrazo.textContent = `R$ ${(b['A Prazo / Fiado'] || 0).toFixed(2)}`;

	// Renderizar lista de recebimentos de hoje
	renderizarRecebimentosHoje(hoje);

	// Renderizar histórico de fechamentos
	renderizarHistoricoFechamentos();
}

function renderizarRecebimentosHoje(dataHoje) {
	if (!corpoRecebimentosHoje) return;

	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const saidas = CaixaService.getSaidasDia(dataHoje) || [];
	const hoje = dataHoje || obterDataHojeISO();

	const pedidosHoje = pedidos.filter((p) => {
		const dataRef = p.dataEncerramento || p.data;
		const estaEncerrado = !p.status || p.status === 'encerrado';
		return dataRef === hoje && estaEncerrado;
	}).map(p => ({
        tipo: 'entrada',
        horario: p.horaEncerramento || p.horaEntrada || '--:--',
        timestamp: p.dataEncerramento + 'T' + (p.horaEncerramento || p.horaEntrada || '00:00') + ':00',
        valor: parseFloat(p.valor || 0),
        descricao: p.servicos,
        cliente: p.cliente,
        forma: p.formaPagamento || 'Outro',
        cor: p.cor,
        modelo: p.modelo,
        placa: p.placa,
        id: p.id
    }));

    const saidasHoje = saidas.map(s => ({
        tipo: 'saida',
        horario: s.hora || '--:--',
        timestamp: s.timestamp,
        valor: parseFloat(s.valor || 0),
        descricao: s.descricao,
        cliente: '-',
        forma: s.categoria,
        id: s.id
    }));

    let movimentacoes = [...pedidosHoje, ...saidasHoje];
    // sort by timestamp or horario (descending)
    movimentacoes.sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);

	corpoRecebimentosHoje.innerHTML = '';

	if (movimentacoes.length === 0) {
		corpoRecebimentosHoje.innerHTML = `
			<tr>
				<td colspan="6" class="empty-table-message">
					Nenhuma movimentação registrada hoje até o momento.
				</td>
			</tr>
		`;
		return;
	}

	movimentacoes.forEach((m) => {
		const tr = document.createElement('tr');
		const valorFormatado = m.valor.toFixed(2);
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		
        if (m.tipo === 'entrada') {
            const corObj = obterCorVeiculo(m.cor);
            const modeloTexto = m.modelo ? ` • ${esc(m.modelo)}` : '';
            tr.innerHTML = `
                <td><small style="font-weight:600; color:var(--text-muted);">${esc(m.horario)}</small></td>
                <td><span class="badge" style="background: rgba(22,163,74,0.1); color: var(--success); border-color: rgba(22,163,74,0.2);">Entrada (O.S.)</span></td>
                <td>
                    <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-main); margin-bottom: 4px;">Cliente: ${esc(m.cliente || 'Não informado')}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">Serviços: ${esc(m.descricao || '-')}</div>
                    <div class="veiculo-info-cell">
                        ${renderizarIconeCarro(corObj, 22)}
                        <div class="veiculo-meta">
                            <span class="badge-placa" style="font-size: 0.65rem;">${esc(m.placa || 'SEM PLACA')}</span>
                            <span class="veiculo-cor-nome" style="font-size: 0.75rem;">${esc(corObj.nome)}${modeloTexto}</span>
                        </div>
                    </div>
                </td>
                <td><span class="badge-price" style="color: var(--success);">+ R$ ${valorFormatado}</span></td>
                <td><span class="badge badge-payment">${esc(m.forma)}</span></td>
                <td><a href="pedidos.html" class="btn btn-sm btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;">Ver O.S.</a></td>
            `;
        } else {
            tr.innerHTML = `
                <td><small style="font-weight:600; color:var(--text-muted);">${esc(m.horario)}</small></td>
                <td><span class="badge" style="background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.2);">Saída / Sangria</span></td>
                <td><span style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">${esc(m.descricao)}</span></td>
                <td><span class="badge-price" style="color: #ef4444; background: rgba(239,68,68,0.05);">- R$ ${valorFormatado}</span></td>
                <td><span class="badge" style="border: 1px solid #d1d5db; color: #4b5563;">${esc(m.forma)}</span></td>
                <td><button type="button" class="btn btn-sm" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid #ef4444; color: #ef4444;" onclick="removerSaidaGlobal('${m.id}')">Excluir</button></td>
            `;
        }
		corpoRecebimentosHoje.appendChild(tr);
	});
}

function renderizarHistoricoFechamentos() {
	if (!corpoHistoricoCaixas) return;

	const fechamentos = CaixaService.getHistoricoFechamentos();
	corpoHistoricoCaixas.innerHTML = '';

	if (fechamentos.length === 0) {
		corpoHistoricoCaixas.innerHTML = `
			<tr>
				<td colspan="9" class="empty-table-message">
					Nenhum caixa anterior fechado no histórico ainda. Quando o caixa do dia for fechado (manualmente ou pela virada automática de dia), o resumo consolidado ficará arquivado aqui.
				</td>
			</tr>
		`;
		return;
	}

	fechamentos.forEach((f) => {
		const tr = document.createElement('tr');
		const totalArrecadado = parseFloat(f.totalValor || 0).toFixed(2);
		const totalSaidas = parseFloat(f.totalSaidas || 0).toFixed(2);
		const saldoFinal = (parseFloat(f.totalValor || 0) + parseFloat(f.fundoTroco || 0) - parseFloat(f.totalSaidas || 0)).toFixed(2);
		const pix = parseFloat((f.breakdown && f.breakdown['Pix']) || 0).toFixed(2);
		const dinheiro = parseFloat((f.breakdown && f.breakdown['Dinheiro']) || 0).toFixed(2);
		const cartoes = (
			parseFloat((f.breakdown && f.breakdown['Cartão de Crédito']) || 0) +
			parseFloat((f.breakdown && f.breakdown['Cartão de Débito']) || 0)
		).toFixed(2);

		const badgeTipo = f.automatico
			? '<span class="badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">🤖 Auto (Virada)</span>'
			: '<span class="badge" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">🔒 Fechado</span>';

		const obs = f.observacoes || (f.motivoFechamento ? f.motivoFechamento : '-');

		tr.innerHTML = `
			<td><strong>${formatarDataBR(f.data)}</strong></td>
			<td>${badgeTipo}</td>
			<td>${f.horaFechamento || '--:--'}</td>
			<td><strong>${f.totalServicos || 0}</strong></td>
			<td><span class="badge-price" style="font-size:0.95rem; color: var(--success);">+ R$ ${totalArrecadado}</span></td>
			<td><span class="badge-price" style="font-size:0.95rem; color: #ef4444; background: rgba(239,68,68,0.05);">- R$ ${totalSaidas}</span></td>
			<td><span class="badge-price" style="font-size:0.95rem;">R$ ${saldoFinal}</span></td>
			<td>R$ ${pix}</td>
			<td>R$ ${dinheiro}</td>
			<td>R$ ${cartoes}</td>
			<td><small style="color:var(--text-muted);">${obs}</small></td>
		`;
		corpoHistoricoCaixas.appendChild(tr);
	});
}

// Controle do Modal de Saída
function abrirModalSaida() {
	if (document.getElementById('modalSaidaValorInput')) document.getElementById('modalSaidaValorInput').value = '';
	if (document.getElementById('modalSaidaCategoria')) document.getElementById('modalSaidaCategoria').value = '';
	if (document.getElementById('modalSaidaDescricao')) document.getElementById('modalSaidaDescricao').value = '';
	modalSaidaCaixa.classList.add('open');
}

function fecharModalSaida() {
	modalSaidaCaixa.classList.remove('open');
}

if (btnAbrirModalSaida) btnAbrirModalSaida.addEventListener('click', abrirModalSaida);
if (modalSaidaCaixaX) modalSaidaCaixaX.addEventListener('click', fecharModalSaida);
if (modalCancelarSaidaBtn) modalCancelarSaidaBtn.addEventListener('click', fecharModalSaida);

if (formRegistrarSaidaCaixa) {
	formRegistrarSaidaCaixa.addEventListener('submit', (e) => {
		e.preventDefault();
		const valor = document.getElementById('modalSaidaValorInput').value;
		const categoria = document.getElementById('modalSaidaCategoria').value;
		const descricao = document.getElementById('modalSaidaDescricao').value;

		if (!valor || !categoria || !descricao) return;

		CaixaService.registrarSaida(valor, categoria, descricao);
		fecharModalSaida();
		carregarDadosCaixa();
	});
}

// Controle do Modal de Fechamento de Caixa
function abrirModalFechamento() {
	const statusHoje = CaixaService.getStatusHoje();
	if (modalDataHojeTexto) modalDataHojeTexto.textContent = formatarDataBR(statusHoje.data);
	if (modalResumoAtendimentos) modalResumoAtendimentos.textContent = statusHoje.totalServicos;
	if (modalResumoValor) modalResumoValor.textContent = `R$ ${statusHoje.totalValor.toFixed(2)}`;
	if (modalFundoTrocoInput) modalFundoTrocoInput.value = (statusHoje.fundoTroco || 0).toFixed(2);
	if (modalObservacoesFechamento) modalObservacoesFechamento.value = '';

	modalFecharCaixa.classList.add('open');
}

function fecharModalFechamento() {
	modalFecharCaixa.classList.remove('open');
}

if (btnAbrirModalFecharCaixa) btnAbrirModalFecharCaixa.addEventListener('click', abrirModalFechamento);
if (modalFecharCaixaX) modalFecharCaixaX.addEventListener('click', fecharModalFechamento);
if (modalCancelarFechamentoBtn) modalCancelarFechamentoBtn.addEventListener('click', fecharModalFechamento);

if (formConfirmarFechamentoCaixa) {
	formConfirmarFechamentoCaixa.addEventListener('submit', (e) => {
		e.preventDefault();
		const fundoTroco = parseFloat(modalFundoTrocoInput.value) || 0;
		const obs = modalObservacoesFechamento.value.trim();

		CaixaService.fecharCaixaHoje(fundoTroco, obs);
		fecharModalFechamento();
		carregarDadosCaixa();
	});
}

// Controle do Modal de Reabertura de Caixa
function abrirModalReabrir() {
	if (modalReabrirCaixa) modalReabrirCaixa.classList.add('open');
}

function fecharModalReabrir() {
	if (modalReabrirCaixa) modalReabrirCaixa.classList.remove('open');
}

if (btnReabrirCaixa) btnReabrirCaixa.addEventListener('click', abrirModalReabrir);
if (modalReabrirCaixaX) modalReabrirCaixaX.addEventListener('click', fecharModalReabrir);
if (modalCancelarReabrirBtn) modalCancelarReabrirBtn.addEventListener('click', fecharModalReabrir);

if (btnConfirmarReabrirCaixaModal) {
	btnConfirmarReabrirCaixaModal.addEventListener('click', () => {
		CaixaService.reabrirCaixaHoje();
		fecharModalReabrir();
		carregarDadosCaixa();
	});
}

// Controle do Modal de Exclusão de Saída
function abrirModalExcluirSaida(id) {
	idSaidaParaExcluir = id;
	if (modalConfirmarExclusaoSaida) modalConfirmarExclusaoSaida.classList.add('open');
}

function fecharModalExcluirSaida() {
	idSaidaParaExcluir = null;
	if (modalConfirmarExclusaoSaida) modalConfirmarExclusaoSaida.classList.remove('open');
}

if (modalExcluirSaidaX) modalExcluirSaidaX.addEventListener('click', fecharModalExcluirSaida);
if (modalCancelarExcluirSaidaBtn) modalCancelarExcluirSaidaBtn.addEventListener('click', fecharModalExcluirSaida);

if (btnConfirmarExclusaoSaidaModal) {
	btnConfirmarExclusaoSaidaModal.addEventListener('click', () => {
		if (idSaidaParaExcluir) {
			CaixaService.removerSaida(idSaidaParaExcluir);
			fecharModalExcluirSaida();
			carregarDadosCaixa();
		}
	});
}

window.removerSaidaGlobal = function(id) {
	abrirModalExcluirSaida(id);
};

document.addEventListener('DOMContentLoaded', () => {
	carregarDadosCaixa();
});
