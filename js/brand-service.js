// ==========================================================================
// BrandService: Gerenciamento e Aplicação de Identidade do Negócio
// ==========================================================================

const BrandService = {
	STORAGE_KEY: 'config_negocio',

	// Segmentos pré-configurados com ícone e rótulos
	TIPOS_NEGOCIO: {
		'lava_jato': {
			nome: 'Lava Jato / Estética Automotiva',
			tituloPadrao: 'LAVA JATO',
			icone: '🚗',
			termoItem: 'Veículo',
			termoRegistro: 'Placa / Modelo'
		},
		'barbearia': {
			nome: 'Barbearia / Salão de Beleza',
			tituloPadrao: 'BARBEARIA',
			icone: '💈',
			termoItem: 'Cadeira / Atendimento',
			termoRegistro: 'Agendamento / Cliente'
		},
		'assistencia': {
			nome: 'Assistência Técnica / Celulares e TI',
			tituloPadrao: 'ASSISTÊNCIA TÉCNICA',
			icone: '📱',
			termoItem: 'Aparelho / Equipamento',
			termoRegistro: 'Marca / Modelo / IMEI'
		},
		'mecanica': {
			nome: 'Oficina Mecânica / Auto Peças',
			tituloPadrao: 'OFICINA MECÂNICA',
			icone: '🔧',
			termoItem: 'Veículo / Motor',
			termoRegistro: 'Placa / Chassi'
		},
		'petshop': {
			nome: 'Pet Shop / Banho e Tosa',
			tituloPadrao: 'PET SHOP',
			icone: '🐾',
			termoItem: 'Pet / Animal',
			termoRegistro: 'Nome do Pet / Raça'
		},
		'geral': {
			nome: 'Outro Segmento / Geral',
			tituloPadrao: 'OUTRO SEGMENTO',
			icone: '🛠️',
			termoItem: 'Atendimento',
			termoRegistro: 'Referência / Item'
		}
	},

	// Retorna a empresa ativa selecionada no sistema (ou tenant atual)
	getEmpresaAtivaInfo: function () {
		try {
			if (typeof window !== 'undefined' && window.EmpresaService && typeof window.EmpresaService.getEmpresaAtiva === 'function') {
				const emp = window.EmpresaService.getEmpresaAtiva();
				if (emp && emp.id) return emp;
			}
			const activeId = localStorage.getItem('master_active_empresaId');
			const raw = localStorage.getItem('empresas_cadastradas');
			if (raw) {
				const list = JSON.parse(raw);
				if (Array.isArray(list)) {
					const found = list.find(e => e.id === activeId);
					if (found) return found;
					if (list.length > 0) return list[0];
				}
			}
		} catch (e) {}
		return null;
	},

	// Retorna a configuração atual com fallback inteligente para a empresa ativa
	getConfig: function () {
		let config = {};
		try {
			const salvo = localStorage.getItem(this.STORAGE_KEY);
			if (salvo) {
				const parsed = JSON.parse(salvo);
				if (parsed && typeof parsed === 'object') {
					config = parsed;
				}
			}
		} catch (e) {
			console.error('Erro ao ler config_negocio:', e);
		}

		const empresa = this.getEmpresaAtivaInfo();
		const nomePadrao = (empresa && empresa.nome) ? empresa.nome : '';
		const tipoPadrao = (empresa && empresa.tipoNegocio) ? empresa.tipoNegocio : 'geral';
		const iconePadrao = (empresa && empresa.icone) ? empresa.icone : '';

		return {
			nomeEstabelecimento: (config.nomeEstabelecimento && config.nomeEstabelecimento.trim()) ? config.nomeEstabelecimento.trim() : nomePadrao,
			razaoSocial: config.razaoSocial || (empresa ? empresa.nome : ''),
			cnpj: config.cnpj || '',
			tipoNegocio: config.tipoNegocio || tipoPadrao,
			tipoNegocioCustom: config.tipoNegocioCustom || '',
			telefone: config.telefone || (empresa ? (empresa.telefone || '') : ''),
			endereco: config.endereco || '',
			responsavel: config.responsavel || (empresa ? (empresa.adminNome || '') : ''),
			iconeCustom: config.iconeCustom || iconePadrao
		};
	},

	// Salva a configuração no localStorage
	salvarConfig: function (dados) {
		const configAtual = this.getConfig();
		const novaConfig = {
			...configAtual,
			...dados,
			atualizadoEm: new Date().toISOString()
		};

		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(novaConfig));
		this.aplicarIdentidadeVisual();
		return novaConfig;
	},

	// Obtém o título do negócio e o ícone correspondente
	getInfoVisual: function (config) {
		const cfg = config || this.getConfig();
		const empresa = this.getEmpresaAtivaInfo();
		const infoTipo = this.TIPOS_NEGOCIO[cfg.tipoNegocio] || this.TIPOS_NEGOCIO['geral'];

		// O Nome da Empresa é o título principal com máximo destaque
		let nomeExibicao = cfg.nomeEstabelecimento;
		if (!nomeExibicao && empresa && empresa.nome) {
			nomeExibicao = empresa.nome;
		}
		if (!nomeExibicao || !nomeExibicao.trim()) {
			nomeExibicao = infoTipo.tituloPadrao;
		}

		// Subtítulo descritivo do segmento de atuação
		let subtitulo = infoTipo.nome;
		if (cfg.tipoNegocioCustom && cfg.tipoNegocioCustom.trim()) {
			subtitulo = cfg.tipoNegocioCustom.trim();
		} else if (empresa && empresa.tipoNegocio && this.TIPOS_NEGOCIO[empresa.tipoNegocio]) {
			subtitulo = this.TIPOS_NEGOCIO[empresa.tipoNegocio].nome;
		}

		let icone = cfg.iconeCustom || (empresa ? empresa.icone : '') || infoTipo.icone;

		return {
			titulo: nomeExibicao.toUpperCase(),
			subtitulo: subtitulo,
			icone: icone,
			infoTipo: infoTipo
		};
	},

	// Aplica dinamicamente no cabeçalho de qualquer página
	aplicarIdentidadeVisual: function () {
		const visual = this.getInfoVisual();

		// Atualiza o logotipo
		const elLogo = document.querySelector('.brand-logo');
		if (elLogo) {
			elLogo.textContent = visual.icone;
		}

		// Atualiza o brand-title e brand-subtitle
		const elBrandTitle = document.querySelector('.brand-title');
		if (elBrandTitle) {
			const spanTitulo = elBrandTitle.querySelector('span:first-child') || elBrandTitle.childNodes[0];
			const elSubtitle = elBrandTitle.querySelector('.brand-subtitle');

			if (spanTitulo && spanTitulo !== elSubtitle) {
				spanTitulo.textContent = visual.titulo;
			} else {
				// Se a estrutura estiver simplificada, recria de forma limpa
				elBrandTitle.innerHTML = `<span>${visual.titulo}</span><span class="brand-subtitle">${visual.subtitulo}</span>`;
				return;
			}

			if (elSubtitle) {
				elSubtitle.textContent = visual.subtitulo;
			}
		}

		// Opcional: atualiza o título da aba do navegador (<title>) se aplicável
		const titleEl = document.querySelector('title');
		if (titleEl && visual.subtitulo) {
			const partes = titleEl.textContent.split('|');
			if (partes.length > 1) {
				titleEl.textContent = `${partes[0].trim()} | ${visual.subtitulo}`;
			}
		}
	}
};

// Executa imediatamente e no DOMContentLoaded para evitar piscadas
if (typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => BrandService.aplicarIdentidadeVisual());
	} else {
		BrandService.aplicarIdentidadeVisual();
	}
}

if (typeof window !== 'undefined') {
	window.BrandService = BrandService;
}
