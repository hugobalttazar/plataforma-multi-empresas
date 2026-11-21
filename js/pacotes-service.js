// ==========================================================================
// PacotesService: Gestão de Planos, Assinaturas, Venda e Consumo de Créditos
// ==========================================================================

const PacotesService = {
	PLANOS_KEY: 'pacotes_planos',
	CLIENTES_KEY: 'pacotes_clientes',

	getDataHojeISO: function () {
		if (typeof obterDataHojeISO === 'function') return obterDataHojeISO();
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	},

	getHoraAtualStr: function () {
		if (typeof obterHoraAtual === 'function') return obterHoraAtual();
		return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
	},

	adicionarDiasISO: function (dataISO, dias) {
		const partes = (dataISO || this.getDataHojeISO()).split('-').map(Number);
		const dt = new Date(partes[0], (partes[1] || 1) - 1, partes[2] || 1);
		dt.setDate(dt.getDate() + Math.max(1, parseInt(dias, 10) || 30));
		return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
	},

	getPlanos: function () {
		try {
			const lista = JSON.parse(localStorage.getItem(this.PLANOS_KEY)) || [];
			return Array.isArray(lista) ? lista : [];
		} catch (e) {
			return [];
		}
	},

	salvarPlanos: function (lista) {
		localStorage.setItem(this.PLANOS_KEY, JSON.stringify(lista || []));
	},

	normalizarServicosInclusos: function (lista) {
		const raw = Array.isArray(lista)
			? lista
			: (typeof lista === 'string' && lista.trim() ? lista.split(',') : []);
		const vistos = new Set();
		const resultado = [];
		raw.forEach((item) => {
			const nome = String(item && typeof item === 'object' ? (item.nome || item.value || '') : (item || '')).trim();
			if (!nome) return;
			const chave = nome.toLowerCase();
			if (vistos.has(chave)) return;
			vistos.add(chave);
			resultado.push(nome);
		});
		return resultado;
	},

	salvarPlano: function (dados) {
		const nome = (dados.nome || '').trim();
		const creditos = Math.max(1, parseInt(dados.creditos, 10) || 1);
		const validadeDias = Math.max(1, parseInt(dados.validadeDias, 10) || 30);
		const valor = Math.max(0, parseFloat(dados.valor || 0) || 0);
		const servicosInclusos = this.normalizarServicosInclusos(dados.servicosInclusos);

		if (!nome) {
			return { sucesso: false, erro: 'Informe o nome do pacote ou plano.' };
		}

		const lista = this.getPlanos();
		if (dados.id) {
			const idx = lista.findIndex(p => String(p.id) === String(dados.id));
			if (idx !== -1) {
				lista[idx] = {
					...lista[idx],
					nome,
					descricao: (dados.descricao || '').trim(),
					servicosInclusos,
					creditos,
					validadeDias,
					valor: Number(valor.toFixed(2)),
					ativo: dados.ativo !== false,
					atualizadoEm: new Date().toISOString()
				};
				this.salvarPlanos(lista);
				return { sucesso: true, plano: lista[idx] };
			}
		}

		const novo = {
			id: 'pln_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
			nome,
			descricao: (dados.descricao || '').trim(),
			servicosInclusos,
			creditos,
			validadeDias,
			valor: Number(valor.toFixed(2)),
			ativo: true,
			criadoEm: new Date().toISOString()
		};
		lista.push(novo);
		this.salvarPlanos(lista);
		return { sucesso: true, plano: novo };
	},

	alternarStatusPlano: function (id) {
		const lista = this.getPlanos();
		const item = lista.find(p => String(p.id) === String(id));
		if (!item) return false;
		item.ativo = item.ativo === false;
		item.atualizadoEm = new Date().toISOString();
		this.salvarPlanos(lista);
		return true;
	},

	removerPlano: function (id) {
		const lista = this.getPlanos().filter(p => String(p.id) !== String(id));
		this.salvarPlanos(lista);
	},

	getAssinaturas: function () {
		try {
			const lista = JSON.parse(localStorage.getItem(this.CLIENTES_KEY)) || [];
			return Array.isArray(lista) ? lista : [];
		} catch (e) {
			return [];
		}
	},

	salvarAssinaturas: function (lista) {
		localStorage.setItem(this.CLIENTES_KEY, JSON.stringify(lista || []));
	},

	getStatusAssinatura: function (assinatura) {
		if (!assinatura) return 'inativo';
		const restantes = parseInt(assinatura.creditosRestantes, 10) || 0;
		if (restantes <= 0) return 'esgotado';
		const hoje = this.getDataHojeISO();
		if (assinatura.dataValidade && assinatura.dataValidade < hoje) return 'vencido';
		if (assinatura.status === 'cancelado') return 'cancelado';
		return 'ativo';
	},

	getAssinaturasAtivasCliente: function (clienteIdOuNome) {
		const alvo = (clienteIdOuNome || '').toString().trim().toLowerCase();
		if (!alvo) return [];

		return this.getAssinaturas().filter(a => {
			const matchId = a.clienteId && String(a.clienteId).toLowerCase() === alvo;
			const matchNome = a.clienteNome && a.clienteNome.trim().toLowerCase() === alvo;
			if (!matchId && !matchNome) return false;
			return this.getStatusAssinatura(a) === 'ativo';
		});
	},

	venderPacote: function ({ planoId, clienteId = '', clienteNome = '', clienteTelefone = '', formaPagamento = 'Pix', valorPago = null, observacao = '', placasAutorizadas = [] }) {
		const planos = this.getPlanos();
		const plano = planos.find(p => String(p.id) === String(planoId));
		if (!plano) {
			return { sucesso: false, erro: 'Plano/Pacote não encontrado.' };
		}

		const nomeLimpo = (clienteNome || '').trim();
		if (!nomeLimpo) {
			return { sucesso: false, erro: 'Selecione um cliente para vincular o pacote.' };
		}

		const hoje = this.getDataHojeISO();
		const dataValidade = this.adicionarDiasISO(hoje, plano.validadeDias || 30);
		const valorFinal = valorPago !== null && valorPago !== '' && !isNaN(parseFloat(valorPago))
			? Math.max(0, parseFloat(valorPago))
			: parseFloat(plano.valor || 0);
		const placasSanitizadas = Array.isArray(placasAutorizadas)
			? Array.from(new Set(placasAutorizadas.map(p => String(p || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim()).filter(Boolean)))
			: [];

		const servicosInclusos = this.normalizarServicosInclusos(plano.servicosInclusos);

		const novaAssinatura = {
			id: 'pac_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
			planoId: plano.id,
			planoNome: plano.nome,
			servicosInclusos,
			clienteId: clienteId ? String(clienteId) : '',
			clienteNome: nomeLimpo,
			clienteTelefone: (clienteTelefone || '').trim(),
			creditosTotais: parseInt(plano.creditos, 10) || 1,
			creditosRestantes: parseInt(plano.creditos, 10) || 1,
			valorPago: Number(valorFinal.toFixed(2)),
			formaPagamento: formaPagamento || 'Pix',
			dataCompra: hoje,
			dataValidade: dataValidade,
			placasAutorizadas: placasSanitizadas,
			observacao: (observacao || '').trim(),
			status: 'ativo',
			historicoUso: [],
			criadoEm: new Date().toISOString()
		};

		let entradaCaixa = null;
		if (valorFinal > 0 && typeof CaixaService !== 'undefined' && typeof CaixaService.registrarEntrada === 'function') {
			entradaCaixa = CaixaService.registrarEntrada({
				valor: valorFinal,
				formaPagamento: formaPagamento || 'Pix',
				categoria: 'Venda de Pacote',
				origem: 'pacote',
				referenciaId: novaAssinatura.id,
				cliente: nomeLimpo,
				descricao: `Pacote "${plano.nome}" (${novaAssinatura.creditosTotais} créditos) - ${nomeLimpo}`
			});
			if (entradaCaixa && entradaCaixa.id) {
				novaAssinatura.entradaCaixaId = entradaCaixa.id;
			}
		}

		const assinaturas = this.getAssinaturas();
		assinaturas.unshift(novaAssinatura);
		this.salvarAssinaturas(assinaturas);

		return { sucesso: true, assinatura: novaAssinatura, entradaCaixa };
	},

	consumirCredito: function ({ assinaturaId, pedidoId, cliente = '', placa = '', modelo = '', itemDescricao = '', servicos = '', operador = '' }) {
		if (!assinaturaId) {
			return { sucesso: false, erro: 'Pacote não selecionado.' };
		}

		const lista = this.getAssinaturas();
		const idx = lista.findIndex(a => String(a.id) === String(assinaturaId));
		if (idx === -1) {
			return { sucesso: false, erro: 'Assinatura de pacote não encontrada.' };
		}

		const assinatura = lista[idx];
		if (!Array.isArray(assinatura.historicoUso)) assinatura.historicoUso = [];

		// Idempotência: evita abater 2 créditos para a mesma O.S.
		const jaUsado = pedidoId && assinatura.historicoUso.some(u => String(u.pedidoId) === String(pedidoId));
		if (jaUsado) {
			return {
				sucesso: true,
				jaConsumido: true,
				assinatura,
				creditosRestantes: assinatura.creditosRestantes
			};
		}

		const statusAtual = this.getStatusAssinatura(assinatura);
		if (statusAtual !== 'ativo') {
			return {
				sucesso: false,
				erro: statusAtual === 'vencido'
					? 'Este pacote está com a validade vencida.'
					: 'Este pacote não possui créditos disponíveis.'
			};
		}

		assinatura.creditosRestantes = Math.max(0, (parseInt(assinatura.creditosRestantes, 10) || 0) - 1);
		if (assinatura.creditosRestantes === 0) {
			assinatura.status = 'esgotado';
		}

		assinatura.historicoUso.unshift({
			id: 'uso_' + Date.now(),
			pedidoId: pedidoId ? String(pedidoId) : '',
			data: this.getDataHojeISO(),
			hora: this.getHoraAtualStr(),
			cliente: (cliente || assinatura.clienteNome || '').trim(),
			placa: (placa || '').trim(),
			modelo: (modelo || '').trim(),
			itemDescricao: (itemDescricao || '').trim(),
			servicos: (servicos || '').trim(),
			operador: (operador || '').trim()
		});
		assinatura.atualizadoEm = new Date().toISOString();

		lista[idx] = assinatura;
		this.salvarAssinaturas(lista);

		return {
			sucesso: true,
			jaConsumido: false,
			assinatura,
			creditosRestantes: assinatura.creditosRestantes
		};
	},

	estornarCredito: function ({ assinaturaId, pedidoId }) {
		if (!assinaturaId || !pedidoId) {
			return { sucesso: false, estornado: false };
		}

		const lista = this.getAssinaturas();
		const idx = lista.findIndex(a => String(a.id) === String(assinaturaId));
		if (idx === -1) {
			return { sucesso: false, estornado: false };
		}

		const assinatura = lista[idx];
		if (!Array.isArray(assinatura.historicoUso)) {
			return { sucesso: true, estornado: false, assinatura };
		}

		const usoIdx = assinatura.historicoUso.findIndex(u => String(u.pedidoId) === String(pedidoId));
		if (usoIdx === -1) {
			return { sucesso: true, estornado: false, assinatura };
		}

		assinatura.historicoUso.splice(usoIdx, 1);
		const totais = Math.max(1, parseInt(assinatura.creditosTotais, 10) || 1);
		const atuais = Math.max(0, parseInt(assinatura.creditosRestantes, 10) || 0);
		assinatura.creditosRestantes = Math.min(totais, atuais + 1);
		if (assinatura.status === 'esgotado' && assinatura.creditosRestantes > 0) {
			assinatura.status = 'ativo';
		}
		assinatura.atualizadoEm = new Date().toISOString();

		lista[idx] = assinatura;
		this.salvarAssinaturas(lista);

		return {
			sucesso: true,
			estornado: true,
			assinatura,
			creditosRestantes: assinatura.creditosRestantes
		};
	},

	getServicosInclusosAssinatura: function (assinatura) {
		if (!assinatura) return [];
		if (Array.isArray(assinatura.servicosInclusos)) {
			const diretos = this.normalizarServicosInclusos(assinatura.servicosInclusos);
			if (diretos.length > 0) return diretos;
		}
		if (assinatura.planoId) {
			const plano = this.getPlanos().find(p => String(p.id) === String(assinatura.planoId));
			if (plano && Array.isArray(plano.servicosInclusos)) {
				return this.normalizarServicosInclusos(plano.servicosInclusos);
			}
		}
		return [];
	},

	calcularAbatimentoServicos: function (servicosSelecionados, servicosInclusos) {
		const itens = Array.isArray(servicosSelecionados) ? servicosSelecionados : [];
		const inclusosNorm = this.normalizarServicosInclusos(servicosInclusos);

		let valorServicosTotal = 0;
		itens.forEach((it) => {
			valorServicosTotal += Math.max(0, parseFloat(it && it.preco) || 0);
		});

		// Fallback legado: pacotes antigos sem vínculo explícito zeram todos os serviços
		if (inclusosNorm.length === 0) {
			return {
				valorServicosTotal: Number(valorServicosTotal.toFixed(2)),
				valorServicosCobertos: Number(valorServicosTotal.toFixed(2)),
				valorServicosRestantes: 0,
				servicosCobertos: itens.map(it => String(it && it.nome || '').trim()).filter(Boolean),
				servicosExtras: [],
				modoLegado: true
			};
		}

		const saldoCobertura = new Set(inclusosNorm.map(n => n.toLowerCase()));
		let valorServicosCobertos = 0;
		let valorServicosRestantes = 0;
		const servicosCobertos = [];
		const servicosExtras = [];

		itens.forEach((it) => {
			const nome = String(it && it.nome || '').trim();
			const preco = Math.max(0, parseFloat(it && it.preco) || 0);
			const chave = nome.toLowerCase();

			if (chave && saldoCobertura.has(chave)) {
				saldoCobertura.delete(chave);
				valorServicosCobertos += preco;
				servicosCobertos.push(nome);
			} else {
				valorServicosRestantes += preco;
				if (nome) servicosExtras.push(nome);
			}
		});

		return {
			valorServicosTotal: Number(valorServicosTotal.toFixed(2)),
			valorServicosCobertos: Number(valorServicosCobertos.toFixed(2)),
			valorServicosRestantes: Number(valorServicosRestantes.toFixed(2)),
			servicosCobertos,
			servicosExtras,
			modoLegado: false
		};
	},

	removerAssinatura: function (id) {
		const lista = this.getAssinaturas().filter(a => String(a.id) !== String(id));
		this.salvarAssinaturas(lista);
	}
};

if (typeof window !== 'undefined') {
	window.PacotesService = PacotesService;
}
