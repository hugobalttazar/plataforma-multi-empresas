// ==========================================================================
// Lógica da Página de Configurações, Negócio, Status Firebase e Backups JSON
// ==========================================================================

let arquivoJSONSelecionado = null;

document.addEventListener('DOMContentLoaded', () => {
	carregarFormularioNegocio();
	atualizarResumoEstatisticas();
	configurarDropzoneJSON();
	mascararCamposNegocio();
	inicializarStatusFirebaseUI();

	// Suporte a abertura direta de abas via query string (?aba=equipe) ou hash (#equipe)
	const urlParams = new URLSearchParams(window.location.search);
	const abaUrl = urlParams.get('aba');
	const hashUrl = window.location.hash ? window.location.hash.replace('#', '') : null;
	const abaDestino = abaUrl || hashUrl;
	if (abaDestino && ['negocio', 'database', 'usuarios', 'equipe', 'mensagens'].includes(abaDestino)) {
		alternarAbaConfig(abaDestino);
	}
});

// Alternância de Abas (Negócio, Database, Usuários, Equipe, Mensagens)
function alternarAbaConfig(aba) {
	const tabNegocio = document.getElementById('tabNavNegocio');
	const tabDatabase = document.getElementById('tabNavDatabase');
	const tabUsuarios = document.getElementById('tabNavUsuarios');
	const tabEquipe = document.getElementById('tabNavEquipe');
	const tabMensagens = document.getElementById('tabNavMensagens');

	const conteudoNegocio = document.getElementById('abaConteudoNegocio');
	const conteudoDatabase = document.getElementById('abaConteudoDatabase');
	const conteudoUsuarios = document.getElementById('abaConteudoUsuarios');
	const conteudoEquipe = document.getElementById('abaConteudoEquipe');
	const conteudoMensagens = document.getElementById('abaConteudoMensagens');

	// Desativa todas
	[tabNegocio, tabDatabase, tabUsuarios, tabEquipe, tabMensagens].forEach(t => t && t.classList.remove('active'));
	[conteudoNegocio, conteudoDatabase, conteudoUsuarios, conteudoEquipe, conteudoMensagens].forEach(c => c && (c.style.display = 'none'));

	if (aba === 'negocio') {
		if (tabNegocio) tabNegocio.classList.add('active');
		if (conteudoNegocio) conteudoNegocio.style.display = 'block';
		carregarFormularioNegocio();
	} else if (aba === 'database') {
		if (tabDatabase) tabDatabase.classList.add('active');
		if (conteudoDatabase) conteudoDatabase.style.display = 'block';
		atualizarResumoEstatisticas();
		atualizarStatusFirebaseUI();
	} else if (aba === 'usuarios') {
		if (tabUsuarios) tabUsuarios.classList.add('active');
		if (conteudoUsuarios) conteudoUsuarios.style.display = 'block';
		if (typeof window.renderizarUsuarios === 'function') {
			window.renderizarUsuarios();
		}
	} else if (aba === 'equipe') {
		if (tabEquipe) tabEquipe.classList.add('active');
		if (conteudoEquipe) conteudoEquipe.style.display = 'block';
		if (typeof inicializarEquipeConfig === 'function') {
			inicializarEquipeConfig();
		} else if (typeof filtrarComissoes === 'function') {
			filtrarComissoes();
		}
	} else if (aba === 'mensagens') {
		if (tabMensagens) tabMensagens.classList.add('active');
		if (conteudoMensagens) conteudoMensagens.style.display = 'block';
		carregarFormularioMensagens();
	}
}

// --------------------------------------------------------------------------
// LÓGICA DA ABA NEGÓCIO
// --------------------------------------------------------------------------

function mascararCamposNegocio() {
	const inputCnpj = document.getElementById('cfgCnpj');
	if (inputCnpj) {
		inputCnpj.addEventListener('input', (e) => {
			let v = e.target.value.replace(/\D/g, '');
			if (v.length > 14) v = v.substring(0, 14);
			if (v.length > 12) {
				e.target.value = `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}-${v.substring(12)}`;
			} else if (v.length > 8) {
				e.target.value = `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8)}`;
			} else if (v.length > 5) {
				e.target.value = `${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5)}`;
			} else if (v.length > 2) {
				e.target.value = `${v.substring(0, 2)}.${v.substring(2)}`;
			} else {
				e.target.value = v;
			}
		});
	}

	const inputTel = document.getElementById('cfgTelefone');
	if (inputTel) {
		inputTel.addEventListener('input', (e) => {
			let v = e.target.value.replace(/\D/g, '');
			if (v.length > 11) v = v.substring(0, 11);
			if (v.length > 10) {
				e.target.value = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
			} else if (v.length > 6) {
				e.target.value = `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
			} else if (v.length > 2) {
				e.target.value = `(${v.substring(0, 2)}) ${v.substring(2)}`;
			} else if (v.length > 0) {
				e.target.value = `(${v}`;
			} else {
				e.target.value = '';
			}
		});
	}

	const inputNome = document.getElementById('cfgNomeEstabelecimento');
	if (inputNome) {
		inputNome.addEventListener('input', () => atualizarPreviewCabecalho());
	}

	const inputCustom = document.getElementById('cfgTipoCustom');
	if (inputCustom) {
		inputCustom.addEventListener('input', () => atualizarPreviewCabecalho());
	}
}

function carregarFormularioNegocio() {
	if (typeof BrandService === 'undefined') return;

	const config = BrandService.getConfig();

	const elNome = document.getElementById('cfgNomeEstabelecimento');
	const elRazao = document.getElementById('cfgRazaoSocial');
	const elCnpj = document.getElementById('cfgCnpj');
	const elTipo = document.getElementById('cfgTipoNegocio');
	const elTipoCustom = document.getElementById('cfgTipoCustom');
	const elRowCustom = document.getElementById('rowTipoCustom');
	const elTel = document.getElementById('cfgTelefone');
	const elResp = document.getElementById('cfgResponsavel');
	const elEnd = document.getElementById('cfgEndereco');

	const tipoAtual = config.tipoNegocio || 'lava_jato';

	if (elNome) elNome.value = config.nomeEstabelecimento || '';
	if (elRazao) elRazao.value = config.razaoSocial || '';
	if (elCnpj) elCnpj.value = config.cnpj || '';
	if (elTipo) elTipo.value = tipoAtual;
	if (elTipoCustom) elTipoCustom.value = config.tipoNegocioCustom || '';
	if (elTel) elTel.value = config.telefone || '';
	if (elResp) elResp.value = config.responsavel || '';
	if (elEnd) elEnd.value = config.endereco || '';

	if (elRowCustom) {
		elRowCustom.style.display = (tipoAtual === 'geral') ? 'flex' : 'none';
	}

	const elMetaMensal = document.getElementById('cfgMetaMensal');
	if (elMetaMensal) {
		elMetaMensal.value = config.metaMensal > 0 ? config.metaMensal : '';
	}

	// Dias de trabalho na semana (0 a 6)
	const diasAtivos = Array.isArray(config.diasTrabalhoSemana) ? config.diasTrabalhoSemana : [1, 2, 3, 4, 5, 6];
	const checksDias = document.querySelectorAll('input[name="cfgDiasTrabalho"]');
	checksDias.forEach(chk => {
		const val = parseInt(chk.value, 10);
		chk.checked = diasAtivos.includes(val);
	});

	// Controle de Visibilidade: O Bloco de configuração de metas só aparece para quem tem permissão
	const blocoMetas = document.getElementById('blocoConfigMetasExpediente');
	if (blocoMetas) {
		const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
		const podeConfigurarMetas = !user || user.isMaster || user.username === 'admin' || (user.permissoes && (user.permissoes.includes('metas') || user.permissoes.includes('configuracoes')));
		blocoMetas.style.display = podeConfigurarMetas ? 'block' : 'none';
	}

	// Atualizar cartões visuais de segmento
	atualizarCardsSegmentoUI(tipoAtual);
	atualizarPreviewCabecalho();
	atualizarCalculoMetaDiariaUI();
}

function atualizarCalculoMetaDiariaUI() {
	if (typeof BrandService === 'undefined' || typeof BrandService.calcularMetaDiaria !== 'function') return;

	const elMeta = document.getElementById('cfgMetaMensal');
	const metaVal = elMeta ? parseFloat(elMeta.value || 0) : 0;

	const checksDias = document.querySelectorAll('input[name="cfgDiasTrabalho"]:checked');
	const diasSelecionados = Array.from(checksDias).map(c => parseInt(c.value, 10));

	const calculo = BrandService.calcularMetaDiaria({
		metaMensal: metaVal,
		diasTrabalhoSemana: diasSelecionados
	});

	const txtMeta = document.getElementById('txtMetaDiariaCalculada');
	const txtInfo = document.getElementById('txtDiasTrabalhoMesInfo');

	if (txtMeta) {
		txtMeta.textContent = `R$ ${calculo.metaDiaria.toFixed(2)} / dia`;
	}
	if (txtInfo) {
		if (calculo.personalizada) {
			txtInfo.textContent = `Divisão proporcional de R$ ${calculo.metaMensal.toFixed(2)} em ${calculo.diasTrabalhoNoMes} dias de funcionamento este mês`;
		} else {
			txtInfo.textContent = `Meta diária padrão (defina um valor mensal para calcular automaticamente)`;
		}
	}
}

// Vincula listeners para recalcular a meta em tempo real ao digitar ou alterar dias
document.addEventListener('DOMContentLoaded', () => {
	const elMeta = document.getElementById('cfgMetaMensal');
	if (elMeta) {
		elMeta.addEventListener('input', atualizarCalculoMetaDiariaUI);
	}

	const checksDias = document.querySelectorAll('input[name="cfgDiasTrabalho"]');
	checksDias.forEach(chk => {
		chk.addEventListener('change', atualizarCalculoMetaDiariaUI);
	});
});

function selecionarSegmentoCard(segmentoKey) {
	const elTipo = document.getElementById('cfgTipoNegocio');
	if (elTipo) {
		elTipo.value = segmentoKey;
	}
	atualizarCardsSegmentoUI(segmentoKey);
	aoMudarTipoNegocio();

	// Se for segmento geral/personalizado, foca no input
	if (segmentoKey === 'geral') {
		const inputCustom = document.getElementById('cfgTipoCustom');
		if (inputCustom) {
			setTimeout(() => inputCustom.focus(), 100);
		}
	}
}

function atualizarCardsSegmentoUI(segmentoAtivo) {
	const cards = document.querySelectorAll('.segment-option-card');
	cards.forEach(card => {
		const seg = card.getAttribute('data-segment');
		if (seg === segmentoAtivo) {
			card.classList.add('active');
		} else {
			card.classList.remove('active');
		}
	});
}

function aoMudarTipoNegocio() {
	const elTipo = document.getElementById('cfgTipoNegocio');
	const elRowCustom = document.getElementById('rowTipoCustom');
	const valor = elTipo ? elTipo.value : 'lava_jato';
	
	if (elRowCustom) {
		elRowCustom.style.display = (valor === 'geral') ? 'flex' : 'none';
	}
	atualizarCardsSegmentoUI(valor);
	atualizarPreviewCabecalho();
}

function atualizarPreviewCabecalho() {
	if (typeof BrandService === 'undefined') return;

	const elNome = document.getElementById('cfgNomeEstabelecimento');
	const elTipo = document.getElementById('cfgTipoNegocio');
	const elTipoCustom = document.getElementById('cfgTipoCustom');

	const tipoValor = elTipo ? elTipo.value : 'geral';
	const tipoCustomValor = elTipoCustom ? elTipoCustom.value : '';
	const nomeValor = (elNome && elNome.value.trim()) ? elNome.value.trim() : 'SEU NEGÓCIO';

	const dadosTemp = {
		tipoNegocio: tipoValor,
		tipoNegocioCustom: tipoCustomValor,
		nomeEstabelecimento: nomeValor
	};

	const visual = BrandService.getInfoVisual(dadosTemp);

	const previewLogo = document.getElementById('previewLogo');
	const previewTitulo = document.getElementById('previewTitulo');
	const previewSubtitulo = document.getElementById('previewSubtitulo');
	const badgeSegmento = document.getElementById('badgePreviewSegmento');

	if (previewLogo) previewLogo.textContent = visual.icone;
	if (previewTitulo) previewTitulo.textContent = visual.titulo;
	if (previewSubtitulo) previewSubtitulo.textContent = visual.subtitulo;

	if (badgeSegmento) {
		badgeSegmento.textContent = `${visual.icone} ${visual.titulo}`;
	}
}

function salvarConfiguracaoNegocio(e) {
	if (e) e.preventDefault();

	const elNome = document.getElementById('cfgNomeEstabelecimento');
	const elRazao = document.getElementById('cfgRazaoSocial');
	const elCnpj = document.getElementById('cfgCnpj');
	const elTipo = document.getElementById('cfgTipoNegocio');
	const elTipoCustom = document.getElementById('cfgTipoCustom');
	const elTel = document.getElementById('cfgTelefone');
	const elResp = document.getElementById('cfgResponsavel');
	const elEnd = document.getElementById('cfgEndereco');
	const elMeta = document.getElementById('cfgMetaMensal');

	const nomeEstabelecimento = elNome ? elNome.value.trim() : '';
	if (!nomeEstabelecimento) {
		if (window.UI) window.UI.toast('Por favor, preencha o Nome do Estabelecimento.', 'warning');
		else alert('Por favor, preencha o Nome do Estabelecimento.');
		if (elNome) elNome.focus();
		return;
	}

	const checksDias = document.querySelectorAll('input[name="cfgDiasTrabalho"]:checked');
	const diasSelecionados = Array.from(checksDias).map(chk => parseInt(chk.value, 10));

	const novosDados = {
		nomeEstabelecimento: nomeEstabelecimento,
		razaoSocial: elRazao ? elRazao.value.trim() : '',
		cnpj: elCnpj ? elCnpj.value.trim() : '',
		tipoNegocio: elTipo ? elTipo.value : 'lava_jato',
		tipoNegocioCustom: elTipoCustom ? elTipoCustom.value.trim() : '',
		telefone: elTel ? elTel.value.trim() : '',
		responsavel: elResp ? elResp.value.trim() : '',
		endereco: elEnd ? elEnd.value.trim() : '',
		metaMensal: elMeta ? parseFloat(elMeta.value || 0) : 0,
		diasTrabalhoSemana: diasSelecionados.length > 0 ? diasSelecionados : [1, 2, 3, 4, 5, 6]
	};

	if (typeof BrandService !== 'undefined') {
		BrandService.salvarConfig(novosDados);
	}

	const msgSucesso = document.getElementById('msgSucessoNegocio');
	if (msgSucesso) {
		msgSucesso.style.display = 'flex';
		msgSucesso.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		setTimeout(() => {
			msgSucesso.style.display = 'none';
		}, 5000);
	}

	atualizarPreviewCabecalho();
	atualizarCalculoMetaDiariaUI();
}

// ==========================================================================
// ABA BANCO DE DADOS: DIAGNÓSTICO, STATUS FIREBASE E BACKUPS JSON
// ==========================================================================

// Atualizar diagnóstico da base em tela
function atualizarResumoEstatisticas() {
	const stats = (window.BackupService && typeof window.BackupService.getEstatisticasAtuais === 'function')
		? window.BackupService.getEstatisticasAtuais()
		: {
			totalClientes: (JSON.parse(localStorage.getItem('clientes') || '[]')).length,
			totalServicos: (JSON.parse(localStorage.getItem('servicos') || '[]')).length,
			totalPedidos: (JSON.parse(localStorage.getItem('pedidos') || '[]')).length,
			totalCaixas: (JSON.parse(localStorage.getItem('caixas_fechados') || '[]')).length,
			infoBackup: JSON.parse(localStorage.getItem('backup_json_info') || 'null')
		};

	const elClientes = document.getElementById('dbTotalClientes');
	const elServicos = document.getElementById('dbTotalServicos');
	const elPedidos = document.getElementById('dbTotalPedidos');
	const elCaixas = document.getElementById('dbTotalCaixas');
	const elOrigem = document.getElementById('infoUltimaOrigem');
	const elBadgeOrigem = document.getElementById('badgeOrigemBase');

	if (elClientes) elClientes.textContent = stats.totalClientes;
	if (elServicos) elServicos.textContent = stats.totalServicos;
	if (elPedidos) elPedidos.textContent = stats.totalPedidos;
	if (elCaixas) elCaixas.textContent = stats.totalCaixas;

	if (elOrigem) {
		if (stats.infoBackup && stats.infoBackup.nomeArquivo) {
			const dataFormatada = new Date(stats.infoBackup.dataImportacao).toLocaleString('pt-BR');
			elOrigem.innerHTML = `
				📁 <strong>Backup JSON Vinculado:</strong> ${stats.infoBackup.nomeArquivo} &bull; 
				Restaurado em: <strong>${dataFormatada}</strong> &bull; 
				Tamanho: <strong>${Math.round((stats.infoBackup.tamanhoBytes || 0) / 1024)} KB</strong>
			`;
			if (elBadgeOrigem) {
				elBadgeOrigem.textContent = 'Backup Restaurado: ' + stats.infoBackup.nomeArquivo;
				elBadgeOrigem.className = 'badge badge-primary';
			}
		} else {
			elOrigem.innerHTML = `
				💾 <strong>Base Operante:</strong> Armazenamento local persistente seguro sincronizado com a nuvem Firebase.
			`;
			if (elBadgeOrigem) {
				elBadgeOrigem.textContent = 'Base Ativa e Sincronizada';
				elBadgeOrigem.className = 'badge badge-success';
			}
		}
	}

	// Atualizar texto de último backup exportado
	const txtBackup = document.getElementById('txtUltimoBackupJSON');
	if (txtBackup) {
		const ultExp = localStorage.getItem('ultimo_backup_json_exportado');
		if (ultExp) {
			const dataBackup = new Date(ultExp).toLocaleString('pt-BR');
			const nomeArq = localStorage.getItem('ultimo_arquivo_json_exportado') || 'backup.json';
			txtBackup.innerHTML = `Último backup baixado: <strong>${dataBackup}</strong> (${nomeArq})`;
		} else {
			txtBackup.textContent = 'Nenhum backup baixado nesta sessão.';
		}
	}
}

// --------------------------------------------------------------------------
// LÓGICA DO QUADRO DE STATUS DO SERVIDOR FIREBASE
// --------------------------------------------------------------------------

function inicializarStatusFirebaseUI() {
	atualizarStatusFirebaseUI();

	// Ouve eventos disparados pelo FirebaseSync
	window.addEventListener('firebaseStatusChanged', (e) => {
		atualizarStatusFirebaseUI(e.detail);
	});

	// Ouve eventos de rede do navegador
	window.addEventListener('online', () => {
		atualizarStatusFirebaseUI();
	});

	window.addEventListener('offline', () => {
		atualizarStatusFirebaseUI();
	});
}

function atualizarStatusFirebaseUI(statusCustom) {
	const status = statusCustom || (window.FirebaseSync ? window.FirebaseSync.getStatus() : {
		status: navigator.onLine ? 'conectado' : 'inativa',
		statusTexto: navigator.onLine ? 'Conectado' : 'Inativa ou desconectado',
		isOnline: navigator.onLine,
		syncEnabled: true,
		lastSyncTime: null,
		lastPingTime: null,
		lastError: null,
		empresaId: 'padrao',
		empresaNome: 'Estabelecimento Ativo',
		dbId: 'ai-studio-lavajatodanilode-e261df4e-97bf-4fcf-8c9f-056d118147ca'
	});

	const estaConectado = status.status === 'conectado' && navigator.onLine;

	// 1. Atualizar Badge Superior
	const badge = document.getElementById('badgeStatusFirebase');
	if (badge) {
		if (estaConectado) {
			badge.textContent = '🟢 Conectado';
			badge.style.background = '#dcfce7';
			badge.style.color = '#15803d';
			badge.style.border = '1px solid #86efac';
		} else {
			badge.textContent = '🔴 Inativa ou desconectado';
			badge.style.background = '#fee2e2';
			badge.style.color = '#b91c1c';
			badge.style.border = '1px solid #fca5a5';
		}
	}

	// 2. Atualizar Banner Principal
	const banner = document.getElementById('bannerStatusFirebase');
	const icone = document.getElementById('iconeStatusFirebase');
	const tit = document.getElementById('txtStatusFirebaseTitulo');
	const desc = document.getElementById('txtStatusFirebaseDesc');
	const modo = document.getElementById('txtModoOperacao');

	if (tit) {
		tit.textContent = estaConectado 
			? 'Status do Banco de Dados: Conectado' 
			: 'Status do Banco de Dados: Inativa ou desconectado';
	}

	if (banner) {
		if (estaConectado) {
			banner.style.background = '#f0fdf4';
			banner.style.borderColor = '#bbf7d0';
			banner.style.color = '#166534';
			if (icone) icone.textContent = '☁️';
			if (modo) {
				modo.textContent = 'Servidor Online';
				modo.style.color = '#15803d';
				modo.style.background = '#dcfce7';
			}
			if (desc) {
				desc.textContent = 'Seus dados estão sendo sincronizados e salvos com segurança em tempo real no servidor Firebase Firestore. Qualquer cliente cadastrado, serviço alterado ou ordem de serviço aberta fica imediatamente online.';
			}
		} else {
			banner.style.background = '#fef2f2';
			banner.style.borderColor = '#fecaca';
			banner.style.color = '#991b1b';
			if (icone) icone.textContent = '⚠️';
			if (modo) {
				modo.textContent = 'Servidor Desconectado';
				modo.style.color = '#b91c1c';
				modo.style.background = '#fee2e2';
			}
			if (desc) {
				desc.textContent = status.lastError || 'O banco de dados na nuvem está temporariamente inativo ou desconectado. O sistema continua operando e gravando localmente; assim que a conexão retornar, tudo será sincronizado com a nuvem automaticamente.';
			}
		}
	}

	// 3. Atualizar Cards de Informações
	const txtDbId = document.getElementById('txtFirebaseDbId');
	if (txtDbId) {
		txtDbId.textContent = 'Base: ' + (status.dbId || 'Firestore Default');
	}

	const txtEmpresaNome = document.getElementById('txtFirebaseEmpresaNome');
	const txtEmpresaId = document.getElementById('txtFirebaseEmpresaId');
	const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
	if (txtEmpresaNome) {
		txtEmpresaNome.textContent = user?.empresaNome || status.empresaNome || 'Estabelecimento Ativo';
	}
	if (txtEmpresaId) {
		txtEmpresaId.textContent = 'ID: ' + (user?.empresaId || status.empresaId || 'padrao');
	}

	const txtUltimaSync = document.getElementById('txtFirebaseUltimaSync');
	const txtStatusSync = document.getElementById('txtFirebaseStatusSync');
	if (txtUltimaSync) {
		if (status.lastSyncTime) {
			const dataSync = new Date(status.lastSyncTime);
			txtUltimaSync.textContent = dataSync.toLocaleTimeString('pt-BR');
		} else if (estaConectado) {
			txtUltimaSync.textContent = 'Ativo e sincronizado';
		} else {
			txtUltimaSync.textContent = 'Aguardando reconexão';
		}
	}
	if (txtStatusSync) {
		txtStatusSync.textContent = estaConectado ? '● Canal em tempo real aberto' : '○ Canal inativo / em espera';
		txtStatusSync.style.color = estaConectado ? '#16a34a' : '#dc2626';
	}

	const txtSinalRede = document.getElementById('txtFirebaseSinalRede');
	const txtLatencia = document.getElementById('txtFirebaseLatencia');
	if (txtSinalRede) {
		txtSinalRede.textContent = navigator.onLine ? '🌐 Internet Ativa' : '❌ Sem Internet';
		txtSinalRede.style.color = navigator.onLine ? 'var(--text-main)' : '#dc2626';
	}
	if (txtLatencia) {
		if (status.latenciaMs) {
			txtLatencia.textContent = `Latência: ${status.latenciaMs}ms`;
		} else if (status.lastPingTime) {
			txtLatencia.textContent = `Último teste: ${new Date(status.lastPingTime).toLocaleTimeString('pt-BR')}`;
		} else {
			txtLatencia.textContent = estaConectado ? 'Latência: normal' : 'Latência: indisponível';
		}
	}
}

async function testarConexaoFirebaseUI() {
	const btn = document.getElementById('btnTestarConexaoFirebase');
	if (btn) {
		btn.disabled = true;
		btn.textContent = '⏳ Testando conexão...';
	}

	try {
		if (window.FirebaseSync && typeof window.FirebaseSync.testarConexao === 'function') {
			const res = await window.FirebaseSync.testarConexao();
			if (res.sucesso) {
				if (window.UI) window.UI.toast(`Status do Banco de Dados: Conectado (${res.latenciaMs}ms)`, 'success');
				else alert(`Status do Banco de Dados: Conectado (${res.latenciaMs}ms)`);
			} else {
				if (window.UI) window.UI.toast(`Status do Banco de Dados: Inativa ou desconectado. ${res.mensagem}`, 'error');
				else alert(`Status do Banco de Dados: Inativa ou desconectado. ${res.mensagem}`);
			}
		} else {
			const isOnline = navigator.onLine;
			if (isOnline) {
				if (window.UI) window.UI.toast('Status do Banco de Dados: Conectado', 'success');
			} else {
				if (window.UI) window.UI.toast('Status do Banco de Dados: Inativa ou desconectado', 'error');
			}
		}
	} catch (e) {
		console.warn('Erro ao testar conexão:', e);
		if (window.UI) window.UI.toast('Status do Banco de Dados: Inativa ou desconectado', 'error');
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = '🔄 Testar Conexão com Firebase';
		}
		atualizarStatusFirebaseUI();
	}
}

function forcarSincronizacaoFirebaseUI() {
	const btn = document.getElementById('btnSincronizarFirebase');
	if (btn) {
		btn.disabled = true;
		btn.textContent = '⏳ Sincronizando...';
	}

	if (window.FirebaseSync && typeof window.FirebaseSync.start === 'function') {
		window.FirebaseSync.start();
	}

	setTimeout(() => {
		if (btn) {
			btn.disabled = false;
			btn.textContent = '⚡ Forçar Sincronização Agora';
		}
		if (window.UI) window.UI.toast('Solicitação de sincronização enviada para a nuvem!', 'success');
		atualizarStatusFirebaseUI();
	}, 800);
}

// --------------------------------------------------------------------------
// LÓGICA DE BACKUP E RESTAURAÇÃO EM FORMATO JSON
// --------------------------------------------------------------------------

function executarExportacaoJSON() {
	if (!window.BackupService) {
		if (window.UI) window.UI.toast('Módulo de backup não encontrado.', 'error');
		return;
	}

	const btn = document.getElementById('btnExportarBaseJSON');
	if (btn) {
		btn.disabled = true;
		btn.innerHTML = '⏳ Gerando Backup JSON...';
	}

	try {
		const res = window.BackupService.exportarBackupJSON();
		if (window.UI) {
			window.UI.toast(`Backup baixado com sucesso: ${res.nomeArquivo} (${res.tamanhoFormatado})`, 'success');
		} else {
			alert(`Backup baixado com sucesso: ${res.nomeArquivo}`);
		}
		atualizarResumoEstatisticas();
	} catch (err) {
		console.error('Falha ao exportar backup JSON:', err);
		if (window.UI) window.UI.toast('Erro ao exportar backup: ' + err.message, 'error');
		else alert('Erro ao exportar backup: ' + err.message);
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.innerHTML = '<span>📥 Baixar Dados em Formato JSON (.json)</span>';
		}
	}
}

function configurarDropzoneJSON() {
	const dropzone = document.getElementById('dropzoneJSON');
	if (!dropzone) return;

	['dragenter', 'dragover'].forEach(eventName => {
		dropzone.addEventListener(eventName, (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.add('dragover');
		}, false);
	});

	['dragleave', 'drop'].forEach(eventName => {
		dropzone.addEventListener(eventName, (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropzone.classList.remove('dragover');
		}, false);
	});

	dropzone.addEventListener('drop', (e) => {
		const dt = e.dataTransfer;
		const files = dt.files;
		if (files && files.length > 0) {
			processarArquivoJSON(files[0]);
		}
	});
}

function tratarArquivoJSONSelecionado(event) {
	const file = event.target.files[0];
	if (file) {
		processarArquivoJSON(file);
	}
}

function processarArquivoJSON(file) {
	if (!file.name.toLowerCase().endsWith('.json')) {
		if (window.UI) window.UI.toast('Por favor, selecione um arquivo no formato JSON (.json).', 'warning');
		else alert('Por favor, selecione um arquivo no formato JSON (.json).');
		return;
	}

	arquivoJSONSelecionado = file;
	const title = document.getElementById('dropzoneJSONTitle');
	const desc = document.getElementById('dropzoneJSONDesc');
	const btnConfirmar = document.getElementById('btnConfirmarImportacaoJSON');

	if (title) {
		title.textContent = `📄 ${file.name}`;
		title.style.color = 'var(--primary)';
	}
	if (desc) {
		desc.textContent = `Arquivo selecionado (${(file.size / 1024).toFixed(1)} KB). Pronto para restaurar. Clique para escolher outro.`;
	}

	if (btnConfirmar) {
		btnConfirmar.disabled = false;
		btnConfirmar.focus();
	}
}

async function executarImportacaoJSON() {
	if (!arquivoJSONSelecionado) {
		if (window.UI) window.UI.toast('Selecione primeiro um arquivo .json para restaurar.', 'warning');
		else alert('Selecione primeiro um arquivo .json para restaurar.');
		return;
	}

	if (!window.BackupService) {
		if (window.UI) window.UI.toast('Módulo de backup não disponível.', 'error');
		return;
	}

	const modoRadios = document.getElementsByName('modoImportacaoJSON');
	let modoEscolhido = 'substituir';
	for (const r of modoRadios) {
		if (r.checked) {
			modoEscolhido = r.value;
			break;
		}
	}

	const btnConfirmar = document.getElementById('btnConfirmarImportacaoJSON');
	const resultadoDiv = document.getElementById('resultadoImportacaoJSON');

	if (btnConfirmar) {
		btnConfirmar.disabled = true;
		btnConfirmar.textContent = '⏳ Lendo e restaurando backup JSON...';
	}

	try {
		const res = await window.BackupService.restaurarBackupJSON(arquivoJSONSelecionado, modoEscolhido);

		if (resultadoDiv) {
			resultadoDiv.style.display = 'block';
			resultadoDiv.className = 'db-status-banner';
			resultadoDiv.style.background = '#eff6ff';
			resultadoDiv.style.borderColor = '#bfdbfe';
			resultadoDiv.style.color = '#1e40af';
			resultadoDiv.innerHTML = `
				<span class="db-status-icon">✅</span>
				<div class="db-status-text">
					<strong>Backup Restaurado com Sucesso!</strong>
					<p style="color: #1d4ed8; margin-top: 4px;">
						Foram restaurados: <strong>${res.clientes}</strong> clientes, 
						<strong>${res.servicos}</strong> serviços, 
						<strong>${res.pedidos}</strong> ordens de serviço e 
						<strong>${res.caixas}</strong> movimentações de caixa.
					</p>
				</div>
			`;
		}

		if (window.UI) {
			window.UI.toast('Backup JSON restaurado com sucesso!', 'success');
		}

		atualizarResumoEstatisticas();
		if (typeof window.BrandService !== 'undefined') {
			window.BrandService.aplicarEmTudo();
		}

		if (btnConfirmar) {
			btnConfirmar.textContent = '✅ Backup Aplicado!';
			setTimeout(() => {
				btnConfirmar.disabled = false;
				btnConfirmar.textContent = '🚀 Restaurar Backup Selecionado';
			}, 3000);
		}
	} catch (err) {
		console.error('Erro na restauração do JSON:', err);
		if (resultadoDiv) {
			resultadoDiv.style.display = 'block';
			resultadoDiv.className = 'db-status-banner';
			resultadoDiv.style.background = '#fef2f2';
			resultadoDiv.style.borderColor = '#fecaca';
			resultadoDiv.style.color = '#991b1b';
			resultadoDiv.innerHTML = `
				<span class="db-status-icon">⚠️</span>
				<div class="db-status-text">
					<strong>Erro ao restaurar backup</strong>
					<p style="color: #b91c1c; margin-top: 4px;">${err.message || 'Verifique se o arquivo é um JSON de backup válido gerado pelo sistema.'}</p>
				</div>
			`;
		}
		if (btnConfirmar) {
			btnConfirmar.disabled = false;
			btnConfirmar.textContent = 'Tentar Novamente';
		}
	}
}

// ==========================================================================
// ABA GESTÃO DE EMPRESAS (EXCLUSIVO MASTER)
// ==========================================================================

function renderizarAbaEmpresasMaster() {
	if (!window.EmpresaService) return;

	const empresas = window.EmpresaService.getEmpresas();
	const ativa = window.EmpresaService.getEmpresaAtiva();

	// Atualiza os cards de métricas
	const statTotal = document.getElementById('statTotalEmpresas');
	if (statTotal) statTotal.textContent = empresas.length;

	const statAtiva = document.getElementById('statEmpresaAtivaNome');
	if (statAtiva) statAtiva.textContent = `${ativa.icone || '🏢'} ${ativa.nome}`;

	// Renderiza a lista de empresas
	const grid = document.getElementById('gridEmpresasCadastradas');
	if (!grid) return;

	grid.innerHTML = '';

	if (empresas.length === 0) {
		grid.innerHTML = `
			<div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; background: var(--bg-surface); border: 2px dashed var(--border-color); border-radius: 8px;">
				<div style="font-size: 2.5rem; margin-bottom: 10px;">🏢</div>
				<h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Nenhuma empresa cadastrada no momento</h3>
				<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">Todas as empresas foram excluídas ou ainda não foram criadas.</p>
				<button type="button" class="btn btn-primary" onclick="abrirModalNovaEmpresa()">➕ Cadastrar Primeira Empresa</button>
			</div>
		`;
		return;
	}

	empresas.forEach(emp => {
		const isAtiva = emp.id === ativa.id;
		const card = document.createElement('div');
		card.className = `tenant-card ${isAtiva ? 'active-tenant' : ''}`;

		const badgeNicho = `<span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.75rem; text-transform: uppercase;">${emp.tipoNegocio}</span>`;
		
		const statusBtn = isAtiva
			? `<span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 5px 10px;">⭐ Empresa Ativa</span>`
			: `<button type="button" class="btn btn-sm btn-primary" onclick="alternarEmpresaDireto('${emp.id}')">⚡ Alternar Painel</button>`;

		const deleteBtn = `<button type="button" class="btn btn-sm" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Excluir Empresa e Apagar Todo o Banco de Dados Dela" onclick="excluirEmpresaMaster('${emp.id}')">🗑️ Excluir</button>`;

		card.innerHTML = `
			<div class="tenant-card-header">
				<div class="tenant-card-avatar">${emp.icone || '🏢'}</div>
				<div class="tenant-card-meta">
					<div class="tenant-card-title">${emp.nome}</div>
					<div class="tenant-card-sub">${badgeNicho} <span style="color: #94a3b8; font-size: 0.72rem;">(${emp.id})</span></div>
				</div>
			</div>

			<div style="font-size: 0.8rem; color: var(--text-muted); background: var(--bg-surface); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 4px;">
				<div><strong>Responsável:</strong> ${emp.adminNome || 'Administrador'}</div>
				<div><strong>Usuário de Login:</strong> <code style="background: #e2e8f0; padding: 1px 4px; border-radius: 3px;">${emp.adminUsername}</code></div>
				${emp.telefone ? `<div><strong>Contato:</strong> ${emp.telefone}</div>` : ''}
			</div>

			<div class="tenant-card-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
				<div style="display: flex; gap: 6px; align-items: center;">
					${statusBtn}
				</div>
				<div style="display: flex; gap: 6px; align-items: center;">
					${deleteBtn}
				</div>
			</div>
		`;

		grid.appendChild(card);
	});
}

function abrirModalNovaEmpresa() {
	const modal = document.getElementById('modalNovaEmpresa');
	if (modal) {
		modal.style.display = 'flex';
		const form = document.getElementById('formNovaEmpresa');
		if (form) form.reset();
		selecionarSegmentoNovo('lava_jato');
		const input = document.getElementById('novoNomeEmpresa');
		if (input) input.focus();
	}
}

function fecharModalNovaEmpresa() {
	const modal = document.getElementById('modalNovaEmpresa');
	if (modal) modal.style.display = 'none';
}

function selecionarSegmentoNovo(tipo) {
	const input = document.getElementById('novoTipoNegocio');
	if (input) input.value = tipo;

	const cards = document.querySelectorAll('[data-segment-novo]');
	cards.forEach(c => {
		if (c.getAttribute('data-segment-novo') === tipo) {
			c.classList.add('active');
		} else {
			c.classList.remove('active');
		}
	});
}

async function salvarNovaEmpresaMaster(e) {
	e.preventDefault();
	if (!window.EmpresaService) return;

	const btn = document.getElementById('btnSalvarEmpresaSubmit');
	const nome = document.getElementById('novoNomeEmpresa').value.trim();
	const tipoNegocio = document.getElementById('novoTipoNegocio').value;
	const adminNome = document.getElementById('novoAdminNome').value.trim();
	const adminUsername = document.getElementById('novoAdminUsername').value.trim();
	const adminPassword = document.getElementById('novoAdminPassword').value;
	const telefone = document.getElementById('novoAdminTelefone').value.trim();

	if (window.AuthService) {
		const check = window.AuthService.validarForcaSenha(adminPassword);
		if (!check.valido) {
			if (window.UI) {
				window.UI.alert('A senha do Administrador não atende aos requisitos de segurança:<br><br>• ' + check.erros.join('<br>• '), 'Senha Insegura');
			} else {
				alert('A senha não atende aos requisitos de segurança:\n- ' + check.erros.join('\n- '));
			}
			document.getElementById('novoAdminPassword').focus();
			return;
		}
	}

	try {
		if (btn) {
			btn.disabled = true;
			btn.textContent = '⏳ Criando base na nuvem...';
		}

		const nova = await window.EmpresaService.criarEmpresa({
			nome,
			tipoNegocio,
			adminNome,
			adminUsername,
			adminPassword,
			telefone
		});

		fecharModalNovaEmpresa();
		renderizarAbaEmpresasMaster();
		if (window.EmpresaService.renderMasterTenantBar) {
			window.EmpresaService.renderMasterTenantBar();
		}

		if (window.UI) {
			const querAlternar = await window.UI.confirm({
				title: 'Empresa Cadastrada',
				message: `O estabelecimento <strong>"${nova.nome}"</strong> foi cadastrado com sucesso!<br><br>Deseja alternar agora mesmo o painel para gerenciar esta nova empresa?`,
				confirmText: 'Sim, Alternar Agora',
				cancelText: 'Permanecer Aqui',
				icon: '🏢'
			});
			if (querAlternar) {
				window.EmpresaService.trocarEmpresaMaster(nova.id);
			}
		} else {
			const querAlternar = confirm(`Estabelecimento "${nova.nome}" cadastrado com sucesso na nuvem!\n\nDeseja alternar agora mesmo o painel para testar esta nova empresa?`);
			if (querAlternar) {
				window.EmpresaService.trocarEmpresaMaster(nova.id);
			}
		}
	} catch (err) {
		if (window.UI) window.UI.alert('Erro ao criar empresa: ' + (err.message || err), 'Erro');
		else alert('Erro ao criar empresa: ' + (err.message || err));
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = 'Criar Empresa e Habilitar Acesso';
		}
	}
}

function alternarEmpresaDireto(id) {
	if (window.EmpresaService) {
		window.EmpresaService.trocarEmpresaMaster(id);
	}
}

function excluirEmpresaMaster(id) {
	if (!window.EmpresaService) return;
	const empresas = window.EmpresaService.getEmpresas();
	const emp = empresas.find(e => e.id === id) || { id: id, nome: id };

	const modal = document.getElementById('modalExcluirEmpresa');
	const nomeEl = document.getElementById('modalExcluirEmpresaNome');
	const instrucaoEl = document.getElementById('modalExcluirEmpresaNomeInstrucao');
	const inputId = document.getElementById('modalExcluirEmpresaId');
	const inputConfirmacao = document.getElementById('modalExcluirConfirmacaoInput');
	const erroEl = document.getElementById('modalExcluirMensagemErro');
	const btn = document.getElementById('btnConfirmarExclusaoEmpresa');

	if (!modal) return;

	if (nomeEl) nomeEl.textContent = emp.nome;
	if (instrucaoEl) instrucaoEl.textContent = `"${emp.nome}"`;
	if (inputId) inputId.value = emp.id;
	if (inputConfirmacao) inputConfirmacao.value = '';
	if (erroEl) erroEl.style.display = 'none';

	if (btn) {
		btn.disabled = true;
		btn.style.opacity = '0.45';
		btn.style.cursor = 'not-allowed';
		btn.textContent = '🗑️ Excluir Definitivamente do Banco';
	}

	modal.style.display = 'flex';
	if (inputConfirmacao) {
		setTimeout(() => inputConfirmacao.focus(), 100);
	}
}

function fecharModalExcluirEmpresa() {
	const modal = document.getElementById('modalExcluirEmpresa');
	if (modal) modal.style.display = 'none';
}

function validarConfirmacaoExclusao() {
	const inputId = document.getElementById('modalExcluirEmpresaId');
	const inputConfirmacao = document.getElementById('modalExcluirConfirmacaoInput');
	const erroEl = document.getElementById('modalExcluirMensagemErro');
	const btn = document.getElementById('btnConfirmarExclusaoEmpresa');

	if (!inputId || !inputConfirmacao || !btn) return;

	const id = inputId.value;
	const empresas = window.EmpresaService ? window.EmpresaService.getEmpresas() : [];
	const emp = empresas.find(e => e.id === id) || { id: id, nome: id };

	const digitado = inputConfirmacao.value.trim().toLowerCase();
	const esperado = emp.nome.trim().toLowerCase();

	if (digitado === esperado) {
		btn.disabled = false;
		btn.style.opacity = '1';
		btn.style.cursor = 'pointer';
		if (erroEl) erroEl.style.display = 'none';
	} else {
		btn.disabled = true;
		btn.style.opacity = '0.45';
		btn.style.cursor = 'not-allowed';
		if (digitado.length >= 3 && !esperado.startsWith(digitado)) {
			if (erroEl) erroEl.style.display = 'block';
		} else {
			if (erroEl) erroEl.style.display = 'none';
		}
	}
}

async function executarExclusaoEmpresaConfirmada() {
	const inputId = document.getElementById('modalExcluirEmpresaId');
	const btn = document.getElementById('btnConfirmarExclusaoEmpresa');
	if (!inputId || !btn) return;

	const id = inputId.value;
	if (!id || !window.EmpresaService) return;

	try {
		btn.disabled = true;
		btn.style.opacity = '0.7';
		btn.style.cursor = 'wait';
		btn.textContent = '⏳ Excluindo e apagando banco...';

		await window.EmpresaService.excluirEmpresa(id);
		fecharModalExcluirEmpresa();

		renderizarAbaEmpresasMaster();
		if (window.EmpresaService.renderMasterTenantBar) {
			window.EmpresaService.renderMasterTenantBar();
		}
		window.location.reload();
	} catch (err) {
		if (window.UI) window.UI.alert('Erro ao excluir empresa: ' + (err.message || err), 'Erro');
		else alert('Erro ao excluir empresa: ' + (err.message || err));
		btn.disabled = false;
		btn.style.opacity = '1';
		btn.style.cursor = 'pointer';
		btn.textContent = '🗑️ Excluir Definitivamente do Banco';
	}
}

async function baixarBackupEmpresaMaster(id) {
	if (!window.EmpresaService) return;
	try {
		await window.EmpresaService.exportarDadosEmpresa(id);
		if (window.UI) window.UI.toast('Backup da empresa gerado com sucesso!', 'success');
	} catch (err) {
		if (window.UI) window.UI.alert('Erro ao baixar dados da empresa: ' + (err.message || err), 'Erro no Backup');
		else alert('Erro ao baixar dados da empresa: ' + (err.message || err));
	}
}

async function baixarBackupCompletoMaster() {
	if (!window.EmpresaService) return;
	try {
		await window.EmpresaService.exportarBancoCompleto();
		if (window.UI) window.UI.toast('Backup completo do banco baixado com sucesso!', 'success');
	} catch (err) {
		if (window.UI) window.UI.alert('Erro ao baixar banco de dados completo: ' + (err.message || err), 'Erro no Backup');
		else alert('Erro ao baixar banco de dados completo: ' + (err.message || err));
	}
}

window.renderizarAbaEmpresasMaster = renderizarAbaEmpresasMaster;
window.abrirModalNovaEmpresa = abrirModalNovaEmpresa;
window.fecharModalNovaEmpresa = fecharModalNovaEmpresa;
window.fecharModalExcluirEmpresa = fecharModalExcluirEmpresa;
window.validarConfirmacaoExclusao = validarConfirmacaoExclusao;
window.executarExclusaoEmpresaConfirmada = executarExclusaoEmpresaConfirmada;
window.selecionarSegmentoNovo = selecionarSegmentoNovo;
window.salvarNovaEmpresaMaster = salvarNovaEmpresaMaster;
window.alternarEmpresaDireto = alternarEmpresaDireto;
window.excluirEmpresaMaster = excluirEmpresaMaster;
window.baixarBackupEmpresaMaster = baixarBackupEmpresaMaster;
window.baixarBackupCompletoMaster = baixarBackupCompletoMaster;

// ==========================================================================
// LÓGICA DA ABA EQUIPE & COMISSÕES
// ==========================================================================
let membroEmEdicaoId = null;
let equipeConfigInicializada = false;

function inicializarEquipeConfig() {
	configurarEventosEquipeConfig();
	renderizarTabelaMembrosConfig();
	filtrarComissoes();
}

function configurarEventosEquipeConfig() {
	if (equipeConfigInicializada) return;
	equipeConfigInicializada = true;

	const formMembro = document.getElementById('formNovoMembro');
	const selectTipo = document.getElementById('membroTipoComissao');
	const btnCancelar = document.getElementById('btnCancelarEdicaoMembro');
	const inputInicio = document.getElementById('filtroComissaoInicio');
	const inputFim = document.getElementById('filtroComissaoFim');

	// Define padrão do mês corrente nos filtros caso estejam vazios
	if (inputInicio && !inputInicio.value) {
		const hoje = new Date();
		const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
		inputInicio.value = primeiroDia.toISOString().split('T')[0];
	}
	if (inputFim && !inputFim.value) {
		inputFim.value = new Date().toISOString().split('T')[0];
	}

	if (selectTipo) {
		selectTipo.addEventListener('change', (e) => {
			atualizarLabelsTipoComissaoConfig(e.target.value);
		});
	}

	if (btnCancelar) {
		btnCancelar.addEventListener('click', () => {
			cancelarEdicaoMembroConfig();
		});
	}

	if (formMembro) {
		formMembro.addEventListener('submit', (e) => {
			e.preventDefault();
			salvarMembroEquipeConfig();
		});
	}
}

function atualizarLabelsTipoComissaoConfig(tipo) {
	const labelValor = document.getElementById('labelValorComissao');
	const inputValor = document.getElementById('membroValorComissao');
	if (!labelValor || !inputValor) return;

	if (tipo === 'percentual') {
		labelValor.textContent = 'Comissão por Serviço (%) *';
		inputValor.placeholder = 'Ex: 30';
		inputValor.step = '0.5';
	} else {
		labelValor.textContent = 'Comissão Fixa por Serviço (R$) *';
		inputValor.placeholder = 'Ex: 15.00';
		inputValor.step = '0.50';
	}
}

function salvarMembroEquipeConfig() {
	const nomeInput = document.getElementById('membroNome');
	const cargoInput = document.getElementById('membroCargo');
	const tipoSelect = document.getElementById('membroTipoComissao');
	const valorInput = document.getElementById('membroValorComissao');

	if (!nomeInput) return;
	const nome = nomeInput.value.trim();
	if (!nome) {
		if (window.UI) window.UI.toast('Informe o nome do profissional.', 'warning');
		return;
	}

	const cargo = cargoInput ? cargoInput.value.trim() : '';
	const tipoComissao = tipoSelect ? tipoSelect.value : 'percentual';
	const valorComissao = valorInput ? parseFloat(valorInput.value || 0) : 0;

	if (membroEmEdicaoId) {
		if (window.EquipeService) {
			window.EquipeService.atualizarMembro(membroEmEdicaoId, {
				nome,
				cargo,
				tipoComissao,
				valorComissao
			});
		}
		if (window.UI) window.UI.toast('Profissional atualizado com sucesso!', 'success');
	} else {
		if (window.EquipeService) {
			window.EquipeService.adicionarMembro({
				nome,
				cargo,
				tipoComissao,
				valorComissao
			});
		}
		if (window.UI) window.UI.toast('Profissional cadastrado na equipe!', 'success');
	}

	cancelarEdicaoMembroConfig();
	renderizarTabelaMembrosConfig();
	filtrarComissoes();
}

function editarMembroEquipeConfig(id) {
	if (!window.EquipeService) return;
	const membros = window.EquipeService.obterMembros();
	const membro = membros.find(m => m.id === id);
	if (!membro) return;

	membroEmEdicaoId = id;

	const nomeInput = document.getElementById('membroNome');
	const cargoInput = document.getElementById('membroCargo');
	const tipoSelect = document.getElementById('membroTipoComissao');
	const valorInput = document.getElementById('membroValorComissao');
	const tituloForm = document.getElementById('formMembroTitulo');
	const btnSalvar = document.getElementById('btnSalvarMembro');
	const btnCancelar = document.getElementById('btnCancelarEdicaoMembro');

	if (nomeInput) nomeInput.value = membro.nome || '';
	if (cargoInput) cargoInput.value = membro.cargo || '';
	if (tipoSelect) {
		tipoSelect.value = membro.tipoComissao || 'percentual';
		atualizarLabelsTipoComissaoConfig(tipoSelect.value);
	}
	if (valorInput) valorInput.value = membro.valorComissao || 0;

	if (tituloForm) tituloForm.textContent = `✏️ Editando: ${membro.nome}`;
	if (btnSalvar) btnSalvar.textContent = '💾 Salvar Alterações';
	if (btnCancelar) btnCancelar.style.display = 'inline-block';

	const form = document.getElementById('formNovoMembro');
	if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelarEdicaoMembroConfig() {
	membroEmEdicaoId = null;
	const form = document.getElementById('formNovoMembro');
	if (form) form.reset();

	const tituloForm = document.getElementById('formMembroTitulo');
	const btnSalvar = document.getElementById('btnSalvarMembro');
	const btnCancelar = document.getElementById('btnCancelarEdicaoMembro');

	if (tituloForm) tituloForm.textContent = '➕ Cadastrar Profissional';
	if (btnSalvar) btnSalvar.textContent = '💾 Salvar Profissional';
	if (btnCancelar) btnCancelar.style.display = 'none';

	atualizarLabelsTipoComissaoConfig('percentual');
}

async function removerMembroEquipeConfig(id) {
	if (!window.EquipeService) return;
	const membros = window.EquipeService.obterMembros();
	const membro = membros.find(m => m.id === id);
	const nome = membro ? membro.nome : 'o profissional';

	if (window.UI) {
		const confirmado = await window.UI.confirm({
			title: 'Excluir Integrante',
			message: `Deseja realmente remover <strong>"${nome}"</strong> da equipe?`,
			confirmText: 'Sim, Excluir',
			danger: true,
			icon: '🗑️'
		});
		if (!confirmado) return;
	}

	window.EquipeService.removerMembro(id);
	if (window.UI) window.UI.toast('Profissional removido da equipe.', 'info');

	if (membroEmEdicaoId === id) {
		cancelarEdicaoMembroConfig();
	}
	renderizarTabelaMembrosConfig();
	filtrarComissoes();
}

function renderizarTabelaMembrosConfig() {
	const corpo = document.getElementById('corpoTabelaMembros');
	if (!corpo) return;

	if (!window.EquipeService) {
		corpo.innerHTML = '<tr><td colspan="5" class="empty-table-message">Serviço de equipe indisponível.</td></tr>';
		return;
	}

	const membros = window.EquipeService.obterMembros();
	const statTotalEquipe = document.getElementById('statTotalEquipe');
	if (statTotalEquipe) {
		statTotalEquipe.textContent = membros.filter(m => m.ativo !== false).length;
	}

	corpo.innerHTML = '';
	if (membros.length === 0) {
		corpo.innerHTML = '<tr><td colspan="5" class="empty-table-message">Nenhum profissional cadastrado na equipe.</td></tr>';
		return;
	}

	membros.forEach(m => {
		const regraFmt = m.tipoComissao === 'percentual' 
			? `${m.valorComissao || 0}% sobre o serviço` 
			: `R$ ${parseFloat(m.valorComissao || 0).toFixed(2)} fixo por carro`;

		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>
				<strong>${m.nome}</strong>
			</td>
			<td>
				<span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.8rem;">
					${m.cargo || 'Lavador / Operador'}
				</span>
			</td>
			<td>
				<span style="font-weight: 600; color: #1e40af; font-size: 0.85rem;">${regraFmt}</span>
			</td>
			<td>
				<span class="badge" style="background: #dcfce7; color: #15803d; font-size: 0.8rem;">Ativo</span>
			</td>
			<td style="text-align: center; white-space: nowrap;">
				<div style="display: inline-flex; gap: 6px;">
					<button type="button" class="btn btn-secondary btn-sm" title="Editar" onclick="editarMembroEquipeConfig('${m.id}')" style="padding: 4px 8px; font-size: 0.8rem;">
						✏️ Editar
					</button>
					<button type="button" class="btn btn-sm" title="Excluir" onclick="removerMembroEquipeConfig('${m.id}')" style="background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; padding: 4px 8px; font-size: 0.8rem;">
						🗑️
					</button>
				</div>
			</td>
		`;
		corpo.appendChild(tr);
	});
}

function filtrarComissoes() {
	const inicioInput = document.getElementById('filtroComissaoInicio');
	const fimInput = document.getElementById('filtroComissaoFim');
	const corpo = document.getElementById('corpoTabelaComissoes');
	if (!corpo) return;

	if (!window.EquipeService) {
		corpo.innerHTML = '<tr><td colspan="5" class="empty-table-message">Serviço de equipe indisponível.</td></tr>';
		return;
	}

	const inicio = inicioInput ? inicioInput.value : '';
	const fim = fimInput ? fimInput.value : '';

	const relatorio = window.EquipeService.calcularComissoesPorPeriodo(inicio, fim);

	let totalGeralComissoes = 0;
	let totalGeralServicos = 0;

	relatorio.forEach(r => {
		totalGeralComissoes += r.totalComissao || 0;
		totalGeralServicos += r.qtdServicos || 0;
	});

	const statComissoes = document.getElementById('statTotalComissoes');
	if (statComissoes) statComissoes.textContent = `R$ ${totalGeralComissoes.toFixed(2)}`;

	const statServicos = document.getElementById('statTotalServicosExecutados');
	if (statServicos) statServicos.textContent = totalGeralServicos;

	corpo.innerHTML = '';
	if (relatorio.length === 0) {
		corpo.innerHTML = '<tr><td colspan="5" class="empty-table-message">Nenhum dado de produtividade encontrado para o período.</td></tr>';
		return;
	}

	relatorio.forEach(r => {
		const m = r.membro;
		const regraFmt = m.tipoComissao === 'percentual'
			? `${m.valorComissao || 0}%`
			: `R$ ${parseFloat(m.valorComissao || 0).toFixed(2)}`;

		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>
				<strong>${m.nome}</strong>
				<div style="font-size: 0.75rem; color: var(--text-muted);">Regra: ${regraFmt}</div>
			</td>
			<td>
				<span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.8rem;">
					${m.cargo || 'Equipe'}
				</span>
			</td>
			<td>
				<span class="badge" style="background: #eff6ff; color: #1e40af; font-weight: 700; font-size: 0.85rem;">
					${r.qtdServicos} serviços
				</span>
			</td>
			<td style="font-weight: 600; color: var(--text-main);">
				R$ ${(r.totalFaturado || 0).toFixed(2)}
			</td>
			<td>
				<span class="badge-price" style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 0.9rem;">
					R$ ${(r.totalComissao || 0).toFixed(2)}
				</span>
			</td>
		`;
		corpo.appendChild(tr);
	});
}

function limparFiltroComissoes() {
	const inicioInput = document.getElementById('filtroComissaoInicio');
	const fimInput = document.getElementById('filtroComissaoFim');
	if (inicioInput) inicioInput.value = '';
	if (fimInput) fimInput.value = '';
	filtrarComissoes();
	if (window.UI) window.UI.toast('Mostrando todo o período acumulado.', 'info');
}

// Expõe globalmente para os botões HTML
window.inicializarEquipeConfig = inicializarEquipeConfig;
window.editarMembroEquipeConfig = editarMembroEquipeConfig;
window.removerMembroEquipeConfig = removerMembroEquipeConfig;
window.cancelarEdicaoMembroConfig = cancelarEdicaoMembroConfig;
window.filtrarComissoes = filtrarComissoes;
window.limparFiltroComissoes = limparFiltroComissoes;

// ==========================================================================
// LÓGICA DA ABA MENSAGENS (WHATSAPP)
// ==========================================================================

const DADOS_SIMULACAO_PREVIA = {
	clienteNome: 'Carlos Eduardo',
	cliente: 'Carlos Eduardo',
	primeiro_nome: 'Carlos',
	modelo: 'Honda Civic G10',
	veiculo: 'Honda Civic G10',
	placa: 'BRA-2E19',
	data: '25/09/2026',
	hora: '14:30',
	servicos: 'Lavagem Completa + Cera Pro',
	valor: 90,
	numeroOS: '001428',
	formaPagamento: 'Pix',
	linkAgenda: 'https://calendar.google.com/event?eid=preview_exemplo',
	diasSemVisita: 35,
	saldoFidelidade: '7 de 10 selos acumulados'
};

function carregarFormularioMensagens() {
	if (typeof window.WhatsAppService === 'undefined') return;

	const templates = window.WhatsAppService.getTemplates();
	const tipos = ['agendamento', 'pronto', 'recibo', 'fidelidade'];

	tipos.forEach(tipo => {
		const txtArea = document.getElementById(`template_${tipo}`);
		if (txtArea) {
			const modelo = templates[tipo] || window.WhatsAppService.MODELOS_PADRAO[tipo];
			txtArea.value = modelo ? modelo.template : '';

			// Remove listener anterior clonando ou atribuindo oninput
			txtArea.oninput = () => atualizarPreviaMensagem(tipo);
			atualizarPreviaMensagem(tipo);
		}
	});
}

function atualizarPreviaMensagem(tipo) {
	if (typeof window.WhatsAppService === 'undefined') return;

	const txtArea = document.getElementById(`template_${tipo}`);
	const prevElem = document.getElementById(`previewText_${tipo}`);
	const charCountElem = document.getElementById(`charCount_${tipo}`);

	if (!txtArea || !prevElem) return;

	const templateAtual = txtArea.value || '';
	if (charCountElem) {
		charCountElem.textContent = `${templateAtual.length} caracteres`;
	}

	// Substitui as variáveis com dados de simulação
	const textoFinal = window.WhatsAppService.substituirVariaveis(templateAtual, DADOS_SIMULACAO_PREVIA, {
		incluirValor: true,
		incluirPix: true,
		incluirAgenda: true
	});

	// Converte formatação padrão do WhatsApp para visualização limpa
	const htmlSeguro = textoFinal
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
		.replace(/_(.*?)_/g, '<em>$1</em>');

	prevElem.innerHTML = htmlSeguro;
}

function inserirTagNoModelo(tipo, tag) {
	const txtArea = document.getElementById(`template_${tipo}`);
	if (!txtArea) return;

	txtArea.focus();
	const startPos = txtArea.selectionStart || 0;
	const endPos = txtArea.selectionEnd || 0;
	const valorOriginal = txtArea.value;

	txtArea.value = valorOriginal.substring(0, startPos) + tag + valorOriginal.substring(endPos);
	txtArea.selectionStart = startPos + tag.length;
	txtArea.selectionEnd = startPos + tag.length;

	atualizarPreviaMensagem(tipo);

	if (window.UI) {
		window.UI.toast(`Etiqueta ${tag} inserida!`, 'info');
	}
}

function salvarModelosMensagensConfig() {
	if (typeof window.WhatsAppService === 'undefined') return;

	const tipos = ['agendamento', 'pronto', 'recibo', 'fidelidade'];
	const novosModelos = {};

	tipos.forEach(tipo => {
		const txtArea = document.getElementById(`template_${tipo}`);
		if (txtArea) {
			novosModelos[tipo] = {
				template: txtArea.value.trim()
			};
		}
	});

	window.WhatsAppService.saveTemplates(novosModelos);

	// Exibe banner de sucesso e toast
	const bannerSucesso = document.getElementById('msgSucessoMensagens');
	if (bannerSucesso) {
		bannerSucesso.style.display = 'flex';
		bannerSucesso.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		setTimeout(() => {
			if (bannerSucesso) bannerSucesso.style.display = 'none';
		}, 6000);
	}

	if (window.UI) {
		window.UI.toast('Modelos de mensagens do WhatsApp salvos com sucesso!', 'success');
	} else {
		alert('Modelos de mensagens salvos com sucesso!');
	}
}

function restaurarModeloIndividual(tipo) {
	if (typeof window.WhatsAppService === 'undefined') return;

	const confirmou = confirm(`Deseja restaurar o texto padrão de fábrica para este modelo? Todas as alterações manuais deste item serão perdidas.`);
	if (!confirmou) return;

	const restaurado = window.WhatsAppService.resetTemplate(tipo);
	const txtArea = document.getElementById(`template_${tipo}`);
	if (txtArea && restaurado) {
		txtArea.value = restaurado.template;
		atualizarPreviaMensagem(tipo);
	}

	if (window.UI) {
		window.UI.toast('Modelo restaurado para o padrão de fábrica.', 'info');
	}
}

function restaurarTodosModelosMensagens() {
	if (typeof window.WhatsAppService === 'undefined') return;

	const confirmou = confirm('Atenção: Deseja restaurar TODOS os modelos de mensagens para o padrão de fábrica?');
	if (!confirmou) return;

	window.WhatsAppService.resetAll();
	carregarFormularioMensagens();

	if (window.UI) {
		window.UI.toast('Todos os modelos foram restaurados para o padrão!', 'info');
	}
}

// Expõe para eventos onclick do HTML
window.carregarFormularioMensagens = carregarFormularioMensagens;
window.atualizarPreviaMensagem = atualizarPreviaMensagem;
window.inserirTagNoModelo = inserirTagNoModelo;
window.salvarModelosMensagensConfig = salvarModelosMensagensConfig;
window.restaurarModeloIndividual = restaurarModeloIndividual;
window.restaurarTodosModelosMensagens = restaurarTodosModelosMensagens;



