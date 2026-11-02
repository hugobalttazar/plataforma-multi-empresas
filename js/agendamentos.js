// ==========================================================================
// Gestão de Agendamentos e Horários
// ==========================================================================

const agendamentoForm = document.getElementById('agendamentoForm');
const agendamentoCliente = document.getElementById('agendamentoCliente');
const agendamentoPlaca = document.getElementById('agendamentoPlaca');
const agendamentoCor = document.getElementById('agendamentoCor');
const previewCorAgendamento = document.getElementById('previewCorAgendamento');
const agendamentoModelo = document.getElementById('agendamentoModelo');
const agendamentoData = document.getElementById('agendamentoData');
const agendamentoHora = document.getElementById('agendamentoHora');
const agendamentoDuracao = document.getElementById('agendamentoDuracao');
const agendamentoServico = document.getElementById('agendamentoServico');
const agendamentoValor = document.getElementById('agendamentoValor');
const agendamentoObs = document.getElementById('agendamentoObs');
const sugestoesClientesAgendamento = document.getElementById('sugestoesClientesAgendamento');
const checkSincronizarGoogle = document.getElementById('checkSincronizarGoogle');

// Filtro e Visualização
const filtroDataAgendamento = document.getElementById('filtroDataAgendamento');
const corpoTabelaAgendamentos = document.getElementById('corpoTabelaAgendamentos');
const countAgendamentosHoje = document.getElementById('countAgendamentosHoje');
const countAgendamentosFuturos = document.getElementById('countAgendamentosFuturos');

// Modal Cancelar / Reagendar
const modalReagendar = document.getElementById('modalReagendar');
const modalReagendarX = document.getElementById('modalReagendarX');
const modalCancelarReagendarBtn = document.getElementById('modalCancelarReagendarBtn');
const formReagendar = document.getElementById('formReagendar');
const reagendarData = document.getElementById('reagendarData');
const reagendarHora = document.getElementById('reagendarHora');
let agendamentoSelecionado = null;

// Utilitário
function formatarDataBR(dataISO) {
	if (!dataISO) return '';
	const [ano, mes, dia] = dataISO.split('-');
	return `${dia}/${mes}/${ano}`;
}

// Normalização inicial do armazenamento
function obterAgendamentos() {
	return JSON.parse(localStorage.getItem('agendamentos')) || [];
}

function salvarAgendamentos(lista) {
	localStorage.setItem('agendamentos', JSON.stringify(lista));
}

// Popular Cores no Select
function popularCoresAgendamento() {
	if (!agendamentoCor) return;
	agendamentoCor.innerHTML = '';
	CORES_VEICULOS.forEach((c) => {
		const opt = document.createElement('option');
		opt.value = c.id;
		opt.textContent = c.nome;
		agendamentoCor.appendChild(opt);
	});
	agendamentoCor.addEventListener('change', atualizarPreviewCorAgendamento);
	atualizarPreviewCorAgendamento();
}

function atualizarPreviewCorAgendamento() {
	if (!agendamentoCor || !previewCorAgendamento) return;
	const corObj = obterCorVeiculo(agendamentoCor.value);
	previewCorAgendamento.innerHTML = `
		${renderizarIconeCarro(corObj, 24)}
		<small style="font-weight:600; color:var(--text-muted);">${corObj.nome}</small>
	`;
}

// Popular Serviços no Select
function popularServicosAgendamento() {
	if (!agendamentoServico) return;
	const servicos = JSON.parse(localStorage.getItem('servicos')) || [];
	agendamentoServico.innerHTML = '';
	if (servicos.length === 0) {
		const opt = document.createElement('option');
		opt.disabled = true;
		opt.textContent = 'Nenhum serviço cadastrado';
		agendamentoServico.appendChild(opt);
	} else {
		servicos.forEach((s) => {
			const opt = document.createElement('option');
			opt.value = s.nome;
			const precoFmt = s.preco ? ` (R$ ${parseFloat(s.preco).toFixed(2)})` : '';
			opt.textContent = `${s.nome}${precoFmt}`;
			opt.dataset.preco = s.preco || 0;
			agendamentoServico.appendChild(opt);
		});
	}
}

// Cálculo de valor
if (agendamentoServico) {
	agendamentoServico.addEventListener('change', () => {
		let total = 0;
		Array.from(agendamentoServico.selectedOptions).forEach((opt) => {
			const p = parseFloat(opt.dataset.preco || 0);
			total += isNaN(p) ? 0 : p;
		});
		if (agendamentoValor) {
			agendamentoValor.value = total > 0 ? total.toFixed(2) : '';
		}
	});
}

// Autocomplete de clientes
if (agendamentoCliente && sugestoesClientesAgendamento) {
	agendamentoCliente.addEventListener('input', () => {
		const termo = agendamentoCliente.value.trim().toLowerCase();
		sugestoesClientesAgendamento.innerHTML = '';
		if (termo.length < 1) {
			sugestoesClientesAgendamento.style.display = 'none';
			return;
		}

		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const filtrados = clientes.filter(
			(c) => (c.nome && c.nome.toLowerCase().includes(termo)) ||
				   (c.tel1 && c.tel1.includes(termo))
		);

		if (filtrados.length === 0) {
			sugestoesClientesAgendamento.style.display = 'none';
			return;
		}

		sugestoesClientesAgendamento.style.display = 'block';
		filtrados.slice(0, 5).forEach((c) => {
			const div = document.createElement('div');
			div.className = 'sugestao-item';
			div.innerHTML = `<strong>${c.nome}</strong> <small style="color:var(--text-muted);">${c.tel1 || ''}</small>`;
			div.addEventListener('click', () => {
				agendamentoCliente.value = c.nome;
				agendamentoCliente.dataset.clienteId = c.id || '';
				agendamentoCliente.dataset.telefone = c.tel1 || '';
				
				// Se tiver placa registrada no histórico do cliente
				if (c.veiculos && c.veiculos.length > 0) {
					const ultimoVeiculo = c.veiculos[c.veiculos.length - 1];
					if (agendamentoPlaca) agendamentoPlaca.value = ultimoVeiculo.placa || '';
					if (agendamentoModelo) agendamentoModelo.value = ultimoVeiculo.modelo || '';
					if (agendamentoCor && ultimoVeiculo.cor) {
						agendamentoCor.value = ultimoVeiculo.cor;
						atualizarPreviewCorAgendamento();
					}
				}
				sugestoesClientesAgendamento.style.display = 'none';
			});
			sugestoesClientesAgendamento.appendChild(div);
		});
	});

	document.addEventListener('click', (e) => {
		if (!agendamentoCliente.contains(e.target) && !sugestoesClientesAgendamento.contains(e.target)) {
			sugestoesClientesAgendamento.style.display = 'none';
		}
	});
}

// Placa em maiúsculo
if (agendamentoPlaca) {
	agendamentoPlaca.addEventListener('input', (e) => {
		e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
	});
}

// Salvar Novo Agendamento
if (agendamentoForm) {
	agendamentoForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const servicosSelecionados = Array.from(agendamentoServico.selectedOptions).map((o) => o.value).join(', ');
		const valorNum = parseFloat(agendamentoValor.value || 0);

		const novoAgendamento = {
			id: 'ag_' + Date.now(),
			clienteNome: agendamentoCliente.value.trim(),
			clienteTelefone: agendamentoCliente.dataset.telefone || '',
			placa: agendamentoPlaca.value.trim().toUpperCase(),
			cor: agendamentoCor.value,
			modelo: agendamentoModelo.value.trim(),
			data: agendamentoData.value || obterDataHojeISO(),
			hora: agendamentoHora.value || '09:00',
			duracaoMinutos: parseInt(agendamentoDuracao.value || '60', 10),
			servicos: servicosSelecionados || 'Lavagem Geral',
			valor: valorNum,
			observacoes: agendamentoObs.value.trim(),
			status: 'agendado', // 'agendado', 'em_andamento', 'concluido', 'cancelado'
			criadoEm: new Date().toISOString()
		};

		const agendamentos = obterAgendamentos();
		agendamentos.push(novoAgendamento);
		salvarAgendamentos(agendamentos);

		// Sincronização Google Calendar se marcada
		if (checkSincronizarGoogle && checkSincronizarGoogle.checked) {
			try {
				if (typeof GoogleCalendarService !== 'undefined') {
					await GoogleCalendarService.criarEventoCalendar(novoAgendamento);
				}
			} catch (err) {
				console.warn('Erro ao sincronizar com Google Calendar:', err);
			}
		}

		// Feedback e Reset
		agendamentoForm.reset();
		if (agendamentoData) agendamentoData.value = obterDataHojeISO();
		if (agendamentoHora) agendamentoHora.value = '09:00';
		atualizarPreviewCorAgendamento();
		renderizarListaAgendamentos();
		
		const toast = document.getElementById('toastSucessoAgendamento');
		if (toast) {
			toast.style.display = 'flex';
			setTimeout(() => { toast.style.display = 'none'; }, 4000);
		}
	});
}

// Renderização dos Agendamentos
function renderizarListaAgendamentos() {
	if (!corpoTabelaAgendamentos) return;
	const agendamentos = obterAgendamentos();
	const dataFiltro = filtroDataAgendamento ? filtroDataAgendamento.value : '';
	const hoje = obterDataHojeISO();

	// Contadores
	const agHoje = agendamentos.filter((a) => a.data === hoje && a.status === 'agendado');
	const agFuturos = agendamentos.filter((a) => a.data >= hoje && a.status === 'agendado');

	if (countAgendamentosHoje) countAgendamentosHoje.textContent = agHoje.length;
	if (countAgendamentosFuturos) countAgendamentosFuturos.textContent = agFuturos.length;

	let filtrados = agendamentos;
	if (dataFiltro) {
		filtrados = filtrados.filter((a) => a.data === dataFiltro);
	}

	// Ordena por data e depois por hora
	filtrados.sort((a, b) => {
		if (a.data === b.data) {
			return a.hora.localeCompare(b.hora);
		}
		return a.data.localeCompare(b.data);
	});

	corpoTabelaAgendamentos.innerHTML = '';

	if (filtrados.length === 0) {
		corpoTabelaAgendamentos.innerHTML = `
			<tr>
				<td colspan="7" class="empty-table-message">
					📅 Nenhum agendamento encontrado para o filtro selecionado. Preencha o formulário acima para marcar um novo horário.
				</td>
			</tr>
		`;
		return;
	}

	filtrados.forEach((ag) => {
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		const corObj = obterCorVeiculo(ag.cor);
		const modeloTexto = ag.modelo ? ` • ${esc(ag.modelo)}` : '';
		const tr = document.createElement('tr');
		
		let statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">🕒 Agendado</span>`;
		if (ag.status === 'em_andamento') {
			statusBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; border-color:#fde68a;">🚗 No Pátio</span>`;
		} else if (ag.status === 'concluido') {
			statusBadge = `<span class="badge" style="background:#dcfce7; color:#15803d; border-color:#bbf7d0;">✅ Concluído</span>`;
		} else if (ag.status === 'cancelado') {
			statusBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;">❌ Cancelado</span>`;
		}

		// Link e ação de WhatsApp com modal de pré-visualização e modelo personalizado
		const linkCalendarWeb = typeof GoogleCalendarService !== 'undefined' ? GoogleCalendarService.gerarLinkWebCalendar(ag) : '#';

		tr.innerHTML = `
			<td>
				<div style="font-weight:700; color:var(--text-main); font-size: 0.95rem;">${esc(ag.hora)}</div>
				<small style="color:var(--text-muted); font-size:0.8rem;">${formatarDataBR(ag.data)} (${ag.duracaoMinutos || 60}m)</small>
			</td>
			<td>
				<div class="veiculo-info-cell">
					${renderizarIconeCarro(corObj, 26)}
					<div class="veiculo-meta">
						<span class="badge-placa">${esc(ag.placa)}</span>
						<span class="veiculo-cor-nome">${esc(corObj.nome)}${modeloTexto}</span>
					</div>
				</div>
			</td>
			<td>
				<div style="font-weight:600; color:var(--text-main);">${esc(ag.clienteNome)}</div>
				<small style="color:var(--text-muted);">${esc(ag.clienteTelefone || 'Sem tel')}</small>
			</td>
			<td>
				<div style="font-size:0.88rem; color:var(--text-main); font-weight:500;">${esc(ag.servicos)}</div>
				${ag.observacoes ? `<small style="color:var(--text-muted); display:block; font-style:italic;">Obs: ${esc(ag.observacoes)}</small>` : ''}
			</td>
			<td><span class="badge-price">R$ ${parseFloat(ag.valor || 0).toFixed(2)}</span></td>
			<td>${statusBadge}</td>
			<td>
				<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
					${ag.status === 'agendado' ? `
						<button type="button" class="btn btn-sm" style="background-color: var(--primary); color:#fff; padding:4px 8px; font-size:0.78rem;" onclick="iniciarOSDoAgendamento('${ag.id}')" title="Dar entrada no veículo e abrir O.S. agora">
							🚗 Iniciar O.S.
						</button>
					` : ''}

					${ag.clienteTelefone ? `
						<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.78rem; color:#16a34a; display:inline-flex; align-items:center; gap:4px;" onclick="abrirDisparoWhatsAppAgendamento('${ag.id}')" title="Enviar Lembrete e Detalhes via WhatsApp">
							💬 WhatsApp
						</button>
					` : ''}

					<a href="${linkCalendarWeb}" target="_blank" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.78rem;" title="Adicionar ao Google Calendar no Navegador">
						📅 Agenda
					</a>

					<button type="button" class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:0.78rem;" onclick="abrirModalReagendamento('${ag.id}')" title="Alterar data/hora">
						✏️
					</button>

					<button type="button" class="btn btn-sm" style="padding:4px 8px; font-size:0.78rem; background:transparent; border:1px solid #ef4444; color:#ef4444;" onclick="cancelarAgendamento('${ag.id}')" title="Cancelar Agendamento">
						❌
					</button>
				</div>
			</td>
		`;
		corpoTabelaAgendamentos.appendChild(tr);
	});
}

// Ação de Conversão: Transformar Agendamento em O.S. aberta imediatamente
window.iniciarOSDoAgendamento = function (id) {
	const agendamentos = obterAgendamentos();
	const ag = agendamentos.find((a) => a.id === id);
	if (!ag) return;

	// Cria o novo pedido O.S.
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const novoPedido = {
		id: 'os_' + Date.now(),
		cliente: ag.clienteNome,
		placa: ag.placa,
		cor: ag.cor,
		modelo: ag.modelo,
		data: obterDataHojeISO(),
		horaEntrada: obterHoraAtual(),
		servicos: ag.servicos,
		valor: parseFloat(ag.valor || 0),
		status: 'aberto',
		agendamentoOrigemId: ag.id
	};
	pedidos.push(novoPedido);
	localStorage.setItem('pedidos', JSON.stringify(pedidos));

	// Atualiza status do agendamento para em_andamento
	ag.status = 'em_andamento';
	salvarAgendamentos(agendamentos);

	// Redireciona para a tela de pedidos com mensagem
	window.location.replace('pedidos.html');
};

// Cancelar Agendamento
window.cancelarAgendamento = function (id) {
	const agendamentos = obterAgendamentos();
	const ag = agendamentos.find((a) => a.id === id);
	if (!ag) return;

	ag.status = 'cancelado';
	salvarAgendamentos(agendamentos);
	renderizarListaAgendamentos();
};

// Modal de Reagendamento
window.abrirModalReagendamento = function (id) {
	const agendamentos = obterAgendamentos();
	agendamentoSelecionado = agendamentos.find((a) => a.id === id);
	if (!agendamentoSelecionado || !modalReagendar) return;

	if (reagendarData) reagendarData.value = agendamentoSelecionado.data;
	if (reagendarHora) reagendarHora.value = agendamentoSelecionado.hora;
	modalReagendar.classList.add('open');
};

function fecharModalReagendamento() {
	agendamentoSelecionado = null;
	if (modalReagendar) modalReagendar.classList.remove('open');
}

if (modalReagendarX) modalReagendarX.addEventListener('click', fecharModalReagendamento);
if (modalCancelarReagendarBtn) modalCancelarReagendarBtn.addEventListener('click', fecharModalReagendamento);

if (formReagendar) {
	formReagendar.addEventListener('submit', (e) => {
		e.preventDefault();
		if (!agendamentoSelecionado) return;

		agendamentoSelecionado.data = reagendarData.value;
		agendamentoSelecionado.hora = reagendarHora.value;
		agendamentoSelecionado.status = 'agendado'; // restaura se estava cancelado

		const agendamentos = obterAgendamentos();
		const idx = agendamentos.findIndex((a) => a.id === agendamentoSelecionado.id);
		if (idx !== -1) {
			agendamentos[idx] = agendamentoSelecionado;
			salvarAgendamentos(agendamentos);
		}

		fecharModalReagendamento();
		renderizarListaAgendamentos();
	});
}

// Filtro de data
if (filtroDataAgendamento) {
	filtroDataAgendamento.addEventListener('change', renderizarListaAgendamentos);
}

document.addEventListener('DOMContentLoaded', () => {
	popularCoresAgendamento();
	popularServicosAgendamento();
	if (agendamentoData && !agendamentoData.value) {
		agendamentoData.value = obterDataHojeISO();
	}
	if (filtroDataAgendamento && !filtroDataAgendamento.value) {
		filtroDataAgendamento.value = obterDataHojeISO();
	}
	renderizarListaAgendamentos();
});

// Abertura do modal interativo de WhatsApp (Ideia 2 combinada com Ideia 1)
function abrirDisparoWhatsAppAgendamento(agId) {
	const ags = JSON.parse(localStorage.getItem('agendamentos')) || [];
	const ag = ags.find(item => item.id === agId);
	if (!ag) return;

	if (typeof WhatsAppService !== 'undefined') {
		WhatsAppService.abrirModalDisparo({
			tipo: 'agendamento',
			dados: ag,
			telefone: ag.clienteTelefone,
			titulo: 'Confirmar / Lembrar Agendamento'
		});
	} else {
		const telLimpo = (ag.clienteTelefone || '').replace(/\D/g, '');
		const msg = `Olá ${ag.clienteNome}! Confirmamos o seu agendamento em ${ag.data} às ${ag.hora}.`;
		window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
	}
}

window.abrirDisparoWhatsAppAgendamento = abrirDisparoWhatsAppAgendamento;

