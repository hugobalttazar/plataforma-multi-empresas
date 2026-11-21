// ==========================================================================
// Serviço Central de Caixa e Utilitários Automotivos
// ==========================================================================

const CORES_VEICULOS = [
	{ id: 'branco', nome: 'Branco', hex: '#f8fafc', borda: '#94a3b8', texto: '#0f172a' },
	{ id: 'preto', nome: 'Preto', hex: '#18181b', borda: '#09090b', texto: '#ffffff' },
	{ id: 'prata', nome: 'Prata', hex: '#cbd5e1', borda: '#94a3b8', texto: '#0f172a' },
	{ id: 'cinza', nome: 'Cinza / Chumbo', hex: '#64748b', borda: '#475569', texto: '#ffffff' },
	{ id: 'vermelho', nome: 'Vermelho', hex: '#dc2626', borda: '#b91c1c', texto: '#ffffff' },
	{ id: 'azul', nome: 'Azul', hex: '#2563eb', borda: '#1d4ed8', texto: '#ffffff' },
	{ id: 'verde', nome: 'Verde', hex: '#16a34a', borda: '#15803d', texto: '#ffffff' },
	{ id: 'amarelo', nome: 'Amarelo', hex: '#eab308', borda: '#ca8a04', texto: '#0f172a' },
	{ id: 'laranja', nome: 'Laranja', hex: '#ea580c', borda: '#c2410c', texto: '#ffffff' },
	{ id: 'marrom', nome: 'Marrom / Bege', hex: '#78350f', borda: '#451a03', texto: '#ffffff' },
	{ id: 'vinho', nome: 'Vinho', hex: '#831843', borda: '#701a75', texto: '#ffffff' },
	{ id: 'outro', nome: 'Outro', hex: '#8b5cf6', borda: '#7c3aed', texto: '#ffffff' }
];

function obterCorVeiculo(corIdOuNome) {
	if (!corIdOuNome) return CORES_VEICULOS[0];
	const normalizado = corIdOuNome.toString().toLowerCase().trim();
	const encontrada = CORES_VEICULOS.find(
		(c) => c.id === normalizado || c.nome.toLowerCase() === normalizado
	);
	return encontrada || { id: 'personalizada', nome: corIdOuNome, hex: '#3b82f6', borda: '#2563eb', texto: '#ffffff' };
}

function normalizarPlaca(placa) {
	return (placa || '').toString().toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
}

function normalizarTipoVeiculo(tipo) {
	const t = (tipo || '').toString().toLowerCase().trim();
	if (t === 'moto') return 'moto';
	if (t === 'caminhao' || t === 'caminhão') return 'caminhao';
	return 'carro';
}

function obterLabelTipoVeiculo(tipo, comIcone = false) {
	const t = normalizarTipoVeiculo(tipo);
	if (t === 'moto') return comIcone ? '🏍️ Moto' : 'Moto';
	if (t === 'caminhao') return comIcone ? '🚛 Caminhão' : 'Caminhão';
	return comIcone ? '🚗 Carro' : 'Carro';
}

function renderizarIconeCarro(corObj, tamanho = 28, tipo = 'carro') {
	const c = typeof corObj === 'string' ? obterCorVeiculo(corObj) : (corObj || CORES_VEICULOS[0]);
	const iconSize = Math.round(tamanho * 0.72);
	const tipoNorm = normalizarTipoVeiculo(tipo);
	const labelTipo = obterLabelTipoVeiculo(tipoNorm, false);

	let svgContent = '';
	if (tipoNorm === 'moto') {
		svgContent = `
			<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="5.5" cy="16.5" r="3" stroke="${c.texto}" stroke-width="2"/>
				<circle cx="18.5" cy="16.5" r="3" stroke="${c.texto}" stroke-width="2"/>
				<path d="M5.5 16.5L9.5 10.5H14.5L18.5 16.5M14.5 10.5L16.5 7.5H19M9.5 10.5L8 8.5H5.5" stroke="${c.texto}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		`;
	} else if (tipoNorm === 'caminhao') {
		svgContent = `
			<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M2 6.5C2 5.95 2.45 5.5 3 5.5H14.5C15.05 5.5 15.5 5.95 15.5 6.5V16.5H2V6.5Z" stroke="${c.texto}" stroke-width="2" stroke-linejoin="round"/>
				<path d="M15.5 9.5H19L21.5 12.5V16.5H15.5V9.5Z" stroke="${c.texto}" stroke-width="2" stroke-linejoin="round"/>
				<circle cx="6.5" cy="17.5" r="2.2" fill="${c.hex}" stroke="${c.texto}" stroke-width="2"/>
				<circle cx="18" cy="17.5" r="2.2" fill="${c.hex}" stroke="${c.texto}" stroke-width="2"/>
			</svg>
		`;
	} else {
		svgContent = `
			<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M5 11L6.5 6.5C6.7 5.9 7.3 5.5 8 5.5H16C16.7 5.5 17.3 5.9 17.5 6.5L19 11M5 11H19M5 11C3.9 11 3 11.9 3 13V17C3 17.6 3.4 18 4 18H5M19 11C20.1 11 21 11.9 21 13V17C21 17.6 20.6 18 20 18H19M7 18H17" stroke="${c.texto}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="7.5" cy="14.5" r="1.5" fill="${c.texto}"/>
				<circle cx="16.5" cy="14.5" r="1.5" fill="${c.texto}"/>
			</svg>
		`;
	}

	return `
		<span class="veiculo-icone-wrapper" title="${labelTipo} - Cor: ${c.nome}" style="display:inline-flex; align-items:center; justify-content:center; width:${tamanho}px; height:${tamanho}px; min-width:${tamanho}px; border-radius:6px; background-color:${c.hex}; border:2px solid ${c.borda}; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
			${svgContent}
		</span>
	`;
}

function obterDataHojeISO() {
	const now = new Date();
	const ano = now.getFullYear();
	const mes = String(now.getMonth() + 1).padStart(2, '0');
	const dia = String(now.getDate()).padStart(2, '0');
	return `${ano}-${mes}-${dia}`;
}

function obterHoraAtual() {
	const now = new Date();
	return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// --------------------------------------------------------------------------
// Gerenciador de Livro Caixa com Fechamento de Contingência Automático
// --------------------------------------------------------------------------
class CaixaService {
	static verificarRotinaViradaDia() {
		const hoje = obterDataHojeISO();
		let caixaAtual = JSON.parse(localStorage.getItem('caixa_atual'));
		let fechamentos = JSON.parse(localStorage.getItem('caixas_fechados')) || [];

		// Se nunca houve caixa ou está vazio
		if (!caixaAtual) {
			caixaAtual = {
				data: hoje,
				status: 'aberto',
				horaAbertura: obterHoraAtual(),
				fundoTroco: 0
			};
			localStorage.setItem('caixa_atual', JSON.stringify(caixaAtual));
			return;
		}

		// Se a data do caixa em memória for anterior ao dia de hoje
		if (caixaAtual.data < hoje) {
			// Se o caixa do dia anterior ainda estava em aberto, fecha automaticamente
			if (caixaAtual.status === 'aberto') {
				const resumoDiaAnterior = CaixaService.calcularResumoDia(caixaAtual.data);
				const fechamentoAnterior = {
					data: caixaAtual.data,
					horaFechamento: '23:59',
					status: 'fechado',
					automatico: true,
					motivoFechamento: 'Fechamento automático por virada de dia',
					fundoTroco: parseFloat(caixaAtual.fundoTroco || 0),
					totalValor: resumoDiaAnterior.totalValor,
					totalServicos: resumoDiaAnterior.totalServicos,
					totalSaidas: resumoDiaAnterior.totalSaidas,
					breakdown: resumoDiaAnterior.breakdown,
					dataRegistro: new Date().toISOString()
				};

				// Evita duplicatas para a mesma data
				fechamentos = fechamentos.filter(f => f.data !== caixaAtual.data);
				fechamentos.push(fechamentoAnterior);
				localStorage.setItem('caixas_fechados', JSON.stringify(fechamentos));
			}

			// Abre o caixa do novo dia normalmente
			caixaAtual = {
				data: hoje,
				status: 'aberto',
				horaAbertura: obterHoraAtual(),
				fundoTroco: 0
			};
			localStorage.setItem('caixa_atual', JSON.stringify(caixaAtual));
		}
	}

	static calcularResumoDia(dataAlvo) {
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const saidas = JSON.parse(localStorage.getItem('caixa_saidas')) || [];
		const entradasAvulsas = JSON.parse(localStorage.getItem('caixa_entradas')) || [];
		
		let totalValor = 0;
		let totalServicos = 0;
		let totalSaidas = 0;
		let totalEntradasAvulsas = 0;
		let totalFaturadoDia = 0;
		const breakdown = {
			'Pix': 0,
			'Dinheiro': 0,
			'Cartão de Crédito': 0,
			'Cartão de Débito': 0,
			'A Prazo / Fiado': 0,
			'Pacote / Crédito': 0,
			'Outro': 0
		};

		pedidos.forEach(p => {
			// Considera pedidos com status encerrado ou legado naquela data
			const dataReferencia = p.dataEncerramento || p.data;
			const estaEncerrado = !p.status || p.status === 'encerrado';

			if (dataReferencia === dataAlvo && estaEncerrado) {
				const v = parseFloat(p.valor || 0);
				totalServicos++;

				const forma = p.formaPagamento || 'Outro';
				if (forma === 'Faturado / A Receber') {
					totalFaturadoDia += v;
					return;
				}

				totalValor += v;
				if (breakdown[forma] !== undefined) {
					breakdown[forma] += v;
				} else {
					breakdown['Outro'] += v;
				}
			}
		});

		entradasAvulsas.forEach(e => {
			if (e.data === dataAlvo) {
				const v = parseFloat(e.valor || 0);
				totalValor += v;
				totalEntradasAvulsas += v;
				const forma = e.formaPagamento || 'Outro';
				if (breakdown[forma] !== undefined) {
					breakdown[forma] += v;
				} else {
					breakdown['Outro'] += v;
				}
			}
		});

		saidas.forEach(s => {
			if (s.data === dataAlvo) {
				totalSaidas += parseFloat(s.valor || 0);
			}
		});

		return { totalValor, totalServicos, breakdown, totalSaidas, totalEntradasAvulsas, totalFaturadoDia };
	}

	static registrarEntrada({ valor, formaPagamento = 'Pix', categoria = 'Entrada Avulsa', origem = 'avulso', referenciaId = '', cliente = '', descricao = '' }) {
		const entradas = JSON.parse(localStorage.getItem('caixa_entradas')) || [];
		const novaEntrada = {
			id: 'ent_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
			data: obterDataHojeISO(),
			hora: obterHoraAtual(),
			timestamp: new Date().toISOString(),
			valor: parseFloat(valor || 0),
			formaPagamento: formaPagamento || 'Pix',
			categoria: categoria || 'Entrada Avulsa',
			origem: origem || 'avulso',
			referenciaId: referenciaId ? String(referenciaId) : '',
			cliente: cliente || '',
			descricao: descricao || '',
			tipo: 'entrada_avulsa'
		};
		entradas.push(novaEntrada);
		localStorage.setItem('caixa_entradas', JSON.stringify(entradas));
		return novaEntrada;
	}

	static getEntradasDia(dataAlvo) {
		const entradas = JSON.parse(localStorage.getItem('caixa_entradas')) || [];
		return entradas.filter(e => e.data === dataAlvo);
	}

	static removerEntrada(id) {
		let entradas = JSON.parse(localStorage.getItem('caixa_entradas')) || [];
		entradas = entradas.filter(e => String(e.id) !== String(id));
		localStorage.setItem('caixa_entradas', JSON.stringify(entradas));
	}

	static registrarSaida(valor, categoria, descricao) {
		const saidas = JSON.parse(localStorage.getItem('caixa_saidas')) || [];
		const novaSaida = {
			id: Date.now().toString(),
			data: obterDataHojeISO(),
			hora: obterHoraAtual(),
			timestamp: new Date().toISOString(),
			valor: parseFloat(valor),
			categoria: categoria,
			descricao: descricao,
			tipo: 'saida'
		};
		saidas.push(novaSaida);
		localStorage.setItem('caixa_saidas', JSON.stringify(saidas));
		return novaSaida;
	}

	static getSaidasDia(dataAlvo) {
		const saidas = JSON.parse(localStorage.getItem('caixa_saidas')) || [];
		return saidas.filter(s => s.data === dataAlvo);
	}

	static removerSaida(id) {
		let saidas = JSON.parse(localStorage.getItem('caixa_saidas')) || [];
		saidas = saidas.filter(s => s.id !== id.toString());
		localStorage.setItem('caixa_saidas', JSON.stringify(saidas));
	}

	// ----------------------------------------------------------------------
	// Contas a Pagar e a Receber (contas_financeiras)
	// ----------------------------------------------------------------------
	static getContas() {
		try {
			const lista = JSON.parse(localStorage.getItem('contas_financeiras')) || [];
			return Array.isArray(lista) ? lista : [];
		} catch (e) {
			return [];
		}
	}

	static salvarContas(lista) {
		localStorage.setItem('contas_financeiras', JSON.stringify(lista || []));
	}

	static salvarConta(dados) {
		const tipo = dados.tipo === 'receber' ? 'receber' : 'pagar';
		const descricao = (dados.descricao || '').trim();
		const valor = Math.max(0, parseFloat(dados.valor || 0) || 0);
		const vencimento = (dados.vencimento || '').trim();

		if (!descricao || valor <= 0 || !vencimento) {
			return { sucesso: false, erro: 'Preencha descrição, valor maior que zero e data de vencimento.' };
		}

		const lista = this.getContas();
		if (dados.id) {
			const idx = lista.findIndex(c => String(c.id) === String(dados.id));
			if (idx !== -1) {
				lista[idx] = {
					...lista[idx],
					tipo,
					descricao,
					categoria: (dados.categoria || (tipo === 'pagar' ? 'Despesa Fixa' : 'Recebimento Futuro')).trim(),
					pessoa: (dados.pessoa || '').trim(),
					valor: Number(valor.toFixed(2)),
					vencimento,
					observacao: (dados.observacao || '').trim(),
					atualizadoEm: new Date().toISOString()
				};
				this.salvarContas(lista);
				return { sucesso: true, conta: lista[idx] };
			}
		}

		const nova = {
			id: 'cnt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
			tipo,
			descricao,
			categoria: (dados.categoria || (tipo === 'pagar' ? 'Despesa Fixa' : 'Recebimento Futuro')).trim(),
			pessoa: (dados.pessoa || '').trim(),
			valor: Number(valor.toFixed(2)),
			vencimento,
			observacao: (dados.observacao || '').trim(),
			status: 'pendente',
			dataPagamento: null,
			formaPagamento: null,
			caixaRefId: null,
			criadoEm: new Date().toISOString()
		};
		lista.push(nova);
		this.salvarContas(lista);
		return { sucesso: true, conta: nova };
	}

	static removerConta(id) {
		const lista = this.getContas().filter(c => String(c.id) !== String(id));
		this.salvarContas(lista);
	}

	static calcularStatusEfetivoConta(conta, hojeISO = null) {
		if (!conta) return 'pendente';
		if (conta.status === 'pago') return 'pago';
		const hoje = hojeISO || obterDataHojeISO();
		if (conta.vencimento && conta.vencimento < hoje) return 'vencido';
		if (conta.vencimento && conta.vencimento === hoje) return 'vence_hoje';
		return 'pendente';
	}

	static getContasComStatus({ tipo = 'todos', status = 'todos' } = {}) {
		const hoje = obterDataHojeISO();
		return this.getContas()
			.map(c => ({
				...c,
				statusEfetivo: this.calcularStatusEfetivoConta(c, hoje)
			}))
			.filter(c => {
				if (tipo !== 'todos' && c.tipo !== tipo) return false;
				if (status !== 'todos') {
					if (status === 'aberto') {
						if (c.statusEfetivo === 'pago') return false;
					} else if (c.statusEfetivo !== status) {
						return false;
					}
				}
				return true;
			})
			.sort((a, b) => {
				if (a.statusEfetivo === 'pago' && b.statusEfetivo !== 'pago') return 1;
				if (a.statusEfetivo !== 'pago' && b.statusEfetivo === 'pago') return -1;
				return (a.vencimento || '').localeCompare(b.vencimento || '');
			});
	}

	static getAlertasVencimento(diasAntecedencia = 3) {
		const hoje = obterDataHojeISO();
		const partes = hoje.split('-').map(Number);
		const dtLimite = new Date(partes[0], (partes[1] || 1) - 1, partes[2] || 1);
		dtLimite.setDate(dtLimite.getDate() + Math.max(0, parseInt(diasAntecedencia, 10) || 0));
		const limiteISO = `${dtLimite.getFullYear()}-${String(dtLimite.getMonth() + 1).padStart(2, '0')}-${String(dtLimite.getDate()).padStart(2, '0')}`;

		const abertas = this.getContasComStatus({ status: 'aberto' });
		const vencidas = abertas.filter(c => c.statusEfetivo === 'vencido');
		const vencendoHoje = abertas.filter(c => c.statusEfetivo === 'vence_hoje');
		const proximosDias = abertas.filter(c => c.vencimento > hoje && c.vencimento <= limiteISO);

		const alertas = [...vencidas, ...vencendoHoje, ...proximosDias];
		const totalPagarAlerta = alertas.filter(c => c.tipo === 'pagar').reduce((acc, c) => acc + (parseFloat(c.valor || 0) || 0), 0);
		const totalReceberAlerta = alertas.filter(c => c.tipo === 'receber').reduce((acc, c) => acc + (parseFloat(c.valor || 0) || 0), 0);

		return {
			vencidas,
			vencendoHoje,
			proximosDias,
			alertas,
			qtdAlerta: alertas.length,
			totalPagarAlerta: Number(totalPagarAlerta.toFixed(2)),
			totalReceberAlerta: Number(totalReceberAlerta.toFixed(2))
		};
	}

	static darBaixaConta(id, formaPagamento = 'Pix') {
		const lista = this.getContas();
		const idx = lista.findIndex(c => String(c.id) === String(id));
		if (idx === -1) {
			return { sucesso: false, erro: 'Conta não encontrada.' };
		}

		const conta = lista[idx];
		if (conta.status === 'pago') {
			return { sucesso: false, erro: 'Esta conta já foi baixada anteriormente.' };
		}

		const valorNum = parseFloat(conta.valor || 0) || 0;
		const hoje = obterDataHojeISO();
		let movCaixa = null;

		if (conta.tipo === 'pagar') {
			movCaixa = this.registrarSaida(
				valorNum,
				conta.categoria || 'Despesa / Conta Paga',
				`Baixa Conta: ${conta.descricao}${conta.pessoa ? ' (' + conta.pessoa + ')' : ''}`
			);
		} else {
			movCaixa = this.registrarEntrada({
				valor: valorNum,
				formaPagamento: formaPagamento || 'Pix',
				categoria: conta.categoria || 'Conta Recebida',
				origem: 'conta_receber',
				referenciaId: conta.id,
				cliente: conta.pessoa || '',
				descricao: `Recebimento Conta: ${conta.descricao}${conta.pessoa ? ' (' + conta.pessoa + ')' : ''}`
			});
		}

		lista[idx] = {
			...conta,
			status: 'pago',
			dataPagamento: hoje,
			formaPagamento: formaPagamento || 'Pix',
			caixaRefId: movCaixa ? movCaixa.id : null,
			atualizadoEm: new Date().toISOString()
		};
		this.salvarContas(lista);

		return { sucesso: true, conta: lista[idx], movCaixa };
	}

	static getStatusHoje() {
		CaixaService.verificarRotinaViradaDia();
		const hoje = obterDataHojeISO();
		let caixaAtual = JSON.parse(localStorage.getItem('caixa_atual')) || {
			data: hoje,
			status: 'aberto',
			horaAbertura: obterHoraAtual(),
			fundoTroco: 0
		};

		const resumo = CaixaService.calcularResumoDia(hoje);
		return {
			...caixaAtual,
			...resumo
		};
	}

	static fecharCaixaHoje(fundoTroco = 0, observacoes = '') {
		const hoje = obterDataHojeISO();
		const resumo = CaixaService.calcularResumoDia(hoje);
		let fechamentos = JSON.parse(localStorage.getItem('caixas_fechados')) || [];

		const fechamentoHoje = {
			data: hoje,
			horaFechamento: obterHoraAtual(),
			status: 'fechado',
			automatico: false,
			observacoes: observacoes,
			fundoTroco: parseFloat(fundoTroco || 0),
			totalValor: resumo.totalValor,
			totalServicos: resumo.totalServicos,
			totalSaidas: resumo.totalSaidas,
			breakdown: resumo.breakdown,
			dataRegistro: new Date().toISOString()
		};

		fechamentos = fechamentos.filter(f => f.data !== hoje);
		fechamentos.push(fechamentoHoje);
		localStorage.setItem('caixas_fechados', JSON.stringify(fechamentos));

		const caixaAtual = {
			data: hoje,
			status: 'fechado',
			horaAbertura: (JSON.parse(localStorage.getItem('caixa_atual')) || {}).horaAbertura || '08:00',
			horaFechamento: fechamentoHoje.horaFechamento,
			fundoTroco: parseFloat(fundoTroco || 0)
		};
		localStorage.setItem('caixa_atual', JSON.stringify(caixaAtual));

		return fechamentoHoje;
	}

	static reabrirCaixaHoje() {
		const hoje = obterDataHojeISO();
		let fechamentos = JSON.parse(localStorage.getItem('caixas_fechados')) || [];
		
		// Guarda o valor do fundo de troco do fechamento original, caso exista
		const fechamentoHoje = fechamentos.find(f => f.data === hoje);

		fechamentos = fechamentos.filter(f => f.data !== hoje);
		localStorage.setItem('caixas_fechados', JSON.stringify(fechamentos));

		let caixaAtual = JSON.parse(localStorage.getItem('caixa_atual')) || {};

		caixaAtual = {
			data: hoje,
			status: 'aberto',
			// Preserva a hora de abertura original, senão pega a atual
			horaAbertura: caixaAtual.horaAbertura || obterHoraAtual(),
			// Preserva o troco que foi definido no fechamento ou o que já estava em andamento
			fundoTroco: fechamentoHoje ? (fechamentoHoje.fundoTroco || 0) : (caixaAtual.fundoTroco || 0)
		};
		localStorage.setItem('caixa_atual', JSON.stringify(caixaAtual));
	}

	static getHistoricoFechamentos() {
		CaixaService.verificarRotinaViradaDia();
		const fechamentos = JSON.parse(localStorage.getItem('caixas_fechados')) || [];
		return [...fechamentos].sort((a, b) => (b.data > a.data ? 1 : -1));
	}
}

// Executa automaticamente a checagem no carregamento de qualquer página
CaixaService.verificarRotinaViradaDia();
