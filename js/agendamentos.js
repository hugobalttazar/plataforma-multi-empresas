// ==========================================================================
// Gestão de Agendamentos e Horários
// ==========================================================================

const agendamentoForm = document.getElementById('agendamentoForm');
const agendamentoCliente = document.getElementById('agendamentoCliente');
const agendamentoVeiculoTipo = document.getElementById('agendamentoVeiculoTipo');
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

// Painel e Modal de Veículos do Cliente no Agendamento
const painelVeiculosClienteAgendamento = document.getElementById('painelVeiculosClienteAgendamento');
const agendamentoVeiculosTitulo = document.getElementById('agendamentoVeiculosTitulo');
const agendamentoVeiculosMeta = document.getElementById('agendamentoVeiculosMeta');
const agendamentoVeiculosGrid = document.getElementById('agendamentoVeiculosGrid');
const btnAbrirCadastroRapidoVeiculoAgendamento = document.getElementById('btnAbrirCadastroRapidoVeiculoAgendamento');
const modalCadastroRapidoVeiculoAgendamento = document.getElementById('modalCadastroRapidoVeiculoAgendamento');
const formCadastroRapidoVeiculoAgendamento = document.getElementById('formCadastroRapidoVeiculoAgendamento');
const btnFecharModalRapidoAgVeiculo = document.getElementById('btnFecharModalRapidoAgVeiculo');
const btnCancelarModalRapidoAgVeiculo = document.getElementById('btnCancelarModalRapidoAgVeiculo');
const rapidoAgVeiculoClienteNome = document.getElementById('rapidoAgVeiculoClienteNome');
const rapidoAgVeiculoTipo = document.getElementById('rapidoAgVeiculoTipo');
const rapidoAgVeiculoPlaca = document.getElementById('rapidoAgVeiculoPlaca');
const rapidoAgVeiculoModelo = document.getElementById('rapidoAgVeiculoModelo');
const rapidoAgVeiculoCor = document.getElementById('rapidoAgVeiculoCor');

let clienteSelecionadoAgendamento = null;
let veiculoSelecionadoAgId = null;

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
	if (window.DateBR) return window.DateBR.formatarParaBR(dataISO);
	if (String(dataISO).includes('/')) return dataISO;
	const [ano, mes, dia] = String(dataISO).split('-');
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
	if (agendamentoCor) {
		agendamentoCor.innerHTML = '';
		CORES_VEICULOS.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.id;
			opt.textContent = c.nome;
			agendamentoCor.appendChild(opt);
		});
		if (!agendamentoCor.dataset.listenerBound) {
			agendamentoCor.addEventListener('change', atualizarPreviewCorAgendamento);
			agendamentoCor.dataset.listenerBound = 'true';
		}
		atualizarPreviewCorAgendamento();
	}

	if (rapidoAgVeiculoCor) {
		rapidoAgVeiculoCor.innerHTML = '';
		CORES_VEICULOS.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.id;
			opt.textContent = c.nome;
			rapidoAgVeiculoCor.appendChild(opt);
		});
		rapidoAgVeiculoCor.value = 'prata';
	}
}

function normalizarTipoVeiculoAg(tipo) {
	if (typeof normalizarTipoVeiculo === 'function') {
		return normalizarTipoVeiculo(tipo);
	}
	const t = (tipo || '').toString().toLowerCase().trim();
	if (t === 'moto') return 'moto';
	if (t === 'caminhao' || t === 'caminhão') return 'caminhao';
	return 'carro';
}

function isSegmentoAutomotivoAg() {
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

function atualizarPreviewCorAgendamento() {
	if (!agendamentoCor || !previewCorAgendamento) return;
	const corObj = obterCorVeiculo(agendamentoCor.value);
	const tipoAtual = agendamentoVeiculoTipo ? agendamentoVeiculoTipo.value : 'carro';
	previewCorAgendamento.innerHTML = `
		${renderizarIconeCarro(corObj, 24, tipoAtual)}
		<small style="font-weight:600; color:var(--text-muted);">${corObj.nome}</small>
	`;
}

if (agendamentoVeiculoTipo) {
	agendamentoVeiculoTipo.addEventListener('change', atualizarPreviewCorAgendamento);
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

function encontrarClientePorNomeAg(nome) {
	if (!nome) return null;
	const termo = nome.trim().toLowerCase();
	if (!termo) return null;
	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	return clientes.find((c) => c.nome && c.nome.trim().toLowerCase() === termo) || null;
}

function aplicarVeiculoNoFormularioAgendamento(veiculo) {
	if (!veiculo) return;
	veiculoSelecionadoAgId = veiculo.id || veiculo.placa;
	if (agendamentoVeiculoTipo) agendamentoVeiculoTipo.value = normalizarTipoVeiculoAg(veiculo.tipo);
	if (agendamentoPlaca) agendamentoPlaca.value = (veiculo.placa || '').toUpperCase();
	if (agendamentoModelo) agendamentoModelo.value = veiculo.modelo || '';
	if (agendamentoCor && veiculo.cor) {
		agendamentoCor.value = veiculo.cor;
	}
	atualizarPreviewCorAgendamento();

	if (agendamentoVeiculosGrid) {
		agendamentoVeiculosGrid.querySelectorAll('.os-veiculo-option').forEach((btn) => {
			if (btn.dataset.vid === String(veiculoSelecionadoAgId)) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});
	}
}

function atualizarPainelVeiculosClienteAgendamento(clienteObj, autoSelecionar = true) {
	if (!painelVeiculosClienteAgendamento) return;

	if (!isSegmentoAutomotivoAg() || !clienteObj) {
		painelVeiculosClienteAgendamento.style.display = 'none';
		if (agendamentoVeiculosGrid) agendamentoVeiculosGrid.innerHTML = '';
		return;
	}

	clienteSelecionadoAgendamento = clienteObj;
	const veiculos = Array.isArray(clienteObj.veiculos) ? clienteObj.veiculos : [];
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	painelVeiculosClienteAgendamento.style.display = 'block';
	if (agendamentoVeiculosTitulo) {
		agendamentoVeiculosTitulo.textContent = `Veículos de ${clienteObj.nome}`;
	}
	if (agendamentoVeiculosMeta) {
		if (veiculos.length === 0) {
			agendamentoVeiculosMeta.textContent = 'Nenhum veículo cadastrado para este cliente ainda';
		} else if (veiculos.length === 1) {
			agendamentoVeiculosMeta.textContent = '1 veículo cadastrado · selecionado automaticamente';
		} else {
			agendamentoVeiculosMeta.textContent = `${veiculos.length} veículos cadastrados · clique em uma placa para selecionar`;
		}
	}

	if (!agendamentoVeiculosGrid) return;
	agendamentoVeiculosGrid.innerHTML = '';

	if (veiculos.length === 0) {
		agendamentoVeiculosGrid.innerHTML = `
			<div class="os-veiculos-empty" style="grid-column: 1 / -1;">
				Este cliente ainda não possui placas cadastradas. Clique em <strong>+ Cadastrar Veículo</strong> para salvar a placa e o modelo diretamente no cadastro dele.
			</div>
		`;
		return;
	}

	veiculos.forEach((v) => {
		const vid = v.id || v.placa;
		const corObj = obterCorVeiculo(v.cor);
		const tipoLabel = typeof obterLabelTipoVeiculo === 'function'
			? obterLabelTipoVeiculo(v.tipo, false)
			: (v.tipo === 'moto' ? 'Moto' : (v.tipo === 'caminhao' ? 'Caminhão' : 'Carro'));
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'os-veiculo-option' + (String(veiculoSelecionadoAgId) === String(vid) ? ' active' : '');
		btn.dataset.vid = String(vid);
		btn.innerHTML = `
			${renderizarIconeCarro(corObj, 28, v.tipo)}
			<div class="os-veiculo-option-info">
				<span class="os-veiculo-option-placa">${esc(v.placa)}</span>
				<span class="os-veiculo-option-desc">${esc(tipoLabel)} · ${esc(v.modelo || 'Modelo não inf.')} · ${esc(corObj.nome)}</span>
			</div>
		`;
		btn.addEventListener('click', () => {
			aplicarVeiculoNoFormularioAgendamento(v);
		});
		agendamentoVeiculosGrid.appendChild(btn);
	});

	if (autoSelecionar && veiculos.length === 1) {
		aplicarVeiculoNoFormularioAgendamento(veiculos[0]);
	}
}

function abrirModalCadastroRapidoVeiculoAg() {
	const clienteAtual = clienteSelecionadoAgendamento || encontrarClientePorNomeAg(agendamentoCliente ? agendamentoCliente.value : '');
	if (!clienteAtual) {
		if (window.UI) window.UI.toast('Selecione primeiro um cliente cadastrado antes de vincular um veículo.', 'warning');
		if (agendamentoCliente) agendamentoCliente.focus();
		return;
	}

	clienteSelecionadoAgendamento = clienteAtual;
	if (rapidoAgVeiculoClienteNome) {
		rapidoAgVeiculoClienteNome.textContent = clienteAtual.tel1
			? `${clienteAtual.nome} (${clienteAtual.tel1})`
			: clienteAtual.nome;
	}
	if (rapidoAgVeiculoTipo && agendamentoVeiculoTipo) {
		rapidoAgVeiculoTipo.value = agendamentoVeiculoTipo.value || 'carro';
	}
	if (rapidoAgVeiculoPlaca) {
		rapidoAgVeiculoPlaca.value = agendamentoPlaca ? agendamentoPlaca.value.trim().toUpperCase() : '';
	}
	if (rapidoAgVeiculoModelo) {
		rapidoAgVeiculoModelo.value = agendamentoModelo ? agendamentoModelo.value.trim() : '';
	}
	if (rapidoAgVeiculoCor && agendamentoCor) {
		rapidoAgVeiculoCor.value = agendamentoCor.value || 'prata';
	}

	if (modalCadastroRapidoVeiculoAgendamento) {
		modalCadastroRapidoVeiculoAgendamento.classList.add('open');
		modalCadastroRapidoVeiculoAgendamento.style.display = 'flex';
		setTimeout(() => {
			if (rapidoAgVeiculoPlaca && !rapidoAgVeiculoPlaca.value) {
				rapidoAgVeiculoPlaca.focus();
			} else if (rapidoAgVeiculoModelo) {
				rapidoAgVeiculoModelo.focus();
			}
		}, 60);
	}
}

function fecharModalCadastroRapidoVeiculoAg() {
	if (modalCadastroRapidoVeiculoAgendamento) {
		modalCadastroRapidoVeiculoAgendamento.classList.remove('open');
		modalCadastroRapidoVeiculoAgendamento.style.display = 'none';
	}
	if (formCadastroRapidoVeiculoAgendamento) {
		formCadastroRapidoVeiculoAgendamento.reset();
	}
}

if (btnAbrirCadastroRapidoVeiculoAgendamento) {
	btnAbrirCadastroRapidoVeiculoAgendamento.addEventListener('click', abrirModalCadastroRapidoVeiculoAg);
}
if (btnFecharModalRapidoAgVeiculo) {
	btnFecharModalRapidoAgVeiculo.addEventListener('click', fecharModalCadastroRapidoVeiculoAg);
}
if (btnCancelarModalRapidoAgVeiculo) {
	btnCancelarModalRapidoAgVeiculo.addEventListener('click', fecharModalCadastroRapidoVeiculoAg);
}

if (formCadastroRapidoVeiculoAgendamento) {
	formCadastroRapidoVeiculoAgendamento.addEventListener('submit', (e) => {
		e.preventDefault();
		const clienteRef = clienteSelecionadoAgendamento || encontrarClientePorNomeAg(agendamentoCliente ? agendamentoCliente.value : '');
		if (!clienteRef) {
			if (window.UI) window.UI.toast('Cliente selecionado não encontrado.', 'error');
			return;
		}

		const tipo = rapidoAgVeiculoTipo ? rapidoAgVeiculoTipo.value : 'carro';
		const placa = (rapidoAgVeiculoPlaca ? rapidoAgVeiculoPlaca.value : '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
		const modelo = rapidoAgVeiculoModelo ? rapidoAgVeiculoModelo.value.trim() : '';
		const cor = rapidoAgVeiculoCor ? rapidoAgVeiculoCor.value : 'prata';

		if (!placa || placa.length < 3) {
			if (window.UI) window.UI.toast('Informe uma placa válida para cadastrar.', 'warning');
			if (rapidoAgVeiculoPlaca) rapidoAgVeiculoPlaca.focus();
			return;
		}
		if (!modelo) {
			if (window.UI) window.UI.toast('Informe o modelo do veículo.', 'warning');
			if (rapidoAgVeiculoModelo) rapidoAgVeiculoModelo.focus();
			return;
		}

		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const idx = clientes.findIndex((c) =>
			c.nome && c.nome.trim().toLowerCase() === clienteRef.nome.trim().toLowerCase() &&
			((!clienteRef.tel1) || (c.tel1 || '') === (clienteRef.tel1 || ''))
		);

		if (idx === -1) {
			if (window.UI) window.UI.toast('Não foi possível localizar o cliente no cadastro.', 'error');
			return;
		}

		if (!Array.isArray(clientes[idx].veiculos)) {
			clientes[idx].veiculos = [];
		}

		const placaLimpa = placa.replace(/-/g, '');
		const jaExiste = clientes[idx].veiculos.find((v) => (v.placa || '').replace(/-/g, '').toUpperCase() === placaLimpa);
		if (jaExiste) {
			if (window.UI) window.UI.toast(`A placa ${placa} já está cadastrada para este cliente. Selecionando veículo existente.`, 'info');
			clienteSelecionadoAgendamento = clientes[idx];
			fecharModalCadastroRapidoVeiculoAg();
			atualizarPainelVeiculosClienteAgendamento(clientes[idx], false);
			aplicarVeiculoNoFormularioAgendamento(jaExiste);
			return;
		}

		const novoVeiculo = {
			id: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			tipo: normalizarTipoVeiculoAg(tipo),
			placa,
			modelo,
			cor: cor || 'prata'
		};

		clientes[idx].veiculos.push(novoVeiculo);
		localStorage.setItem('clientes', JSON.stringify(clientes));

		clienteSelecionadoAgendamento = clientes[idx];
		fecharModalCadastroRapidoVeiculoAg();
		atualizarPainelVeiculosClienteAgendamento(clientes[idx], false);
		aplicarVeiculoNoFormularioAgendamento(novoVeiculo);

		if (window.UI) {
			window.UI.toast(`Veículo ${placa} (${modelo}) salvo no cadastro de ${clientes[idx].nome}!`, 'success');
		}
	});
}

// Autocomplete de clientes
if (agendamentoCliente && sugestoesClientesAgendamento) {
	agendamentoCliente.addEventListener('input', () => {
		const termo = agendamentoCliente.value.trim().toLowerCase();
		const termoDigitos = termo.replace(/\D/g, '');
		sugestoesClientesAgendamento.innerHTML = '';

		if (clienteSelecionadoAgendamento && clienteSelecionadoAgendamento.nome.trim().toLowerCase() !== termo) {
			clienteSelecionadoAgendamento = null;
			veiculoSelecionadoAgId = null;
			agendamentoCliente.dataset.clienteId = '';
			agendamentoCliente.dataset.telefone = '';
		}

		if (termo.length < 1) {
			sugestoesClientesAgendamento.style.display = 'none';
			atualizarPainelVeiculosClienteAgendamento(null);
			return;
		}

		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const clienteExato = clientes.find((c) => c.nome && c.nome.trim().toLowerCase() === termo);
		if (clienteExato) {
			agendamentoCliente.dataset.clienteId = clienteExato.id || '';
			agendamentoCliente.dataset.telefone = clienteExato.tel1 || '';
			atualizarPainelVeiculosClienteAgendamento(clienteExato, false);
		} else {
			atualizarPainelVeiculosClienteAgendamento(null);
		}

		const filtrados = clientes.filter((c) => {
			const nomeMatch = c.nome && c.nome.toLowerCase().includes(termo);
			const tel1Limpo = (c.tel1 || '').replace(/\D/g, '');
			const tel2Limpo = (c.tel2 || '').replace(/\D/g, '');
			const telMatch = (c.tel1 && c.tel1.includes(termo)) ||
				(termoDigitos.length > 0 && (tel1Limpo.includes(termoDigitos) || tel2Limpo.includes(termoDigitos)));
			return nomeMatch || telMatch;
		});

		if (filtrados.length === 0) {
			sugestoesClientesAgendamento.style.display = 'none';
			return;
		}

		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		sugestoesClientesAgendamento.style.display = 'block';
		filtrados.slice(0, 6).forEach((c) => {
			const qtdVeic = Array.isArray(c.veiculos) ? c.veiculos.length : 0;
			const badgeVeic = isSegmentoAutomotivoAg() && qtdVeic > 0
				? `<small style="color:var(--primary); font-weight:600; margin-left:6px;">(${qtdVeic} ${qtdVeic === 1 ? 'veículo' : 'veículos'})</small>`
				: '';
			const div = document.createElement('div');
			div.className = 'sugestao-item';
			div.innerHTML = `<strong>${esc(c.nome)}</strong> <small style="color:var(--text-muted);">${esc(c.tel1 || '')}</small>${badgeVeic}`;
			div.addEventListener('click', () => {
				agendamentoCliente.value = c.nome;
				agendamentoCliente.dataset.clienteId = c.id || '';
				agendamentoCliente.dataset.telefone = c.tel1 || '';
				veiculoSelecionadoAgId = null;

				atualizarPainelVeiculosClienteAgendamento(c, true);
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
if (rapidoAgVeiculoPlaca) {
	rapidoAgVeiculoPlaca.addEventListener('input', (e) => {
		e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
	});
}

// Salvar Novo Agendamento
if (agendamentoForm) {
	agendamentoForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		if (window.SaasGuard && !window.SaasGuard.bloquearSeSuspenso('novo agendamento')) {
			return;
		}

		const servicosSelecionados = Array.from(agendamentoServico.selectedOptions).map((o) => o.value).join(', ');
		const valorNum = parseFloat(agendamentoValor.value || 0);

		const rawAgData = agendamentoData ? agendamentoData.value.trim() : '';
		const dataAgISO = rawAgData
			? (window.DateBR ? window.DateBR.converterBRParaISO(rawAgData) : rawAgData)
			: obterDataHojeISO();
		if (rawAgData && !dataAgISO) {
			if (window.UI) window.UI.toast('Informe uma Data Marcada válida no formato dd/mm/aaaa.', 'warning');
			if (agendamentoData) agendamentoData.focus();
			return;
		}

		const veiculoTipo = agendamentoVeiculoTipo ? normalizarTipoVeiculoAg(agendamentoVeiculoTipo.value) : 'carro';

		const novoAgendamento = {
			id: 'ag_' + Date.now(),
			clienteNome: agendamentoCliente.value.trim(),
			clienteTelefone: agendamentoCliente.dataset.telefone || '',
			veiculoTipo: veiculoTipo,
			placa: agendamentoPlaca.value.trim().toUpperCase(),
			cor: agendamentoCor.value,
			modelo: agendamentoModelo.value.trim(),
			data: dataAgISO,
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
		clienteSelecionadoAgendamento = null;
		veiculoSelecionadoAgId = null;
		if (agendamentoCliente) {
			agendamentoCliente.dataset.clienteId = '';
			agendamentoCliente.dataset.telefone = '';
		}
		atualizarPainelVeiculosClienteAgendamento(null);
		if (agendamentoVeiculoTipo) agendamentoVeiculoTipo.value = 'carro';
		if (agendamentoData) {
			if (window.DateBR) window.DateBR.setInputISO(agendamentoData, obterDataHojeISO());
			else agendamentoData.value = obterDataHojeISO();
		}
		if (agendamentoHora) agendamentoHora.value = '09:00';
		atualizarPreviewCorAgendamento();
		renderizarListaAgendamentos();
		if (window.PublicoService) {
			window.PublicoService.publicarAgendaPublicaConfig(agendamentos).catch(() => {});
		}
		
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
	const rawFiltro = filtroDataAgendamento ? filtroDataAgendamento.value.trim() : '';
	const dataFiltro = rawFiltro
		? (window.DateBR ? (window.DateBR.converterBRParaISO(rawFiltro) || '') : rawFiltro)
		: '';
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

		const isAuto = isSegmentoAutomotivoAg();
		const identCelula = isAuto
			? `
				<div class="veiculo-info-cell">
					${renderizarIconeCarro(corObj, 26, ag.veiculoTipo)}
					<div class="veiculo-meta">
						<span class="badge-placa">${esc(ag.placa || 'SEM PLACA')}</span>
						<span class="veiculo-cor-nome">${esc(corObj.nome)}${modeloTexto}</span>
					</div>
				</div>
			`
			: `
				<div>
					<strong style="color:var(--text-main);">${esc(ag.itemDescricao || ag.modelo || 'Atendimento')}</strong>
					${ag.origem === 'publico' ? '<div><span class="badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.72rem;">🌐 Autoagendamento</span></div>' : ''}
				</div>
			`;

		tr.innerHTML = `
			<td>
				<div style="font-weight:700; color:var(--text-main); font-size: 0.95rem;">${esc(ag.hora)}</div>
				<small style="color:var(--text-muted); font-size:0.8rem;">${formatarDataBR(ag.data)} (${ag.duracaoMinutos || 60}m)</small>
			</td>
			<td>
				${identCelula}
				${isAuto && ag.origem === 'publico' ? '<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.7rem; margin-top:4px;">🌐 Autoagendamento</span>' : ''}
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
		veiculoTipo: normalizarTipoVeiculoAg(ag.veiculoTipo),
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
	if (window.PublicoService) {
		window.PublicoService.publicarAgendaPublicaConfig(agendamentos).catch(() => {});
	}
};

// Modal de Reagendamento
window.abrirModalReagendamento = function (id) {
	const agendamentos = obterAgendamentos();
	agendamentoSelecionado = agendamentos.find((a) => a.id === id);
	if (!agendamentoSelecionado || !modalReagendar) return;

	if (reagendarData) {
		if (window.DateBR) window.DateBR.setInputISO(reagendarData, agendamentoSelecionado.data);
		else reagendarData.value = agendamentoSelecionado.data;
	}
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

		const novaDataISO = window.DateBR
			? window.DateBR.converterBRParaISO(reagendarData.value)
			: reagendarData.value;
		if (!novaDataISO) {
			if (window.UI) window.UI.toast('Informe uma Nova Data válida no formato dd/mm/aaaa.', 'warning');
			if (reagendarData) reagendarData.focus();
			return;
		}

		agendamentoSelecionado.data = novaDataISO;
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
	filtroDataAgendamento.addEventListener('input', () => {
		const val = filtroDataAgendamento.value.trim();
		if (!val || (window.DateBR && window.DateBR.converterBRParaISO(val))) {
			renderizarListaAgendamentos();
		}
	});
}

const btnVerTodosAgendamentos = document.getElementById('btnVerTodosAgendamentos');
if (btnVerTodosAgendamentos) {
	btnVerTodosAgendamentos.addEventListener('click', () => {
		if (filtroDataAgendamento) {
			if (window.DateBR) window.DateBR.setInputISO(filtroDataAgendamento, '');
			else filtroDataAgendamento.value = '';
		}
		renderizarListaAgendamentos();
	});
}

document.addEventListener('DOMContentLoaded', () => {
	popularCoresAgendamento();
	popularServicosAgendamento();
	if (agendamentoData && !agendamentoData.value) {
		if (window.DateBR) window.DateBR.setInputISO(agendamentoData, obterDataHojeISO());
		else agendamentoData.value = obterDataHojeISO();
	}
	if (filtroDataAgendamento && !filtroDataAgendamento.value) {
		if (window.DateBR) window.DateBR.setInputISO(filtroDataAgendamento, obterDataHojeISO());
		else filtroDataAgendamento.value = obterDataHojeISO();
	}
	renderizarListaAgendamentos();

	// Sincronização Pública de Autoagendamento
	const syncAgendaPublica = () => {
		if (!window.PublicoService) return;
		window.PublicoService.publicarAgendaPublicaConfig().catch(() => {});
		window.PublicoService.iniciarListenerAgendamentosPublicos((qtd) => {
			renderizarListaAgendamentos();
			if (window.UI && qtd > 0) {
				window.UI.toast(`${qtd} novo(s) pré-agendamento(s) online recebido(s)!`, 'info', 4500);
			}
		});
	};
	setTimeout(syncAgendaPublica, 450);

	const btnLinkAgendaPub = document.getElementById('btnCopiarLinkAgendaPublica');
	if (btnLinkAgendaPub) {
		btnLinkAgendaPub.addEventListener('click', async () => {
			if (!window.PublicoService) return;
			try {
				await window.PublicoService.publicarAgendaPublicaConfig();
				const link = window.PublicoService.obterLinkAgendaPublica();
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(link);
				}
				if (window.UI) window.UI.toast(`Link de Autoagendamento copiado: ${link}`, 'success', 4500);
			} catch (err) {
				if (window.UI) window.UI.toast('Não foi possível sincronizar o link agora.', 'warning');
			}
		});
	}

	window.addEventListener('cloudDataChanged', (e) => {
		if (['servicos', 'agendamentos', 'config_negocio'].includes(e?.detail)) {
			popularServicosAgendamento();
			renderizarListaAgendamentos();
			if (window.PublicoService) window.PublicoService.publicarAgendaPublicaConfig().catch(() => {});
		}
	});
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
		let telLimpo = (ag.clienteTelefone || '').replace(/\D/g, '').replace(/^0+/, '');
		if (telLimpo && !telLimpo.startsWith('55') && telLimpo.length <= 11) telLimpo = `55${telLimpo}`;
		const msg = `Olá ${ag.clienteNome}! Confirmamos o seu agendamento em ${formatarDataBR(ag.data)} às ${ag.hora}.`;
		const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
		const canalSalvo = localStorage.getItem('whatsapp_canal_preferido');
		const baseUrl = (isDesktop && canalSalvo === 'web') ? 'https://web.whatsapp.com/send' : 'https://api.whatsapp.com/send';
		const url = telLimpo ? `${baseUrl}?phone=${telLimpo}&text=${encodeURIComponent(msg)}` : `${baseUrl}?text=${encodeURIComponent(msg)}`;
		window.open(url, '_blank');
	}
}

window.abrirDisparoWhatsAppAgendamento = abrirDisparoWhatsAppAgendamento;

