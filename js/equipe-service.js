// ==========================================================================
// EquipeService: Cadastro de Operadores, Lavadores e Comissões
// ==========================================================================

const EquipeService = {
	STORAGE_KEY: 'equipe_membros',

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

	calcularComissoesPorPeriodo: function (dataInicio, dataFim) {
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const membros = this.getMembros();

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

			servicosDoMembro.forEach(p => {
				const val = parseFloat(p.valor || 0);
				totalFaturado += val;
				if (m.tipoComissao === 'percentual') {
					totalComissao += val * (m.valorComissao / 100);
				} else {
					totalComissao += parseFloat(m.valorComissao || 0);
				}
			});

			return {
				membro: m,
				qtdServicos: servicosDoMembro.length,
				totalFaturado: totalFaturado,
				totalComissao: totalComissao,
				pedidos: servicosDoMembro
			};
		});

		return relatorio;
	}
};

if (typeof window !== 'undefined') {
	window.EquipeService = EquipeService;
}
