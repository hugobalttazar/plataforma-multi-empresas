/**
 * backup-service.js
 * Gerencia o backup e restauração completa dos dados do estabelecimento em formato JSON.
 * Integração direta com persistência local e nuvem Firebase Firestore.
 */

class BackupService {
	static CHAVES_DADOS = [
		'clientes',
		'servicos',
		'pedidos',
		'caixas_fechados',
		'caixa_atual',
		'caixa_saidas',
		'caixa_entradas',
		'config_negocio',
		'agendamentos',
		'estoque_produtos',
		'equipe_membros',
		'comissoes_pagamentos',
		'fidelidade_config',
		'fidelidade_lembretes',
		'vistorias_pedidos',
		'pacotes_planos',
		'pacotes_clientes',
		'contas_financeiras',
		'faturamentos_lotes',
		'usuarios'
	];

	/**
	 * Retorna as estatísticas consolidadas dos dados locais e da nuvem
	 */
	static getEstatisticasAtuais() {
		const parseSafe = (chave, defaultVal = []) => {
			try {
				const item = localStorage.getItem(chave);
				return item ? JSON.parse(item) : defaultVal;
			} catch (e) {
				return defaultVal;
			}
		};

		const clientes = parseSafe('clientes');
		const servicos = parseSafe('servicos');
		const pedidos = parseSafe('pedidos');
		const caixas = parseSafe('caixas_fechados');
		const agendamentos = parseSafe('agendamentos');
		const produtos = parseSafe('estoque_produtos');
		const equipe = parseSafe('equipe_membros');

		let ultimoBackup = null;
		try {
			const info = localStorage.getItem('ultimo_backup_json_info');
			if (info) ultimoBackup = JSON.parse(info);
		} catch (e) {
			ultimoBackup = null;
		}

		return {
			totalClientes: Array.isArray(clientes) ? clientes.length : 0,
			totalServicos: Array.isArray(servicos) ? servicos.length : 0,
			totalPedidos: Array.isArray(pedidos) ? pedidos.length : 0,
			totalCaixas: Array.isArray(caixas) ? caixas.length : 0,
			totalAgendamentos: Array.isArray(agendamentos) ? agendamentos.length : 0,
			totalProdutos: Array.isArray(produtos) ? produtos.length : 0,
			totalEquipe: Array.isArray(equipe) ? equipe.length : 0,
			ultimoBackup
		};
	}

	/**
	 * Gera e faz o download de um arquivo JSON estruturado contendo todos os dados
	 */
	static exportarBackupJSON() {
		const stats = this.getEstatisticasAtuais();
		const dadosExportados = {};

		this.CHAVES_DADOS.forEach(chave => {
			const valorBruto = localStorage.getItem(chave);
			if (valorBruto !== null) {
				try {
					dadosExportados[chave] = JSON.parse(valorBruto);
				} catch (e) {
					dadosExportados[chave] = valorBruto;
				}
			} else {
				dadosExportados[chave] = null;
			}
		});

		const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
		const agora = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const dataHoraFormatada = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}-${pad(agora.getSeconds())}`;
		const dataLegivel = agora.toLocaleString('pt-BR');

		const backupPayload = {
			sistema: 'Sistema de Gestão - Lava Jato & Estética Automotiva',
			versao: '2.0.0',
			formato: 'backup_json',
			geradoEm: agora.toISOString(),
			dataLegivel: dataLegivel,
			empresaId: user?.empresaId || 'padrao',
			usuarioResponsavel: user?.nome || user?.username || 'Sistema',
			estatisticas: {
				totalClientes: stats.totalClientes,
				totalServicos: stats.totalServicos,
				totalPedidos: stats.totalPedidos,
				totalCaixas: stats.totalCaixas,
				totalAgendamentos: stats.totalAgendamentos,
				totalProdutos: stats.totalProdutos,
				totalEquipe: stats.totalEquipe
			},
			dados: dadosExportados
		};

		const jsonString = JSON.stringify(backupPayload, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
		const url = URL.createObjectURL(blob);

		const nomeArquivo = `backup_sistema_gestao_${dataHoraFormatada}.json`;
		const a = document.createElement('a');
		a.href = url;
		a.download = nomeArquivo;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		const infoBackup = {
			data: dataLegivel,
			timestamp: Date.now(),
			nomeArquivo: nomeArquivo,
			tamanhoBytes: blob.size,
			totalRegistros: stats.totalClientes + stats.totalServicos + stats.totalPedidos + stats.totalCaixas
		};

		try {
			localStorage.setItem('ultimo_backup_json_info', JSON.stringify(infoBackup));
		} catch (e) {
			console.warn('Não foi possível salvar info de backup:', e);
		}

		return {
			sucesso: true,
			nomeArquivo,
			tamanhoFormatado: (blob.size / 1024).toFixed(1) + ' KB',
			infoBackup
		};
	}

	/**
	 * Processa e restaura dados a partir de um arquivo ou texto JSON
	 * @param {File|string} origem - Arquivo File ou string de conteúdo JSON
	 * @param {'substituir'|'mesclar'} modo - Modo de aplicação
	 */
	static async restaurarBackupJSON(origem, modo = 'substituir') {
		let jsonTexto = '';
		if (origem instanceof File) {
			jsonTexto = await origem.text();
		} else if (typeof origem === 'string') {
			jsonTexto = origem;
		} else {
			throw new Error('Origem de dados inválida. Selecione um arquivo .json.');
		}

		let backup;
		try {
			backup = JSON.parse(jsonTexto);
		} catch (err) {
			throw new Error('Arquivo corrompido ou formato JSON inválido: ' + (err.message || String(err)));
		}

		if (!backup || typeof backup !== 'object') {
			throw new Error('Estrutura de dados não reconhecida no arquivo JSON.');
		}

		// Suporta payload estruturado do BackupService ou exportação direta de dados
		const dadosParaRestaurar = backup.dados || backup;
		if (typeof dadosParaRestaurar !== 'object') {
			throw new Error('Nenhum dado compatível encontrado dentro do backup.');
		}

		let contadores = {
			chavesProcessadas: 0,
			itensRestaurados: 0
		};

		this.CHAVES_DADOS.forEach(chave => {
			if (dadosParaRestaurar[chave] !== undefined && dadosParaRestaurar[chave] !== null) {
				const conteudo = dadosParaRestaurar[chave];
				let valorFinalString = '';

				if (modo === 'mesclar' && Array.isArray(conteudo)) {
					// Mesclar listas preservando registros locais e novos por ID
					let listaAtual = [];
					try {
						const raw = localStorage.getItem(chave);
						if (raw) listaAtual = JSON.parse(raw);
						if (!Array.isArray(listaAtual)) listaAtual = [];
					} catch (e) {
						listaAtual = [];
					}

					const mapa = new Map();
					listaAtual.forEach(item => {
						const chaveUnica = item.id || item._id || JSON.stringify(item);
						mapa.set(chaveUnica, item);
					});

					conteudo.forEach(item => {
						const chaveUnica = item.id || item._id || JSON.stringify(item);
						mapa.set(chaveUnica, item); // Atualiza ou insere
					});

					const listaCombinada = Array.from(mapa.values());
					valorFinalString = JSON.stringify(listaCombinada);
					contadores.itensRestaurados += listaCombinada.length;
				} else {
					// Substituir base ativa
					valorFinalString = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
					if (Array.isArray(conteudo)) contadores.itensRestaurados += conteudo.length;
				}

				// Grava no localStorage (o que aciona sincronização automática com o Firebase se ativo)
				localStorage.setItem(chave, valorFinalString);
				contadores.chavesProcessadas++;

				// Notifica interface se houver listeners
				window.dispatchEvent(new CustomEvent('cloudDataChanged', { detail: chave }));
			}
		});

		// Força atualização da marca do estabelecimento se houver
		if (window.BrandService && window.BrandService.carregarConfiguracoesSalvas) {
			window.BrandService.carregarConfiguracoesSalvas();
		}

		return {
			sucesso: true,
			chavesProcessadas: contadores.chavesProcessadas,
			itensRestaurados: contadores.itensRestaurados,
			dataHora: new Date().toLocaleString('pt-BR')
		};
	}
}

if (typeof window !== 'undefined') {
	window.BackupService = BackupService;
}

