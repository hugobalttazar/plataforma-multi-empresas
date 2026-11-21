// ==========================================================================
// EquipeService: Cadastro de Operadores, Lavadores e Comissões
// ==========================================================================

const EquipeService = {
	STORAGE_KEY: 'equipe_membros',
	PAGAMENTOS_KEY: 'comissoes_pagamentos',

	getEquipeDefault: function () {
		return [
			{ id: 'eq_1', nome: 'Danilo (Detailer Principal)', cargo: 'Detailer / Especialista', tipoComissao: 'percentual', valorComissao: 50, ativo: true },
			{ id: 'eq_2', nome: 'Lucas Silva', cargo: 'Lavador / Auxiliar', tipoComissao: 'percentual', valorComissao: 20, ativo: true },
			{ id: 'eq_3', nome: 'Mateus Oliveira', cargo: 'Polidor / Higienizador', tipoComissao: 'percentual', valorComissao: 30, ativo: true }
		];
	},

	getMembros: function () {
		const salvo = localStorage.getItem(this.STORAGE_KEY);
		if (!salvo) {
			const def = this.getEquipeDefault();
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(def));
			return def;
		}
		try {
			return JSON.parse(salvo) || [];
		} catch (e) {
			return [];
		}
	},

	obterMembros: function () {
		return this.getMembros();
	},

	salvarMembros: function (lista) {
		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(lista));
	},

	adicionarMembro: function (membro) {
		const lista = this.getMembros();
		const novo = {
			id: 'eq_' + Date.now(),
			nome: membro.nome,
			cargo: membro.cargo || 'Lavador',
			tipoComissao: membro.tipoComissao || 'percentual', // 'percentual' ou 'fixo'
			valorComissao: parseFloat(membro.valorComissao || 0),
			ativo: true,
			criadoEm: new Date().toISOString()
		};
		lista.push(novo);
		this.salvarMembros(lista);
		return novo;
	},

	atualizarMembro: function (id, novosDados) {
		const lista = this.getMembros();
		const idx = lista.findIndex(m => m.id === id);
		if (idx !== -1) {
			lista[idx] = {
				...lista[idx],
				...novosDados,
				valorComissao: parseFloat(novosDados.valorComissao !== undefined ? novosDados.valorComissao : lista[idx].valorComissao || 0)
			};
			this.salvarMembros(lista);
			return lista[idx];
		}
		return null;
	},

	removerMembro: function (id) {
		let lista = this.getMembros();
		lista = lista.filter(m => m.id !== id);
		this.salvarMembros(lista);
	},

	getPagamentos: function () {
		try {
			const salvo = localStorage.getItem(this.PAGAMENTOS_KEY);
			const parsed = salvo ? JSON.parse(salvo) : [];
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			return [];
		}
	},

	salvarPagamentos: function (lista) {
		localStorage.setItem(this.PAGAMENTOS_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
	},

	getPedidoIdsPagos: function () {
		const pagamentos = this.getPagamentos();
		const pagosSet = new Set();
		pagamentos.forEach((pg) => {
			if (Array.isArray(pg.pedidoIds)) {
				pg.pedidoIds.forEach((pid) => {
					if (pid !== null && pid !== undefined && pid !== '') {
						pagosSet.add(String(pid));
					}
				});
			}
		});
		return pagosSet;
	},

	calcularValorComissaoPedido: function (membro, pedido) {
		const val = parseFloat(pedido.valor || 0);
		if (!membro) return 0;
		if (membro.tipoComissao === 'percentual') {
			return val * (parseFloat(membro.valorComissao || 0) / 100);
		}
		return parseFloat(membro.valorComissao || 0);
	},

	calcularComissoesPorPeriodo: function (dataInicio, dataFim) {
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const membros = this.getMembros();
		const pagosSet = this.getPedidoIdsPagos();

		const pedidosEncerrados = pedidos.filter(p => {
			if (p.status !== 'encerrado') return false;
			const dataRef = p.dataEncerramento || p.data;
			if (dataInicio && dataRef < dataInicio) return false;
			if (dataFim && dataRef > dataFim) return false;
			return true;
		});

		const relatorio = membros.map(m => {
			const servicosDoMembro = pedidosEncerrados.filter(p => p.operadorId === m.id || p.operadorNome === m.nome);
			let totalFaturado = 0;
			let totalComissao = 0;
			let totalComissaoPendente = 0;
			let totalComissaoPago = 0;
			const pedidosPendentes = [];
			const pedidosPagos = [];

			servicosDoMembro.forEach(p => {
				const val = parseFloat(p.valor || 0);
				const com = this.calcularValorComissaoPedido(m, p);
				totalFaturado += val;
				totalComissao += com;

				if (pagosSet.has(String(p.id))) {
					totalComissaoPago += com;
					pedidosPagos.push(p);
				} else {
					totalComissaoPendente += com;
					pedidosPendentes.push(p);
				}
			});

			return {
				membro: m,
				qtdServicos: servicosDoMembro.length,
				qtdPendente: pedidosPendentes.length,
				qtdPago: pedidosPagos.length,
				totalFaturado: Number(totalFaturado.toFixed(2)),
				totalComissao: Number(totalComissao.toFixed(2)),
				totalComissaoPendente: Number(totalComissaoPendente.toFixed(2)),
				totalComissaoPago: Number(totalComissaoPago.toFixed(2)),
				pedidos: servicosDoMembro,
				pedidosPendentes: pedidosPendentes,
				pedidosPagos: pedidosPagos
			};
		});

		return relatorio;
	},

	getResumoComissoesPendentes: function () {
		const relatorio = this.calcularComissoesPorPeriodo('', '');
		let totalPendente = 0;
		let totalServicosPendentes = 0;
		const membrosPendentes = [];

		relatorio.forEach((r) => {
			if (r.qtdPendente > 0 && r.totalComissaoPendente > 0) {
				totalPendente += r.totalComissaoPendente;
				totalServicosPendentes += r.qtdPendente;
				membrosPendentes.push(r);
			}
		});

		return {
			totalPendente: Number(totalPendente.toFixed(2)),
			totalServicosPendentes,
			membrosPendentes
		};
	},

	registrarPagamentoComissao: function ({ membroId, periodoInicio = '', periodoFim = '', pedidoIds = [], observacao = '', lancarNoCaixa = true }) {
		const membros = this.getMembros();
		const membro = membros.find(m => m.id === membroId);
		if (!membro) {
			return { sucesso: false, erro: 'Profissional não encontrado.' };
		}

		const pagosSet = this.getPedidoIdsPagos();
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];

		const idsSolicitados = Array.isArray(pedidoIds) ? pedidoIds.map(String) : [];
		const idsElegiveis = idsSolicitados.filter(id => !pagosSet.has(id));

		if (idsElegiveis.length === 0) {
			return { sucesso: false, erro: 'Nenhuma ordem pendente para pagamento (já liquidadas anteriormente).' };
		}

		let valorCalculado = 0;
		const idsConfirmados = [];

		idsElegiveis.forEach((pid) => {
			const ped = pedidos.find(p => String(p.id) === pid && p.status === 'encerrado');
			if (ped && (ped.operadorId === membro.id || ped.operadorNome === membro.nome)) {
				valorCalculado += this.calcularValorComissaoPedido(membro, ped);
				idsConfirmados.push(String(ped.id));
			}
		});

		if (idsConfirmados.length === 0) {
			return { sucesso: false, erro: 'Nenhuma O.S. encerrada elegível encontrada para este profissional.' };
		}

		const valorFinal = Number(valorCalculado.toFixed(2));
		const user = (typeof window !== 'undefined' && window.AuthService && typeof window.AuthService.getCurrentUser === 'function')
			? window.AuthService.getCurrentUser()
			: null;

		const agora = new Date();
		const dataISO = typeof obterDataHojeISO === 'function'
			? obterDataHojeISO()
			: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

		let saidaCaixa = null;
		if (lancarNoCaixa && valorFinal > 0 && typeof CaixaService !== 'undefined' && typeof CaixaService.registrarSaida === 'function') {
			const descCaixa = `Comissão ${membro.nome} (${idsConfirmados.length} O.S.)${observacao ? ' - ' + observacao : ''}`;
			saidaCaixa = CaixaService.registrarSaida(valorFinal, 'Comissões / Equipe', descCaixa);
		}

		const registro = {
			id: 'com_' + Date.now(),
			membroId: membro.id,
			membroNome: membro.nome,
			membroCargo: membro.cargo || '',
			qtdServicos: idsConfirmados.length,
			pedidoIds: idsConfirmados,
			valorPago: valorFinal,
			periodoInicio: periodoInicio || '',
			periodoFim: periodoFim || '',
			observacao: (observacao || '').trim(),
			dataPagamento: dataISO,
			timestamp: agora.toISOString(),
			registradoPor: user ? (user.nome || user.username) : 'Sistema',
			saidaCaixaId: saidaCaixa ? saidaCaixa.id : null
		};

		const pagamentos = this.getPagamentos();
		pagamentos.unshift(registro);
		this.salvarPagamentos(pagamentos);

		return {
			sucesso: true,
			pagamento: registro,
			saidaCaixa
		};
	}
};

if (typeof window !== 'undefined') {
	window.EquipeService = EquipeService;
}
if (typeof module !== 'undefined' && module.exports) {
	module.exports = EquipeService;
}
