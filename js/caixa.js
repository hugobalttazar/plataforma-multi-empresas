// ==========================================================================
// Lógica do Livro Caixa, Fechamento Diário, Contas, Frotas e Pacotes
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
const caixaValorFaturadoDia = document.getElementById('caixaValorFaturadoDia');

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

// Modal de Baixa de Conta
const modalBaixaConta = document.getElementById('modalBaixaConta');
const modalBaixaContaX = document.getElementById('modalBaixaContaX');
const modalCancelarBaixaContaBtn = document.getElementById('modalCancelarBaixaContaBtn');
const formConfirmarBaixaConta = document.getElementById('formConfirmarBaixaConta');
const modalBaixaContaResumo = document.getElementById('modalBaixaContaResumo');
const grupoFormaBaixaConta = document.getElementById('grupoFormaBaixaConta');
const modalBaixaContaFormaPgto = document.getElementById('modalBaixaContaFormaPgto');
let idContaParaBaixar = null;

// Modal de Histórico de Uso do Pacote
const modalHistoricoPacote = document.getElementById('modalHistoricoPacote');
const modalHistoricoPacoteX = document.getElementById('modalHistoricoPacoteX');
const modalFecharHistoricoPacoteBtn = document.getElementById('modalFecharHistoricoPacoteBtn');
const modalHistoricoPacoteCabecalho = document.getElementById('modalHistoricoPacoteCabecalho');
const corpoHistoricoUsoPacote = document.getElementById('corpoHistoricoUsoPacote');

function esc(s) {
	if (typeof window.escapeHTML === 'function') return window.escapeHTML(s);
	return String(s || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function notify(msg, type = 'info') {
	if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
		UI.toast(msg, type);
	}
}

async function confirmarAcao({ title, message, confirmText = 'Confirmar', danger = false }) {
	if (typeof UI !== 'undefined' && typeof UI.confirm === 'function') {
		return await UI.confirm({ title, message, confirmText, danger });
	}
	return true;
}

function formatarDataBR(dataISO) {
	if (!dataISO) return '--/--/----';
	const partes = String(dataISO).split('-');
	if (partes.length === 3) {
		return `${partes[2]}/${partes[1]}/${partes[0]}`;
	}
	return dataISO;
}

function formatarMoeda(valor) {
	const num = parseFloat(valor || 0) || 0;
	return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

// ==========================================================================
// Controle de Abas do Módulo Financeiro
// ==========================================================================
function ativarAbaCaixa(aba) {
	if (aba === 'pacotes' && window.AuthService && typeof window.AuthService.hasPermission === 'function' && !window.AuthService.hasPermission('pacotes')) {
		aba = 'caixa';
	}
	const mapa = {
		caixa: { btn: 'tabCaixaDiaBtn', view: 'viewCaixaDia' },
		contas: { btn: 'tabContasBtn', view: 'viewContas' },
		faturamento: { btn: 'tabFaturamentoBtn', view: 'viewFaturamento' },
		pacotes: { btn: 'tabPacotesBtn', view: 'viewPacotes' }
	};
	const alvo = mapa[aba] ? aba : 'caixa';

	Object.entries(mapa).forEach(([chave, cfg]) => {
		const btn = document.getElementById(cfg.btn);
		const view = document.getElementById(cfg.view);
		if (btn) btn.classList.toggle('active', chave === alvo);
		if (view) view.style.display = chave === alvo ? 'block' : 'none';
	});

	if (alvo === 'contas') carregarContasFinanceiras();
	if (alvo === 'faturamento') carregarFaturamentoFrotas();
	if (alvo === 'pacotes') carregarPacotesModule();
}

function inicializarAbasCaixa() {
	const container = document.getElementById('caixaTabsContainer');
	if (container) {
		container.querySelectorAll('.tab-button[data-tab]').forEach((btn) => {
			btn.addEventListener('click', () => {
				ativarAbaCaixa(btn.dataset.tab);
			});
		});
	}

	const params = new URLSearchParams(window.location.search);
	const abaInicial = params.get('aba') || 'caixa';
	ativarAbaCaixa(abaInicial);
}

// ==========================================================================
// Aba 1: Caixa do Dia e Livro Caixa
// ==========================================================================
function atualizarBadgesAbas() {
	const badgeContas = document.getElementById('badgeQtdContasAlerta');
	if (badgeContas && typeof CaixaService.getAlertasVencimento === 'function') {
		const alertas = CaixaService.getAlertasVencimento(3);
		badgeContas.textContent = alertas.qtdAlerta;
		badgeContas.style.display = alertas.qtdAlerta > 0 ? 'inline-flex' : 'none';
	}

	const badgeFaturas = document.getElementById('badgeQtdFaturasPendentes');
	if (badgeFaturas && typeof FaturamentoService !== 'undefined') {
		const pendentes = FaturamentoService.getPedidosFaturados({ status: 'pendente' });
		badgeFaturas.textContent = pendentes.length;
		badgeFaturas.style.display = pendentes.length > 0 ? 'inline-flex' : 'none';
	}

	const badgePacotes = document.getElementById('badgeQtdPacotesAtivos');
	if (badgePacotes && typeof PacotesService !== 'undefined') {
		const ativos = PacotesService.getAssinaturas().filter(
			(a) => PacotesService.getStatusAssinatura(a) === 'ativo'
		);
		badgePacotes.textContent = ativos.length;
	}
}

function carregarDadosCaixa() {
	const statusHoje = CaixaService.getStatusHoje();
	const hoje = statusHoje.data;

	if (dataCaixaHoje) {
		dataCaixaHoje.textContent = formatarDataBR(hoje);
	}

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

	if (caixaTotalEntradas) {
		caixaTotalEntradas.textContent = `R$ ${(statusHoje.totalValor || 0).toFixed(2)}`;
	}
	if (caixaTotalSaidas) {
		caixaTotalSaidas.textContent = `R$ ${(statusHoje.totalSaidas || 0).toFixed(2)}`;
	}
	if (caixaSaldoReal) {
		const saldoLiquido = (statusHoje.totalValor || 0) + (statusHoje.fundoTroco || 0) - (statusHoje.totalSaidas || 0);
		caixaSaldoReal.textContent = `R$ ${saldoLiquido.toFixed(2)}`;
	}

	const b = statusHoje.breakdown || {};
	if (caixaValorPix) caixaValorPix.textContent = `R$ ${(b['Pix'] || 0).toFixed(2)}`;
	if (caixaValorDinheiro) caixaValorDinheiro.textContent = `R$ ${(b['Dinheiro'] || 0).toFixed(2)}`;
	if (caixaValorCredito) caixaValorCredito.textContent = `R$ ${(b['Cartão de Crédito'] || 0).toFixed(2)}`;
	if (caixaValorDebito) caixaValorDebito.textContent = `R$ ${(b['Cartão de Débito'] || 0).toFixed(2)}`;
	if (caixaValorPrazo) caixaValorPrazo.textContent = `R$ ${(b['A Prazo / Fiado'] || 0).toFixed(2)}`;
	if (caixaValorFaturadoDia) caixaValorFaturadoDia.textContent = `R$ ${(statusHoje.totalFaturadoDia || 0).toFixed(2)}`;

	renderizarRecebimentosHoje(hoje);
	renderizarHistoricoFechamentos();

	const bannerCom = document.getElementById('bannerComissoesPendentes');
	if (bannerCom && typeof EquipeService !== 'undefined' && typeof EquipeService.getResumoComissoesPendentes === 'function') {
		const resumoCom = EquipeService.getResumoComissoesPendentes();
		if (resumoCom.totalPendente > 0) {
			bannerCom.style.display = 'flex';
			bannerCom.innerHTML = `
				<div>
					<strong>💸 Comissões Pendentes da Equipe:</strong>
					<span>R$ ${resumoCom.totalPendente.toFixed(2)} (${resumoCom.totalServicosPendentes} O.S. em aberto para ${resumoCom.membrosPendentes.length} profissional(is))</span>
				</div>
				<a href="configuracoes.html?tab=equipe" class="btn btn-sm btn-primary" style="text-decoration:none; white-space:nowrap;">
					Pagar / Conferir Comissões
				</a>
			`;
		} else {
			bannerCom.style.display = 'none';
		}
	}

	atualizarBadgesAbas();
	carregarContasFinanceiras();
	carregarFaturamentoFrotas();
	carregarPacotesModule();
}

window.carregarDadosCaixa = carregarDadosCaixa;

function renderizarRecebimentosHoje(dataHoje) {
	if (!corpoRecebimentosHoje) return;

	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const saidas = CaixaService.getSaidasDia(dataHoje) || [];
	const entradasAvulsas = typeof CaixaService.getEntradasDia === 'function'
		? CaixaService.getEntradasDia(dataHoje)
		: [];
	const hoje = dataHoje || obterDataHojeISO();

	const pedidosHoje = pedidos.filter((p) => {
		const dataRef = p.dataEncerramento || p.data;
		const estaEncerrado = !p.status || p.status === 'encerrado';
		return dataRef === hoje && estaEncerrado;
	}).map((p) => ({
		tipo: 'os',
		horario: p.horaEncerramento || p.horaEntrada || '--:--',
		timestamp: (p.dataEncerramento || p.data || hoje) + 'T' + (p.horaEncerramento || p.horaEntrada || '00:00') + ':00',
		valor: parseFloat(p.valor || 0),
		descricao: p.servicos,
		cliente: p.cliente,
		forma: p.formaPagamento || 'Outro',
		cor: p.cor,
		modelo: p.modelo,
		placa: p.placa,
		id: p.id
	}));

	const entradasHoje = entradasAvulsas.map((e) => ({
		tipo: 'entrada_avulsa',
		origem: e.origem || 'avulso',
		categoria: e.categoria || 'Entrada',
		horario: e.hora || '--:--',
		timestamp: e.timestamp || `${hoje}T00:00:00`,
		valor: parseFloat(e.valor || 0),
		descricao: e.descricao || e.categoria,
		cliente: e.cliente || '-',
		forma: e.formaPagamento || 'Pix',
		id: e.id
	}));

	const saidasHoje = saidas.map((s) => ({
		tipo: 'saida',
		horario: s.hora || '--:--',
		timestamp: s.timestamp || `${hoje}T00:00:00`,
		valor: parseFloat(s.valor || 0),
		descricao: s.descricao,
		cliente: '-',
		forma: s.categoria,
		id: s.id
	}));

	const movimentacoes = [...pedidosHoje, ...entradasHoje, ...saidasHoje];
	movimentacoes.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

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

		if (m.tipo === 'os') {
			const corObj = obterCorVeiculo(m.cor);
			const modeloTexto = m.modelo ? ` • ${esc(m.modelo)}` : '';
			const isFaturado = m.forma === 'Faturado / A Receber';
			const isPacote = m.forma === 'Pacote / Crédito';

			const badgeOp = isFaturado
				? '<span class="badge badge-tone-amber">Faturado (A Receber)</span>'
				: isPacote
					? '<span class="badge badge-tone-purple">Abatido Pacote</span>'
					: '<span class="badge badge-tone-green">Entrada (O.S.)</span>';

			const valorCol = isFaturado
				? `<span class="badge-price badge-tone-amber" title="Não somado ao caixa até a baixa da fatura">⏳ R$ ${valorFormatado}</span>`
				: `<span class="badge-price" style="color: var(--success);">+ R$ ${valorFormatado}</span>`;

			tr.innerHTML = `
				<td><small style="font-weight:600; color:var(--text-muted);">${esc(m.horario)}</small></td>
				<td>${badgeOp}</td>
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
				<td>${valorCol}</td>
				<td><span class="badge badge-payment">${esc(m.forma)}</span></td>
				<td><a href="pedidos.html" class="btn btn-sm btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;">Ver O.S.</a></td>
			`;
		} else if (m.tipo === 'entrada_avulsa') {
			const rotuloOrigem = m.origem === 'pacote'
				? 'Entrada (Pacote)'
				: m.origem === 'faturamento'
					? 'Entrada (Frota)'
					: m.origem === 'conta_receber'
						? 'Entrada (Conta)'
						: 'Entrada Avulsa';

			tr.innerHTML = `
				<td><small style="font-weight:600; color:var(--text-muted);">${esc(m.horario)}</small></td>
				<td><span class="badge" style="background: rgba(22,163,74,0.1); color: var(--success); border-color: rgba(22,163,74,0.2);">${esc(rotuloOrigem)}</span></td>
				<td>
					<div style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">${esc(m.descricao)}</div>
					<small style="color:var(--text-muted);">${esc(m.categoria)}${m.cliente && m.cliente !== '-' ? ' • Cliente: ' + esc(m.cliente) : ''}</small>
				</td>
				<td><span class="badge-price" style="color: var(--success);">+ R$ ${valorFormatado}</span></td>
				<td><span class="badge badge-payment">${esc(m.forma)}</span></td>
				<td><span style="font-size:0.75rem; color:var(--text-muted);">Consolidado</span></td>
			`;
		} else {
			tr.innerHTML = `
				<td><small style="font-weight:600; color:var(--text-muted);">${esc(m.horario)}</small></td>
				<td><span class="badge" style="background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.2);">Saída / Sangria</span></td>
				<td><span style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">${esc(m.descricao)}</span></td>
				<td><span class="badge-price" style="color: #ef4444; background: rgba(239,68,68,0.05);">- R$ ${valorFormatado}</span></td>
				<td><span class="badge" style="border: 1px solid #d1d5db; color: #4b5563;">${esc(m.forma)}</span></td>
				<td><button type="button" class="btn btn-sm" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid #ef4444; color: #ef4444;" onclick="removerSaidaGlobal('${esc(m.id)}')">Excluir</button></td>
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
				<td colspan="11" class="empty-table-message">
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
			? '<span class="badge badge-tone-blue">🤖 Auto (Virada)</span>'
			: '<span class="badge badge-tone-slate">🔒 Fechado</span>';

		const obs = esc(f.observacoes || (f.motivoFechamento ? f.motivoFechamento : '-'));

		tr.innerHTML = `
			<td><strong>${esc(formatarDataBR(f.data))}</strong></td>
			<td>${badgeTipo}</td>
			<td>${esc(f.horaFechamento || '--:--')}</td>
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

// ==========================================================================
// Aba 2: Contas a Pagar e a Receber
// ==========================================================================
function resetarFormConta() {
	const form = document.getElementById('formNovaConta');
	if (form) form.reset();
	const editId = document.getElementById('contaEditId');
	if (editId) editId.value = '';
	const titulo = document.getElementById('tituloFormConta');
	if (titulo) titulo.textContent = '➕ Novo Lançamento (Conta a Pagar ou Receber)';
	const btnCancelar = document.getElementById('btnCancelarEditConta');
	if (btnCancelar) btnCancelar.style.display = 'none';
}

function carregarContasFinanceiras() {
	if (typeof CaixaService.getContasComStatus !== 'function') return;

	const todasAbertas = CaixaService.getContasComStatus({ status: 'aberto' });
	const totalPagar = todasAbertas
		.filter((c) => c.tipo === 'pagar')
		.reduce((acc, c) => acc + (parseFloat(c.valor || 0) || 0), 0);
	const totalReceber = todasAbertas
		.filter((c) => c.tipo === 'receber')
		.reduce((acc, c) => acc + (parseFloat(c.valor || 0) || 0), 0);
	const qtdVencidas = todasAbertas.filter(
		(c) => c.statusEfetivo === 'vencido' || c.statusEfetivo === 'vence_hoje'
	).length;

	const elPagar = document.getElementById('contasTotalPagar');
	const elReceber = document.getElementById('contasTotalReceber');
	const elVenc = document.getElementById('contasQtdVencidas');
	if (elPagar) elPagar.textContent = formatarMoeda(totalPagar);
	if (elReceber) elReceber.textContent = formatarMoeda(totalReceber);
	if (elVenc) elVenc.textContent = String(qtdVencidas);

	const tbody = document.getElementById('corpoContasFinanceiras');
	if (!tbody) return;

	const filtroTipo = (document.getElementById('filtroContasTipo') || {}).value || 'todos';
	const filtroStatus = (document.getElementById('filtroContasStatus') || {}).value || 'aberto';
	const lista = CaixaService.getContasComStatus({ tipo: filtroTipo, status: filtroStatus });

	tbody.innerHTML = '';
	if (lista.length === 0) {
		tbody.innerHTML = `
			<tr>
				<td colspan="6" class="empty-table-message">Nenhuma conta encontrada para os filtros selecionados.</td>
			</tr>
		`;
		return;
	}

	lista.forEach((c) => {
		const tr = document.createElement('tr');
		const tipoBadge = c.tipo === 'receber'
			? '<span class="badge badge-tone-green">📥 Receber</span>'
			: '<span class="badge badge-tone-red">📤 Pagar</span>';

		let statusBadge = '<span class="badge badge-tone-blue">⏳ Pendente</span>';
		if (c.statusEfetivo === 'pago') {
			statusBadge = `<span class="badge badge-tone-green">✅ Pago em ${esc(formatarDataBR(c.dataPagamento))}</span>`;
		} else if (c.statusEfetivo === 'vencido') {
			statusBadge = '<span class="badge badge-tone-red">🚨 Vencido</span>';
		} else if (c.statusEfetivo === 'vence_hoje') {
			statusBadge = '<span class="badge badge-tone-amber">⚠️ Vence Hoje</span>';
		}

		const valorColor = c.tipo === 'receber' ? 'var(--success)' : '#dc2626';
		const sinal = c.tipo === 'receber' ? '+' : '-';

		const btnBaixa = c.statusEfetivo !== 'pago'
			? `<button type="button" class="btn btn-sm" style="background:var(--success); color:#fff; padding:4px 8px; font-size:0.75rem;" data-acao="baixar" data-id="${esc(c.id)}">💰 Baixar</button>`
			: '';

		tr.innerHTML = `
			<td><strong>${esc(formatarDataBR(c.vencimento))}</strong></td>
			<td>${tipoBadge}</td>
			<td>
				<div style="font-weight:600; color:var(--text-main);">${esc(c.descricao)}</div>
				<small style="color:var(--text-muted);">${esc(c.categoria)}${c.pessoa ? ' • ' + esc(c.pessoa) : ''}${c.observacao ? ' • ' + esc(c.observacao) : ''}</small>
			</td>
			<td>${statusBadge}</td>
			<td><span class="badge-price" style="color:${valorColor};">${sinal} ${formatarMoeda(c.valor)}</span></td>
			<td style="text-align:center;">
				<div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:center;">
					${btnBaixa}
					<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.75rem;" data-acao="editar" data-id="${esc(c.id)}" title="Editar">✏️</button>
					<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:0.75rem; background:transparent; border:1px solid #ef4444; color:#ef4444;" data-acao="excluir" data-id="${esc(c.id)}" title="Excluir">🗑️</button>
				</div>
			</td>
		`;
		tbody.appendChild(tr);
	});
}

function abrirModalBaixaConta(id) {
	const conta = CaixaService.getContas().find((c) => String(c.id) === String(id));
	if (!conta || conta.status === 'pago') return;

	idContaParaBaixar = conta.id;
	if (modalBaixaContaResumo) {
		const acaoTexto = conta.tipo === 'pagar'
			? 'Registrar <strong>saída no Caixa de hoje</strong> referente ao pagamento de:'
			: 'Registrar <strong>entrada no Caixa de hoje</strong> referente ao recebimento de:';
		modalBaixaContaResumo.innerHTML = `
			${acaoTexto}<br><br>
			<strong>${esc(conta.descricao)}</strong>${conta.pessoa ? ' (' + esc(conta.pessoa) + ')' : ''}<br>
			Valor: <strong style="color:${conta.tipo === 'receber' ? 'var(--success)' : '#dc2626'};">${formatarMoeda(conta.valor)}</strong>
		`;
	}
	if (grupoFormaBaixaConta) {
		grupoFormaBaixaConta.style.display = conta.tipo === 'receber' ? 'flex' : 'none';
	}
	if (modalBaixaConta) modalBaixaConta.classList.add('open');
}

function fecharModalBaixaConta() {
	idContaParaBaixar = null;
	if (modalBaixaConta) modalBaixaConta.classList.remove('open');
}

// ==========================================================================
// Aba 3: Faturamento Agrupado para Frotas / Empresas
// ==========================================================================
function getFiltrosFaturamento() {
	return {
		clienteNome: (document.getElementById('fatFiltroCliente') || {}).value || '',
		status: (document.getElementById('fatFiltroStatus') || {}).value || 'pendente',
		dataInicio: (document.getElementById('fatFiltroDataInicio') || {}).value || '',
		dataFim: (document.getElementById('fatFiltroDataFim') || {}).value || '',
		placa: (document.getElementById('fatFiltroPlaca') || {}).value || ''
	};
}

function atualizarResumoSelecaoFaturamento() {
	const checks = Array.from(document.querySelectorAll('.chk-fatura-os:checked'));
	const total = checks.reduce((acc, el) => acc + (parseFloat(el.dataset.valor || 0) || 0), 0);
	const elQtd = document.getElementById('fatQtdSelecionada');
	const elVal = document.getElementById('fatValorSelecionado');
	if (elQtd) elQtd.textContent = String(checks.length);
	if (elVal) elVal.textContent = formatarMoeda(total);
}

function carregarFaturamentoFrotas() {
	if (typeof FaturamentoService === 'undefined') return;

	const clientesFat = FaturamentoService.getClientesComFaturamento();
	const grid = document.getElementById('gridClientesFaturamento');
	if (grid) {
		if (clientesFat.length === 0) {
			grid.innerHTML = `
				<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.9rem; padding: 8px 0;">
					Nenhuma O.S. encerrada como <strong>Faturado / A Receber</strong> até o momento. Encerre uma O.S. selecionando essa forma de pagamento para consolidar frotas aqui.
				</div>
			`;
		} else {
			grid.innerHTML = clientesFat.map((c) => `
				<button type="button" class="stat-card btn-card-frota" data-cliente="${esc(c.clienteNome)}" style="text-align:left; cursor:pointer; border:1px solid ${c.valorPendente > 0 ? '#f59e0b' : 'var(--border-color)'}; width:100%; background:var(--bg-card);">
					<div class="stat-info" style="width:100%;">
						<div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
							<strong style="font-size:0.95rem; color:var(--text-main);">${esc(c.clienteNome)}</strong>
							<span class="badge badge-tone-amber" style="font-size:0.7rem;">${c.placasLista.length} placa(s)</span>
						</div>
						<div style="margin-top:6px; font-size:1.05rem; font-weight:800; color:${c.valorPendente > 0 ? '#b45309' : 'var(--success)'};">
							${formatarMoeda(c.valorPendente)} <small style="font-weight:500; font-size:0.78rem; color:var(--text-muted);">(${c.qtdPendente} pendente(s))</small>
						</div>
						<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
							Já quitado: ${formatarMoeda(c.valorPago)} (${c.qtdPago} O.S.)
						</div>
					</div>
				</button>
			`).join('');
		}
	}

	const selectCliente = document.getElementById('fatFiltroCliente');
	if (selectCliente) {
		const valorAtual = selectCliente.value;
		selectCliente.innerHTML = '<option value="">Todos os clientes faturados</option>';
		clientesFat.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.clienteNome;
			opt.textContent = `${c.clienteNome} (${c.qtdPendente} pendente(s))`;
			selectCliente.appendChild(opt);
		});
		if (valorAtual && clientesFat.some((c) => c.clienteNome === valorAtual)) {
			selectCliente.value = valorAtual;
		}
	}

	const tbody = document.getElementById('corpoFaturamentoFrotas');
	if (!tbody) return;

	const filtros = getFiltrosFaturamento();
	const ordens = FaturamentoService.getPedidosFaturados(filtros);

	const chkTodos = document.getElementById('chkSelecionarTodasFaturas');
	if (chkTodos) chkTodos.checked = false;

	tbody.innerHTML = '';
	if (ordens.length === 0) {
		tbody.innerHTML = `
			<tr>
				<td colspan="7" class="empty-table-message">Nenhuma O.S. faturada encontrada para os filtros selecionados.</td>
			</tr>
		`;
		atualizarResumoSelecaoFaturamento();
		return;
	}

	ordens.forEach((p) => {
		const tr = document.createElement('tr');
		const statusFat = FaturamentoService.getStatusFaturamentoPedido(p);
		const numOS = (p.id || '').replace(/^os_/, '').slice(-6) || '000001';
		const dataFmt = formatarDataBR(p.dataEncerramento || p.data);
		const valorNum = parseFloat(p.valor || 0) || 0;

		const badgeStatus = statusFat === 'pago'
			? `<span class="badge badge-tone-green">✅ Quitado${p.dataPagamentoFatura ? ' (' + esc(formatarDataBR(p.dataPagamentoFatura)) + ')' : ''}</span>`
			: '<span class="badge badge-tone-amber">⏳ A Receber</span>';

		tr.innerHTML = `
			<td style="text-align:center;">
				<input type="checkbox" class="chk-fatura-os" value="${esc(p.id)}" data-valor="${valorNum}" data-status="${esc(statusFat)}" />
			</td>
			<td>
				<strong>#${esc(numOS)}</strong><br>
				<small style="color:var(--text-muted);">${esc(dataFmt)}</small>
			</td>
			<td><strong>${esc(p.cliente || 'Não informado')}</strong></td>
			<td>
				<span class="badge-placa" style="font-size:0.72rem;">${esc(p.placa || 'SEM PLACA')}</span><br>
				<small style="color:var(--text-muted);">${esc(p.modelo || '-')}</small>
			</td>
			<td><small>${esc(p.servicos || '-')}</small></td>
			<td>${badgeStatus}</td>
			<td><span class="badge-price" style="color:${statusFat === 'pago' ? 'var(--success)' : '#b45309'};">${formatarMoeda(valorNum)}</span></td>
		`;
		tbody.appendChild(tr);
	});

	atualizarResumoSelecaoFaturamento();
}

function resolverPedidosAlvoExtrato() {
	if (typeof FaturamentoService === 'undefined') return [];
	const filtros = getFiltrosFaturamento();
	const ordens = FaturamentoService.getPedidosFaturados(filtros);
	const checkedIds = new Set(
		Array.from(document.querySelectorAll('.chk-fatura-os:checked')).map((el) => String(el.value))
	);
	if (checkedIds.size > 0) {
		return ordens.filter((p) => checkedIds.has(String(p.id)));
	}
	return ordens;
}

// ==========================================================================
// Aba 4: Pacotes e Planos de Serviços
// ==========================================================================
function obterServicosSelecionadosPlanoPacote() {
	const grid = document.getElementById('planoPacoteServicosGrid');
	if (!grid) return [];
	return Array.from(grid.querySelectorAll('.chk-servico-plano-pacote:checked'))
		.map((el) => String(el.value || '').trim())
		.filter(Boolean);
}

function atualizarBotaoLimparServicosPlano() {
	const btn = document.getElementById('btnLimparServicosPlano');
	if (!btn) return;
	const qtd = obterServicosSelecionadosPlanoPacote().length;
	btn.style.display = qtd > 0 ? 'inline-flex' : 'none';
}

function renderizarSeletorServicosPlanoPacote(selecionados = []) {
	const grid = document.getElementById('planoPacoteServicosGrid');
	if (!grid) return;

	const listaServicos = JSON.parse(localStorage.getItem('servicos')) || [];
	const selecionadosNorm = Array.isArray(selecionados)
		? selecionados.map((s) => String(s || '').trim()).filter(Boolean)
		: [];
	const setSelLower = new Set(selecionadosNorm.map((s) => s.toLowerCase()));
	const nomesCatalogoLower = new Set(listaServicos.map((s) => String(s?.nome || '').trim().toLowerCase()).filter(Boolean));

	const itensParaExibir = [...listaServicos];
	selecionadosNorm.forEach((nomeExtra) => {
		if (!nomesCatalogoLower.has(nomeExtra.toLowerCase())) {
			itensParaExibir.push({ nome: nomeExtra, preco: 0, legado: true });
		}
	});

	grid.innerHTML = '';
	if (itensParaExibir.length === 0) {
		grid.innerHTML = `
			<div style="grid-column: 1 / -1; font-size: 0.82rem; color: var(--text-muted);">
				Nenhum serviço cadastrado ainda. Cadastre em <a href="servicos.html" style="color: var(--primary); font-weight: 600;">Serviços</a> para vincular diretamente aos pacotes.
			</div>
		`;
		atualizarBotaoLimparServicosPlano();
		return;
	}

	itensParaExibir.forEach((s) => {
		const nome = String(s?.nome || '').trim();
		if (!nome) return;
		const preco = parseFloat(s.preco || 0) || 0;
		const marcado = setSelLower.has(nome.toLowerCase());

		const label = document.createElement('label');
		label.className = 'servico-pacote-option' + (marcado ? ' is-selected' : '');

		label.innerHTML = `
			<input type="checkbox" class="chk-servico-plano-pacote" value="${esc(nome)}" ${marcado ? 'checked' : ''}
				style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer;" />
			<div style="flex: 1; min-width: 0; line-height: 1.25;">
				<div style="font-size: 0.84rem; font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
					${esc(nome)}
				</div>
				<div class="${s.legado ? 'text-tone-red' : ''}" style="font-size: 0.75rem; ${s.legado ? '' : 'color: var(--text-muted);'}">
					${s.legado ? 'Não encontrado no catálogo atual' : `Avulso: ${formatarMoeda(preco)}`}
				</div>
			</div>
		`;

		const chk = label.querySelector('.chk-servico-plano-pacote');
		chk.addEventListener('change', () => {
			label.classList.toggle('is-selected', chk.checked);
			atualizarBotaoLimparServicosPlano();
		});

		grid.appendChild(label);
	});

	atualizarBotaoLimparServicosPlano();
}

function resetarFormPlanoPacote() {
	const form = document.getElementById('formNovoPlanoPacote');
	if (form) form.reset();
	const editId = document.getElementById('planoPacoteEditId');
	if (editId) editId.value = '';
	const titulo = document.getElementById('tituloFormPlanoPacote');
	if (titulo) titulo.textContent = '🎟️ Cadastrar Plano / Pacote de Serviços';
	const btnCancelar = document.getElementById('btnCancelarEditPlano');
	if (btnCancelar) btnCancelar.style.display = 'none';
	renderizarSeletorServicosPlanoPacote([]);
}

function carregarPacotesModule() {
	if (typeof PacotesService === 'undefined') return;

	const servicosAtualmenteMarcados = obterServicosSelecionadosPlanoPacote();
	renderizarSeletorServicosPlanoPacote(servicosAtualmenteMarcados);

	const planos = PacotesService.getPlanos();
	const tbodyPlanos = document.getElementById('corpoPlanosPacotes');
	if (tbodyPlanos) {
		tbodyPlanos.innerHTML = '';
		if (planos.length === 0) {
			tbodyPlanos.innerHTML = `
				<tr>
					<td colspan="6" class="empty-table-message">Nenhum plano cadastrado ainda. Crie pacotes como "4 Lavagens/Mês" acima.</td>
				</tr>
			`;
		} else {
			planos.forEach((p) => {
				const tr = document.createElement('tr');
				const ativo = p.ativo !== false;
				const badgeAtivo = ativo
					? '<span class="badge badge-tone-green">● Ativo</span>'
					: '<span class="badge badge-tone-slate">⏸ Inativo</span>';
				const servicosVinculados = Array.isArray(p.servicosInclusos) ? p.servicosInclusos : [];
				const badgesServicos = servicosVinculados.length > 0
					? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${servicosVinculados.map((sv) => `<span class="badge badge-tone-blue" style="font-size:0.72rem;">🏷️ ${esc(sv)}</span>`).join('')}</div>`
					: '';

				tr.innerHTML = `
					<td>
						<strong>${esc(p.nome)}</strong>
						${badgesServicos}
						${p.descricao ? `<div style="margin-top:3px;"><small style="color:var(--text-muted);">${esc(p.descricao)}</small></div>` : ''}
					</td>
					<td><strong>${p.creditos}</strong> crédito(s)</td>
					<td>${p.validadeDias} dia(s)</td>
					<td><span class="badge-price">${formatarMoeda(p.valor)}</span></td>
					<td>${badgeAtivo}</td>
					<td style="text-align:center;">
						<div style="display:inline-flex; gap:6px; justify-content:center;">
							<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.75rem;" data-acao="editar-plano" data-id="${esc(p.id)}" title="Editar">✏️</button>
							<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.75rem;" data-acao="alternar-plano" data-id="${esc(p.id)}" title="${ativo ? 'Desativar' : 'Ativar'}">${ativo ? '⏸️' : '▶️'}</button>
							<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:0.75rem; background:transparent; border:1px solid #ef4444; color:#ef4444;" data-acao="excluir-plano" data-id="${esc(p.id)}" title="Excluir">🗑️</button>
						</div>
					</td>
				`;
				tbodyPlanos.appendChild(tr);
			});
		}
	}

	// Popular select de venda e datalist de clientes
	const selectVenda = document.getElementById('vendaPacotePlanoId');
	if (selectVenda) {
		const prev = selectVenda.value;
		selectVenda.innerHTML = '<option value="">Selecione um plano...</option>';
		planos.filter((p) => p.ativo !== false).forEach((p) => {
			const opt = document.createElement('option');
			opt.value = p.id;
			opt.dataset.valor = String(p.valor || 0);
			const servsTxt = Array.isArray(p.servicosInclusos) && p.servicosInclusos.length > 0
				? ` • Serviços: ${p.servicosInclusos.join(', ')}`
				: '';
			opt.textContent = `${p.nome} (${p.creditos}x • ${p.validadeDias} dias • ${formatarMoeda(p.valor)}${servsTxt})`;
			selectVenda.appendChild(opt);
		});
		if (prev && planos.some((p) => String(p.id) === String(prev) && p.ativo !== false)) {
			selectVenda.value = prev;
		}
	}

	const datalist = document.getElementById('datalistClientesPacote');
	if (datalist) {
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		datalist.innerHTML = '';
		clientes.forEach((c) => {
			if (!c || !c.nome) return;
			const opt = document.createElement('option');
			opt.value = c.nome;
			datalist.appendChild(opt);
		});
	}
	atualizarPainelPlacasVendaPacote(false);

	// Listar assinaturas vendidas
	const assinaturas = PacotesService.getAssinaturas();
	const tbodyClientes = document.getElementById('corpoPacotesClientes');
	if (tbodyClientes) {
		tbodyClientes.innerHTML = '';
		if (assinaturas.length === 0) {
			tbodyClientes.innerHTML = `
				<tr>
					<td colspan="6" class="empty-table-message">Nenhum pacote vendido para clientes ainda.</td>
				</tr>
			`;
		} else {
			assinaturas.forEach((a) => {
				const tr = document.createElement('tr');
				const st = PacotesService.getStatusAssinatura(a);
				let badgeSt = '<span class="badge badge-tone-green">✅ Ativo</span>';
				if (st === 'esgotado') {
					badgeSt = '<span class="badge badge-tone-slate">🏁 Esgotado</span>';
				} else if (st === 'vencido') {
					badgeSt = '<span class="badge badge-tone-red">⏰ Vencido</span>';
				}

				const qtdUsada = Array.isArray(a.historicoUso) ? a.historicoUso.length : 0;
				const servsAssinatura = PacotesService.getServicosInclusosAssinatura(a);
				const badgesServsCli = servsAssinatura.length > 0
					? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${servsAssinatura.map((sv) => `<span class="badge badge-tone-blue" style="font-size:0.7rem;">🏷️ ${esc(sv)}</span>`).join('')}</div>`
					: '';

				tr.innerHTML = `
					<td>
						<strong>${esc(a.clienteNome)}</strong><br>
						<small style="color:var(--text-muted);">${esc(a.observacao || a.formaPagamento || '-')}</small>
					</td>
					<td>
						<strong>${esc(a.planoNome)}</strong>
						${badgesServsCli}
						<div style="margin-top:3px;"><small style="color:var(--text-muted);">Pago: ${formatarMoeda(a.valorPago)}</small></div>
					</td>
					<td><strong>${a.creditosRestantes} / ${a.creditosTotais}</strong></td>
					<td>
						${esc(formatarDataBR(a.dataValidade))}<br>
						<small style="color:var(--text-muted);">Compra: ${esc(formatarDataBR(a.dataCompra))}</small>
					</td>
					<td>${badgeSt}</td>
					<td style="text-align:center;">
						<div style="display:inline-flex; gap:6px; justify-content:center;">
							<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.75rem;" data-acao="historico-pacote" data-id="${esc(a.id)}">📜 Uso (${qtdUsada})</button>
							<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:0.75rem; background:transparent; border:1px solid #ef4444; color:#ef4444;" data-acao="excluir-assinatura" data-id="${esc(a.id)}" title="Excluir">🗑️</button>
						</div>
					</td>
				`;
				tbodyClientes.appendChild(tr);
			});
		}
	}
}

function isSegmentoAutomotivoCaixa() {
	if (typeof BrandService !== 'undefined') {
		if (typeof BrandService.isSegmentoAutomotivo === 'function') {
			return BrandService.isSegmentoAutomotivo();
		}
		if (typeof BrandService.getConfig === 'function') {
			const cfg = BrandService.getConfig();
			return !cfg.tipoNegocio || cfg.tipoNegocio === 'lava_jato' || cfg.tipoNegocio === 'mecanica';
		}
	}
	return true;
}

let placasSelecionadasPacote = [];
let ultimoAutoTextoPlacas = '';

function extrairVeiculosClienteCaixa(cliente) {
	if (!cliente) return [];
	const lista = [];
	if (Array.isArray(cliente.veiculos)) {
		cliente.veiculos.forEach((v) => {
			const placa = String(v?.placa || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
			if (placa) {
				lista.push({
					placa,
					modelo: String(v.modelo || '').trim(),
					tipo: String(v.tipo || 'carro')
				});
			}
		});
	}
	const placaLegada = String(cliente.placa || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
	if (placaLegada && !lista.some((x) => x.placa === placaLegada)) {
		lista.push({
			placa: placaLegada,
			modelo: String(cliente.modelo || '').trim(),
			tipo: 'carro'
		});
	}
	return lista;
}

function sincronizarObsPlacasPacote() {
	const inputObs = document.getElementById('vendaPacoteObs');
	if (!inputObs) return;
	const prefixoNovo = placasSelecionadasPacote.length > 0
		? `Placas autorizadas: ${placasSelecionadasPacote.join(', ')}`
		: '';

	const valorAtual = inputObs.value.trim();
	let notaExtra = '';
	if (valorAtual) {
		if (ultimoAutoTextoPlacas && valorAtual.startsWith(ultimoAutoTextoPlacas)) {
			notaExtra = valorAtual.slice(ultimoAutoTextoPlacas.length).replace(/^[;\s|•-]+/, '').trim();
		} else if (!/^Placas?\s+autorizadas?:/i.test(valorAtual)) {
			notaExtra = valorAtual;
		} else {
			const idxSep = valorAtual.indexOf(' | ');
			if (idxSep !== -1) notaExtra = valorAtual.slice(idxSep + 3).trim();
		}
	}

	ultimoAutoTextoPlacas = prefixoNovo;
	if (prefixoNovo && notaExtra) {
		inputObs.value = `${prefixoNovo} | ${notaExtra}`;
	} else if (prefixoNovo) {
		inputObs.value = prefixoNovo;
	} else {
		inputObs.value = notaExtra;
	}
}

function atualizarPainelPlacasVendaPacote(resetarSelecao = true) {
	const isAuto = isSegmentoAutomotivoCaixa();
	const labelObs = document.getElementById('labelVendaPacoteObs');
	const inputObs = document.getElementById('vendaPacoteObs');
	const painel = document.getElementById('painelPlacasClientePacote');
	const grid = document.getElementById('pacotePlacasGrid');
	const meta = document.getElementById('pacotePlacasMeta');
	const btnMarcarTodas = document.getElementById('btnMarcarTodasPlacasPacote');
	const inputCliente = document.getElementById('vendaPacoteClienteNome');

	if (labelObs) {
		labelObs.textContent = isAuto ? 'Observação / Placas autorizadas' : 'Observação do pacote';
	}
	if (inputObs) {
		inputObs.placeholder = isAuto
			? 'Opcional (selecione placas acima ou digite detalhes do pacote)'
			: 'Opcional (ex: Clube da Barba, Combo 4 atendimentos, validade...)';
	}

	if (!isAuto) {
		placasSelecionadasPacote = [];
		ultimoAutoTextoPlacas = '';
		if (painel) painel.style.display = 'none';
		if (grid) grid.innerHTML = '';
		return;
	}

	if (!painel || !grid) return;

	const nomeTermo = (inputCliente ? inputCliente.value : '').trim().toLowerCase();
	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	const cliMatch = nomeTermo
		? clientes.find((c) => c && c.nome && c.nome.trim().toLowerCase() === nomeTermo)
		: null;

	if (!cliMatch) {
		placasSelecionadasPacote = [];
		if (resetarSelecao) sincronizarObsPlacasPacote();
		painel.style.display = 'none';
		grid.innerHTML = '';
		return;
	}

	const veiculos = extrairVeiculosClienteCaixa(cliMatch);
	painel.style.display = 'block';

	const tituloEl = document.getElementById('pacotePlacasTitulo');
	if (tituloEl) {
		tituloEl.textContent = `Veículos de ${cliMatch.nome}`;
	}

	if (veiculos.length === 0) {
		placasSelecionadasPacote = [];
		if (resetarSelecao) sincronizarObsPlacasPacote();
		if (meta) meta.textContent = 'Este cliente ainda não tem veículos cadastrados. Você pode digitar no campo abaixo se necessário.';
		if (btnMarcarTodas) btnMarcarTodas.style.display = 'none';
		grid.innerHTML = `
			<div class="os-veiculos-empty" style="grid-column: 1 / -1;">
				Nenhuma placa vinculada ao cadastro de <strong>${esc(cliMatch.nome)}</strong>. O pacote continuará válido para qualquer atendimento deste cliente.
			</div>
		`;
		return;
	}

	if (resetarSelecao) {
		placasSelecionadasPacote = veiculos.length === 1 ? [veiculos[0].placa] : [];
		sincronizarObsPlacasPacote();
	} else {
		const validas = new Set(veiculos.map((v) => v.placa));
		placasSelecionadasPacote = placasSelecionadasPacote.filter((p) => validas.has(p));
	}

	if (meta) {
		meta.textContent = veiculos.length === 1
			? '1 veículo encontrado · selecionado automaticamente'
			: `${veiculos.length} veículos encontrados · clique para marcar as placas autorizadas`;
	}
	if (btnMarcarTodas) {
		btnMarcarTodas.style.display = veiculos.length > 1 ? 'inline-flex' : 'none';
		const todasMarcadas = veiculos.every((v) => placasSelecionadasPacote.includes(v.placa));
		btnMarcarTodas.textContent = todasMarcadas ? 'Desmarcar todas' : 'Marcar todas';
	}

	grid.innerHTML = '';
	veiculos.forEach((v) => {
		const ativa = placasSelecionadasPacote.includes(v.placa);
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'os-veiculo-option' + (ativa ? ' active' : '');
		btn.innerHTML = `
			<span style="font-size:1.15rem;">${v.tipo === 'moto' ? '🏍️' : (v.tipo === 'caminhao' ? '🚛' : '🚗')}</span>
			<div class="os-veiculo-option-info">
				<span class="os-veiculo-option-placa">${esc(v.placa)}</span>
				<span class="os-veiculo-option-desc">${esc(v.modelo || 'Veículo cadastrado')} · ${ativa ? 'Autorizada' : 'Clique para autorizar'}</span>
			</div>
		`;
		btn.addEventListener('click', () => {
			if (placasSelecionadasPacote.includes(v.placa)) {
				placasSelecionadasPacote = placasSelecionadasPacote.filter((p) => p !== v.placa);
			} else {
				placasSelecionadasPacote.push(v.placa);
			}
			sincronizarObsPlacasPacote();
			atualizarPainelPlacasVendaPacote(false);
		});
		grid.appendChild(btn);
	});
}

function abrirModalHistoricoPacote(assinaturaId) {
	if (typeof PacotesService === 'undefined') return;
	const a = PacotesService.getAssinaturas().find((item) => String(item.id) === String(assinaturaId));
	if (!a) return;

	const isAuto = isSegmentoAutomotivoCaixa();
	const thItem = document.getElementById('thHistoricoPacoteItem');
	if (thItem) {
		thItem.textContent = isAuto ? 'Veículo / Placa' : 'Atendimento / Cliente';
	}

	if (modalHistoricoPacoteCabecalho) {
		const infoPlacas = isAuto && Array.isArray(a.placasAutorizadas) && a.placasAutorizadas.length > 0
			? ` • Placas: <strong>${esc(a.placasAutorizadas.join(', '))}</strong>`
			: '';
		modalHistoricoPacoteCabecalho.innerHTML = `
			Cliente: <strong>${esc(a.clienteNome)}</strong> • Plano: <strong>${esc(a.planoNome)}</strong> • Saldo: <strong>${a.creditosRestantes}/${a.creditosTotais} créditos</strong>${infoPlacas}
		`;
	}

	if (corpoHistoricoUsoPacote) {
		const usos = Array.isArray(a.historicoUso) ? a.historicoUso : [];
		corpoHistoricoUsoPacote.innerHTML = '';
		if (usos.length === 0) {
			corpoHistoricoUsoPacote.innerHTML = `
				<tr>
					<td colspan="3" class="empty-table-message">Nenhum crédito utilizado neste pacote ainda.</td>
				</tr>
			`;
		} else {
			usos.forEach((u) => {
				const tr = document.createElement('tr');
				const colunaItem = isAuto
					? `<strong>${esc(u.placa || 'SEM PLACA')}</strong>${u.modelo ? ' • ' + esc(u.modelo) : ''}`
					: `<strong>${esc(u.itemDescricao || u.cliente || a.clienteNome || 'Atendimento')}</strong>`;
				tr.innerHTML = `
					<td>${esc(formatarDataBR(u.data))} ${esc(u.hora || '')}</td>
					<td>${colunaItem}</td>
					<td><small>${esc(u.servicos || '-')}</small></td>
				`;
				corpoHistoricoUsoPacote.appendChild(tr);
			});
		}
	}

	if (modalHistoricoPacote) modalHistoricoPacote.classList.add('open');
}

function fecharModalHistoricoPacote() {
	if (modalHistoricoPacote) modalHistoricoPacote.classList.remove('open');
}

// ==========================================================================
// Controles dos Modais Originais do Caixa
// ==========================================================================
function abrirModalSaida() {
	if (document.getElementById('modalSaidaValorInput')) document.getElementById('modalSaidaValorInput').value = '';
	if (document.getElementById('modalSaidaCategoria')) document.getElementById('modalSaidaCategoria').value = '';
	if (document.getElementById('modalSaidaDescricao')) document.getElementById('modalSaidaDescricao').value = '';
	if (modalSaidaCaixa) modalSaidaCaixa.classList.add('open');
}

function fecharModalSaida() {
	if (modalSaidaCaixa) modalSaidaCaixa.classList.remove('open');
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
		notify('Saída registrada no caixa com sucesso.', 'success');
	});
}

function abrirModalFechamento() {
	const statusHoje = CaixaService.getStatusHoje();
	if (modalDataHojeTexto) modalDataHojeTexto.textContent = formatarDataBR(statusHoje.data);
	if (modalResumoAtendimentos) modalResumoAtendimentos.textContent = statusHoje.totalServicos;
	if (modalResumoValor) modalResumoValor.textContent = `R$ ${statusHoje.totalValor.toFixed(2)}`;
	if (modalFundoTrocoInput) modalFundoTrocoInput.value = (statusHoje.fundoTroco || 0).toFixed(2);
	if (modalObservacoesFechamento) modalObservacoesFechamento.value = '';

	if (modalFecharCaixa) modalFecharCaixa.classList.add('open');
}

function fecharModalFechamento() {
	if (modalFecharCaixa) modalFecharCaixa.classList.remove('open');
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
		notify('Caixa fechado e arquivado com sucesso!', 'success');
	});
}

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
		notify('Caixa reaberto para lançamentos.', 'info');
	});
}

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
			notify('Saída removida e saldo recalculado.', 'info');
		}
	});
}

window.removerSaidaGlobal = function (id) {
	abrirModalExcluirSaida(id);
};

// ==========================================================================
// Eventos dos Novos Módulos (Contas, Faturamento Frotas, Pacotes)
// ==========================================================================
function inicializarEventosModulosFase2() {
	// --- Contas Pagar/Receber ---
	const formConta = document.getElementById('formNovaConta');
	if (formConta) {
		formConta.addEventListener('submit', (e) => {
			e.preventDefault();
			const editContaId = document.getElementById('contaEditId').value;
			if (!editContaId && window.SaasGuard && !window.SaasGuard.bloquearSeSuspenso('novo lançamento financeiro')) {
				return;
			}
			const resp = CaixaService.salvarConta({
				id: document.getElementById('contaEditId').value,
				tipo: document.getElementById('contaTipo').value,
				descricao: document.getElementById('contaDescricao').value,
				pessoa: document.getElementById('contaPessoa').value,
				categoria: document.getElementById('contaCategoria').value,
				vencimento: document.getElementById('contaVencimento').value,
				valor: document.getElementById('contaValor').value,
				observacao: document.getElementById('contaObservacao').value
			});
			if (!resp.sucesso) {
				notify(resp.erro || 'Não foi possível salvar a conta.', 'error');
				return;
			}
			resetarFormConta();
			carregarDadosCaixa();
			notify('Lançamento financeiro salvo!', 'success');
		});
	}

	const btnCancelarEditConta = document.getElementById('btnCancelarEditConta');
	if (btnCancelarEditConta) btnCancelarEditConta.addEventListener('click', resetarFormConta);

	const filtroContasTipo = document.getElementById('filtroContasTipo');
	const filtroContasStatus = document.getElementById('filtroContasStatus');
	if (filtroContasTipo) filtroContasTipo.addEventListener('change', carregarContasFinanceiras);
	if (filtroContasStatus) filtroContasStatus.addEventListener('change', carregarContasFinanceiras);

	const corpoContas = document.getElementById('corpoContasFinanceiras');
	if (corpoContas) {
		corpoContas.addEventListener('click', async (e) => {
			const btn = e.target.closest('button[data-acao]');
			if (!btn) return;
			const id = btn.dataset.id;
			const acao = btn.dataset.acao;

			if (acao === 'baixar') {
				abrirModalBaixaConta(id);
			} else if (acao === 'editar') {
				const conta = CaixaService.getContas().find((c) => String(c.id) === String(id));
				if (!conta) return;
				document.getElementById('contaEditId').value = conta.id;
				document.getElementById('contaTipo').value = conta.tipo || 'pagar';
				document.getElementById('contaDescricao').value = conta.descricao || '';
				document.getElementById('contaPessoa').value = conta.pessoa || '';
				document.getElementById('contaCategoria').value = conta.categoria || '';
				document.getElementById('contaVencimento').value = conta.vencimento || '';
				document.getElementById('contaValor').value = conta.valor || '';
				document.getElementById('contaObservacao').value = conta.observacao || '';
				document.getElementById('tituloFormConta').textContent = '✏️ Editar Conta';
				if (btnCancelarEditConta) btnCancelarEditConta.style.display = 'inline-flex';
				formConta.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} else if (acao === 'excluir') {
				const ok = await confirmarAcao({
					title: 'Excluir Conta',
					message: 'Deseja realmente excluir este lançamento financeiro?',
					confirmText: 'Excluir',
					danger: true
				});
				if (ok) {
					CaixaService.removerConta(id);
					carregarDadosCaixa();
					notify('Conta removida.', 'info');
				}
			}
		});
	}

	if (modalBaixaContaX) modalBaixaContaX.addEventListener('click', fecharModalBaixaConta);
	if (modalCancelarBaixaContaBtn) modalCancelarBaixaContaBtn.addEventListener('click', fecharModalBaixaConta);
	if (formConfirmarBaixaConta) {
		formConfirmarBaixaConta.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!idContaParaBaixar) return;
			const forma = modalBaixaContaFormaPgto ? modalBaixaContaFormaPgto.value : 'Pix';
			const resp = CaixaService.darBaixaConta(idContaParaBaixar, forma);
			if (!resp.sucesso) {
				notify(resp.erro || 'Erro ao dar baixa na conta.', 'error');
				return;
			}
			fecharModalBaixaConta();
			carregarDadosCaixa();
			notify('Baixa confirmada e lançada no Caixa de hoje!', 'success');
		});
	}

	// --- Faturamento Frotas ---
	const gridClientesFat = document.getElementById('gridClientesFaturamento');
	if (gridClientesFat) {
		gridClientesFat.addEventListener('click', (e) => {
			const card = e.target.closest('.btn-card-frota');
			if (!card) return;
			const selectCli = document.getElementById('fatFiltroCliente');
			if (selectCli) {
				selectCli.value = card.dataset.cliente || '';
				carregarFaturamentoFrotas();
			}
		});
	}

	['fatFiltroCliente', 'fatFiltroStatus', 'fatFiltroDataInicio', 'fatFiltroDataFim'].forEach((id) => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('change', carregarFaturamentoFrotas);
	});
	const fatFiltroPlaca = document.getElementById('fatFiltroPlaca');
	if (fatFiltroPlaca) fatFiltroPlaca.addEventListener('input', carregarFaturamentoFrotas);

	const chkTodas = document.getElementById('chkSelecionarTodasFaturas');
	if (chkTodas) {
		chkTodas.addEventListener('change', () => {
			const marcar = chkTodas.checked;
			document.querySelectorAll('.chk-fatura-os').forEach((c) => {
				c.checked = marcar;
			});
			atualizarResumoSelecaoFaturamento();
		});
	}

	const corpoFat = document.getElementById('corpoFaturamentoFrotas');
	if (corpoFat) {
		corpoFat.addEventListener('change', (e) => {
			if (e.target.classList.contains('chk-fatura-os')) {
				atualizarResumoSelecaoFaturamento();
			}
		});
	}

	const btnBaixaFat = document.getElementById('btnDarBaixaFatura');
	if (btnBaixaFat) {
		btnBaixaFat.addEventListener('click', async () => {
			if (typeof FaturamentoService === 'undefined') return;
			const checksPendentes = Array.from(document.querySelectorAll('.chk-fatura-os:checked'))
				.filter((el) => el.dataset.status === 'pendente');

			if (checksPendentes.length === 0) {
				notify('Selecione ao menos uma O.S. pendente (A Receber) para dar baixa.', 'warning');
				return;
			}

			const total = checksPendentes.reduce((acc, el) => acc + (parseFloat(el.dataset.valor || 0) || 0), 0);
			const forma = (document.getElementById('fatFormaRecebimento') || {}).value || 'Pix';
			const clienteFiltro = (document.getElementById('fatFiltroCliente') || {}).value || '';

			const ok = await confirmarAcao({
				title: 'Confirmar Baixa Unificada',
				message: `Deseja dar baixa em <strong>${checksPendentes.length} O.S.</strong> no valor total de <strong>${formatarMoeda(total)}</strong> via <strong>${esc(forma)}</strong>? O valor entrará no Caixa de hoje.`,
				confirmText: 'Confirmar Recebimento'
			});
			if (!ok) return;

			const resp = FaturamentoService.darBaixaUnificada({
				clienteNome: clienteFiltro,
				pedidoIds: checksPendentes.map((el) => el.value),
				formaPagamento: forma
			});
			if (!resp.sucesso) {
				notify(resp.erro || 'Não foi possível concluir a baixa.', 'error');
				return;
			}

			carregarDadosCaixa();
			notify(`Baixa de ${resp.qtdBaixada} O.S. (${formatarMoeda(resp.valorTotal)}) lançada no Caixa!`, 'success');
		});
	}

	const btnImprimirFat = document.getElementById('btnImprimirExtratoFatura');
	if (btnImprimirFat) {
		btnImprimirFat.addEventListener('click', () => {
			if (typeof FaturamentoService === 'undefined') return;
			const lista = resolverPedidosAlvoExtrato();
			if (lista.length === 0) {
				notify('Não há ordens de serviço para gerar extrato.', 'warning');
				return;
			}
			const filtros = getFiltrosFaturamento();
			const cliente = filtros.clienteNome || (lista[0] && lista[0].cliente) || 'Todos os Clientes';
			const periodo = (filtros.dataInicio || filtros.dataFim)
				? `${formatarDataBR(filtros.dataInicio)} até ${formatarDataBR(filtros.dataFim)}`
				: 'Todo o período filtrado';
			FaturamentoService.imprimirExtrato(cliente, lista, periodo);
		});
	}

	const btnWppFat = document.getElementById('btnEnviarExtratoWpp');
	if (btnWppFat) {
		btnWppFat.addEventListener('click', () => {
			if (typeof FaturamentoService === 'undefined') return;
			const lista = resolverPedidosAlvoExtrato();
			if (lista.length === 0) {
				notify('Selecione ou filtre pelo menos uma O.S. para enviar cobrança.', 'warning');
				return;
			}
			const filtros = getFiltrosFaturamento();
			const clienteNome = filtros.clienteNome || (lista[0] && lista[0].cliente) || 'Cliente Corporativo';
			const clientesCadastrados = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliMatch = clientesCadastrados.find(
				(c) => c.nome && c.nome.trim().toLowerCase() === clienteNome.trim().toLowerCase()
			);
			const telefone = (cliMatch && (cliMatch.tel1 || cliMatch.telefone || cliMatch.tel2)) || (lista[0] && lista[0].telefone) || '';
			FaturamentoService.enviarResumoWhatsApp(clienteNome, telefone, lista);
		});
	}

	// --- Pacotes e Planos ---
	const btnLimparServicosPlano = document.getElementById('btnLimparServicosPlano');
	if (btnLimparServicosPlano) {
		btnLimparServicosPlano.addEventListener('click', () => {
			renderizarSeletorServicosPlanoPacote([]);
		});
	}

	const formPlano = document.getElementById('formNovoPlanoPacote');
	if (formPlano) {
		formPlano.addEventListener('submit', (e) => {
			e.preventDefault();
			if (typeof PacotesService === 'undefined') return;
			const editPlanoId = document.getElementById('planoPacoteEditId').value;
			if (!editPlanoId && window.SaasGuard && !window.SaasGuard.bloquearSeSuspenso('criar pacote')) {
				return;
			}
			const resp = PacotesService.salvarPlano({
				id: document.getElementById('planoPacoteEditId').value,
				nome: document.getElementById('planoPacoteNome').value,
				creditos: document.getElementById('planoPacoteCreditos').value,
				validadeDias: document.getElementById('planoPacoteValidade').value,
				valor: document.getElementById('planoPacoteValor').value,
				descricao: document.getElementById('planoPacoteDescricao').value,
				servicosInclusos: obterServicosSelecionadosPlanoPacote()
			});
			if (!resp.sucesso) {
				notify(resp.erro || 'Erro ao salvar plano.', 'error');
				return;
			}
			resetarFormPlanoPacote();
			carregarDadosCaixa();
			notify('Plano / Pacote salvo com sucesso!', 'success');
		});
	}

	const btnCancelarEditPlano = document.getElementById('btnCancelarEditPlano');
	if (btnCancelarEditPlano) btnCancelarEditPlano.addEventListener('click', resetarFormPlanoPacote);

	const tbodyPlanos = document.getElementById('corpoPlanosPacotes');
	if (tbodyPlanos) {
		tbodyPlanos.addEventListener('click', async (e) => {
			const btn = e.target.closest('button[data-acao]');
			if (!btn || typeof PacotesService === 'undefined') return;
			const id = btn.dataset.id;
			const acao = btn.dataset.acao;

			if (acao === 'editar-plano') {
				const plano = PacotesService.getPlanos().find((p) => String(p.id) === String(id));
				if (!plano) return;
				document.getElementById('planoPacoteEditId').value = plano.id;
				document.getElementById('planoPacoteNome').value = plano.nome || '';
				document.getElementById('planoPacoteCreditos').value = plano.creditos || 1;
				document.getElementById('planoPacoteValidade').value = plano.validadeDias || 30;
				document.getElementById('planoPacoteValor').value = plano.valor || 0;
				document.getElementById('planoPacoteDescricao').value = plano.descricao || '';
				renderizarSeletorServicosPlanoPacote(Array.isArray(plano.servicosInclusos) ? plano.servicosInclusos : []);
				document.getElementById('tituloFormPlanoPacote').textContent = '✏️ Editar Plano / Pacote';
				if (btnCancelarEditPlano) btnCancelarEditPlano.style.display = 'inline-flex';
				formPlano.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} else if (acao === 'alternar-plano') {
				PacotesService.alternarStatusPlano(id);
				carregarDadosCaixa();
			} else if (acao === 'excluir-plano') {
				const ok = await confirmarAcao({
					title: 'Excluir Plano',
					message: 'Deseja realmente excluir este modelo de pacote?',
					confirmText: 'Excluir',
					danger: true
				});
				if (ok) {
					PacotesService.removerPlano(id);
					carregarDadosCaixa();
					notify('Plano removido.', 'info');
				}
			}
		});
	}

	const selectVendaPlano = document.getElementById('vendaPacotePlanoId');
	if (selectVendaPlano) {
		selectVendaPlano.addEventListener('change', () => {
			const opt = selectVendaPlano.options[selectVendaPlano.selectedIndex];
			const inputVal = document.getElementById('vendaPacoteValor');
			if (opt && opt.dataset.valor && inputVal) {
				inputVal.value = parseFloat(opt.dataset.valor).toFixed(2);
			}
		});
	}

	const inputClientePacote = document.getElementById('vendaPacoteClienteNome');
	if (inputClientePacote) {
		inputClientePacote.addEventListener('input', () => atualizarPainelPlacasVendaPacote(true));
		inputClientePacote.addEventListener('change', () => atualizarPainelPlacasVendaPacote(true));
	}

	const btnMarcarTodasPlacas = document.getElementById('btnMarcarTodasPlacasPacote');
	if (btnMarcarTodasPlacas) {
		btnMarcarTodasPlacas.addEventListener('click', () => {
			const nomeTermo = (document.getElementById('vendaPacoteClienteNome')?.value || '').trim().toLowerCase();
			const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliMatch = clientes.find((c) => c && c.nome && c.nome.trim().toLowerCase() === nomeTermo);
			if (!cliMatch) return;
			const veiculos = extrairVeiculosClienteCaixa(cliMatch);
			const todasMarcadas = veiculos.length > 0 && veiculos.every((v) => placasSelecionadasPacote.includes(v.placa));
			placasSelecionadasPacote = todasMarcadas ? [] : veiculos.map((v) => v.placa);
			sincronizarObsPlacasPacote();
			atualizarPainelPlacasVendaPacote(false);
		});
	}

	const formVenderPacote = document.getElementById('formVenderPacote');
	if (formVenderPacote) {
		formVenderPacote.addEventListener('submit', (e) => {
			e.preventDefault();
			if (typeof PacotesService === 'undefined') return;
			if (window.SaasGuard && !window.SaasGuard.bloquearSeSuspenso('vender pacote')) {
				return;
			}
			const planoId = document.getElementById('vendaPacotePlanoId').value;
			const clienteNome = document.getElementById('vendaPacoteClienteNome').value.trim();
			const formaPagamento = document.getElementById('vendaPacoteFormaPgto').value;
			const valorPago = document.getElementById('vendaPacoteValor').value;
			const observacao = document.getElementById('vendaPacoteObs').value;
			const isAuto = isSegmentoAutomotivoCaixa();

			const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliMatch = clientes.find(
				(c) => c.nome && c.nome.trim().toLowerCase() === clienteNome.toLowerCase()
			);

			const resp = PacotesService.venderPacote({
				planoId,
				clienteId: cliMatch ? cliMatch.id : '',
				clienteNome: cliMatch ? cliMatch.nome : clienteNome,
				clienteTelefone: cliMatch ? (cliMatch.tel1 || cliMatch.telefone || cliMatch.tel2 || '') : '',
				formaPagamento,
				valorPago,
				observacao,
				placasAutorizadas: isAuto ? placasSelecionadasPacote : []
			});
			if (!resp.sucesso) {
				notify(resp.erro || 'Erro ao vender pacote.', 'error');
				return;
			}
			formVenderPacote.reset();
			placasSelecionadasPacote = [];
			ultimoAutoTextoPlacas = '';
			atualizarPainelPlacasVendaPacote(false);
			carregarDadosCaixa();
			notify(`Pacote vendido para ${resp.assinatura.clienteNome} e lançado no Caixa!`, 'success');
		});
	}

	const tbodyPacotesCli = document.getElementById('corpoPacotesClientes');
	if (tbodyPacotesCli) {
		tbodyPacotesCli.addEventListener('click', async (e) => {
			const btn = e.target.closest('button[data-acao]');
			if (!btn || typeof PacotesService === 'undefined') return;
			const id = btn.dataset.id;
			const acao = btn.dataset.acao;

			if (acao === 'historico-pacote') {
				abrirModalHistoricoPacote(id);
			} else if (acao === 'excluir-assinatura') {
				const ok = await confirmarAcao({
					title: 'Excluir Pacote do Cliente',
					message: 'Deseja remover esta assinatura de pacote do cliente?',
					confirmText: 'Excluir',
					danger: true
				});
				if (ok) {
					PacotesService.removerAssinatura(id);
					carregarDadosCaixa();
					notify('Pacote do cliente removido.', 'info');
				}
			}
		});
	}

	if (modalHistoricoPacoteX) modalHistoricoPacoteX.addEventListener('click', fecharModalHistoricoPacote);
	if (modalFecharHistoricoPacoteBtn) modalFecharHistoricoPacoteBtn.addEventListener('click', fecharModalHistoricoPacote);
}

document.addEventListener('DOMContentLoaded', () => {
	inicializarAbasCaixa();
	inicializarEventosModulosFase2();
	carregarDadosCaixa();
});

window.addEventListener('cloudDataChanged', (e) => {
	const key = e && e.detail;
	if (['servicos', 'pacotes_planos', 'pacotes_clientes', 'clientes', 'pedidos', 'contas_financeiras', 'config_negocio', 'fechamentos_caixa', 'saidas_caixa'].includes(key)) {
		carregarDadosCaixa();
	}
});
