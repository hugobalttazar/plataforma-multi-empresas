// ==========================================================================
// FidelidadeService: Programa de Selos / Pontos e Automações de Retorno
// ==========================================================================

const FidelidadeService = {
	STORAGE_CONFIG_KEY: 'fidelidade_config',
	LEMBRETES_KEY: 'fidelidade_lembretes',

	getConfig: function () {
		const salvo = localStorage.getItem(this.STORAGE_CONFIG_KEY);
		if (salvo) {
			try { return JSON.parse(salvo); } catch (e) {}
		}
		return {
			ativo: true,
			metaSelos: 10,
			premioDescricao: 'Brinde Especial',
			diasSugeridosRetorno: 25,
			servicoQualificado: ''
		};
	},

	salvarConfig: function (cfg) {
		localStorage.setItem(this.STORAGE_CONFIG_KEY, JSON.stringify(cfg));
	},

	getLembretes: function () {
		try {
			const salvo = localStorage.getItem(this.LEMBRETES_KEY);
			const parsed = salvo ? JSON.parse(salvo) : [];
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			return [];
		}
	},

	salvarLembretes: function (lista) {
		localStorage.setItem(this.LEMBRETES_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
	},

	registrarLembreteEnviado: function ({ clienteId = '', clienteNome = '', placa = '', pedidoId = '', servicoGatilho = '', diasAlvo = 25 }) {
		const lista = this.getLembretes();
		const agora = new Date();
		const novo = {
			id: 'lem_' + Date.now(),
			clienteId: clienteId ? String(clienteId) : '',
			clienteNome: (clienteNome || '').trim(),
			placa: (placa || '').trim(),
			pedidoId: pedidoId ? String(pedidoId) : '',
			servicoGatilho: (servicoGatilho || '').trim(),
			diasAlvo: parseInt(diasAlvo, 10) || 25,
			enviadoEm: agora.toISOString()
		};
		lista.unshift(novo);
		// Mantém histórico limpo dos últimos 500 registros
		this.salvarLembretes(lista.slice(0, 500));
		return novo;
	},

	getUltimoLembretePedido: function (pedidoId, placa = '', clienteNome = '') {
		const lembretes = this.getLembretes();
		if (pedidoId) {
			const porPedido = lembretes.find(l => String(l.pedidoId) === String(pedidoId));
			if (porPedido) return porPedido;
		}
		if (placa && clienteNome) {
			return lembretes.find(
				l => (l.placa || '').toUpperCase() === placa.toUpperCase() &&
					(l.clienteNome || '').toLowerCase() === clienteNome.toLowerCase()
			) || null;
		}
		return null;
	},

	foiLembradoRecentemente: function (pedidoId, diasCarencia = 15) {
		if (!pedidoId) return false;
		const lembretes = this.getLembretes();
		const agora = Date.now();
		const msCarencia = diasCarencia * 24 * 60 * 60 * 1000;
		return lembretes.some((l) => {
			if (String(l.pedidoId) !== String(pedidoId)) return false;
			const ts = new Date(l.enviadoEm).getTime();
			return Number.isFinite(ts) && (agora - ts) < msCarencia;
		});
	},

	/**
	 * Descobre o prazo de retorno mais específico configurado entre os serviços da O.S.
	 */
	resolverRegraRetornoPedido: function (pedido, servicosCadastrados, diasPadraoGlobal) {
		const padrao = parseInt(diasPadraoGlobal, 10) || 25;
		const listaServicos = Array.isArray(servicosCadastrados) ? servicosCadastrados : [];
		const nomesOS = (pedido && pedido.servicos ? String(pedido.servicos) : '')
			.split(',')
			.map(s => s.trim().toLowerCase())
			.filter(Boolean);

		let menorPrazoEspecifico = null;
		let servicoGatilho = '';

		nomesOS.forEach((nomeItem) => {
			const match = listaServicos.find(sc => sc && sc.nome && sc.nome.trim().toLowerCase() === nomeItem);
			if (match && parseInt(match.diasRetorno, 10) > 0) {
				const diasSvc = parseInt(match.diasRetorno, 10);
				if (menorPrazoEspecifico === null || diasSvc < menorPrazoEspecifico) {
					menorPrazoEspecifico = diasSvc;
					servicoGatilho = match.nome;
				}
			}
		});

		if (menorPrazoEspecifico !== null) {
			return {
				diasAlvo: menorPrazoEspecifico,
				servicoGatilho: servicoGatilho,
				origemRegra: 'servico'
			};
		}

		return {
			diasAlvo: padrao,
			servicoGatilho: 'Retorno Padrão',
			origemRegra: 'global'
		};
	},

	/**
	 * Retorna o progresso de fidelidade do cliente baseado nas O.S. encerradas
	 */
	getProgressoCliente: function (clienteNomeOuTel) {
		if (!clienteNomeOuTel) return { totalLavagens: 0, selosAtuais: 0, resgatesDisponiveis: 0 };

		const cfg = this.getConfig();
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const termo = clienteNomeOuTel.trim().toLowerCase();

		const pedidosDoCliente = pedidos.filter(p => {
			const nome = (p.cliente || '').toLowerCase();
			const statusOk = p.status === 'encerrado';
			const clienteOk = (nome === termo || nome.includes(termo));
			let servicoOk = true;
			if (cfg.servicoQualificado && cfg.servicoQualificado.trim() !== '') {
				const servs = (p.servicos || '').toLowerCase();
				const svcQual = cfg.servicoQualificado.toLowerCase().trim();
				servicoOk = servs.includes(svcQual);
			}
			return statusOk && clienteOk && servicoOk;
		});

		const total = pedidosDoCliente.length;
		const meta = cfg.metaSelos || 10;
		const resgates = Math.floor(total / meta);
		const selos = total % meta;

		return {
			totalLavagens: total,
			selosAtuais: selos,
			metaSelos: meta,
			resgatesDisponiveis: resgates,
			premio: cfg.premioDescricao
		};
	},

	/**
	 * Gera lista de clientes/veículos para reativação / pós-venda respeitando
	 * regras por serviço e sinalizando lembretes enviados recentemente.
	 */
	getClientesParaReativar: function (opcoes = {}) {
		const incluirJaLembrados = opcoes.incluirJaLembrados !== undefined ? opcoes.incluirJaLembrados : true;
		const cfg = this.getConfig();
		const diasAlvoGlobal = parseInt(cfg.diasSugeridosRetorno, 10) || 25;
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const servicos = JSON.parse(localStorage.getItem('servicos')) || [];

		const hoje = new Date();
		const resultados = [];

		clientes.forEach(c => {
			const pedidosDoCliente = pedidos.filter(p => {
				if (p.status !== 'encerrado') return false;
				if (p.clienteId && c.id && String(p.clienteId) === String(c.id)) return true;
				const nomeP = (p.cliente || '').trim().toLowerCase();
				const nomeC = (c.nome || '').trim().toLowerCase();
				return nomeP === nomeC || (c.tel1 && (p.cliente || '').includes(c.tel1));
			});

			if (pedidosDoCliente.length === 0) return;

			// Agrupa por placa (quando houver) para atender frotas/múltiplos veículos do mesmo cliente
			const gruposPorVeiculo = new Map();
			pedidosDoCliente.forEach((p) => {
				const chaveVeiculo = (p.placa && p.placa.trim()) ? p.placa.trim().toUpperCase() : '__GERAL__';
				if (!gruposPorVeiculo.has(chaveVeiculo)) {
					gruposPorVeiculo.set(chaveVeiculo, []);
				}
				gruposPorVeiculo.get(chaveVeiculo).push(p);
			});

			gruposPorVeiculo.forEach((listaGrupo) => {
				listaGrupo.sort((a, b) => {
					const dataA = a.dataEncerramento || a.data || '';
					const dataB = b.dataEncerramento || b.data || '';
					return dataB.localeCompare(dataA);
				});

				const ultimoPedido = listaGrupo[0];
				const dataRefStr = ultimoPedido.dataEncerramento || ultimoPedido.data;
				if (!dataRefStr) return;

				const dataUltimo = new Date(`${dataRefStr}T12:00:00`);
				if (Number.isNaN(dataUltimo.getTime())) return;

				const diffTempo = hoje.getTime() - dataUltimo.getTime();
				const diffDias = Math.max(0, Math.floor(diffTempo / (1000 * 60 * 60 * 24)));

				const regra = this.resolverRegraRetornoPedido(ultimoPedido, servicos, diasAlvoGlobal);

				if (diffDias >= regra.diasAlvo) {
					const jaLembrado = this.foiLembradoRecentemente(ultimoPedido.id, 15);
					if (!incluirJaLembrados && jaLembrado) return;

					const ultimoLembrete = this.getUltimoLembretePedido(ultimoPedido.id);
					resultados.push({
						cliente: c,
						ultimoPedido: ultimoPedido,
						diasSemVisita: diffDias,
						diasAlvoEfetivo: regra.diasAlvo,
						servicoGatilho: regra.servicoGatilho,
						origemRegra: regra.origemRegra,
						diasAtraso: diffDias - regra.diasAlvo,
						jaLembrado: jaLembrado,
						ultimoLembrete: ultimoLembrete,
						progressoFidelidade: this.getProgressoCliente(c.nome)
					});
				}
			});
		});

		resultados.sort((a, b) => {
			if (a.jaLembrado !== b.jaLembrado) return a.jaLembrado ? 1 : -1;
			return b.diasAtraso - a.diasAtraso;
		});
		return resultados;
	}
};

if (typeof window !== 'undefined') {
	window.FidelidadeService = FidelidadeService;
}
if (typeof module !== 'undefined' && module.exports) {
	module.exports = FidelidadeService;
}
