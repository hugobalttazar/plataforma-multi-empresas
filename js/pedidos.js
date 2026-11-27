// ==========================================================================
// Gestão de Ordens de Serviço, Pátio e Encerramento
// ==========================================================================

// Inicialização com serviços padrão caso esteja vazio pela primeira vez
if (!localStorage.getItem('servicos_initialized')) {
	const defaultServicos = [
		{ nome: 'Lavagem Simples', preco: 40.0, descricao: 'Lavagem externa com xampu neutro e secagem' },
		{ nome: 'Lavagem Completa', preco: 70.0, descricao: 'Lavagem externa, aspiração interna e pneus' },
		{ nome: 'Lavagem Completa + Cera', preco: 90.0, descricao: 'Lavagem completa com proteção de cera' },
		{ nome: 'Higienização Interna', preco: 180.0, descricao: 'Limpeza e desinfecção de estofados e carpetes' },
		{ nome: 'Polimento Comercial', preco: 250.0, descricao: 'Realce de brilho e remoção de marcas leves' }
	];
	if (!localStorage.getItem('servicos')) {
		localStorage.setItem('servicos', JSON.stringify(defaultServicos));
	}
	localStorage.setItem('servicos_initialized', 'true');
}

// Elementos do DOM
const pedidoForm = document.getElementById('pedidoForm');
const pedidoCliente = document.getElementById('pedidoCliente');
const pedidoVeiculoTipo = document.getElementById('pedidoVeiculoTipo');
const pedidoPlaca = document.getElementById('pedidoPlaca');
const pedidoCor = document.getElementById('pedidoCor');
const previewCorContainer = document.getElementById('previewCorContainer');
const pedidoModelo = document.getElementById('pedidoModelo');
const pedidoData = document.getElementById('pedidoData');
const pedidoOperador = document.getElementById('pedidoOperador');
const pedidoServico = document.getElementById('pedidoServico');
const pedidoValor = document.getElementById('pedidoValor');
const sugestoesDiv = document.getElementById('sugestoesClientes');

// Painel e Modal de Veículos do Cliente na O.S.
const painelVeiculosClienteOS = document.getElementById('painelVeiculosClienteOS');
const osVeiculosTitulo = document.getElementById('osVeiculosTitulo');
const osVeiculosMeta = document.getElementById('osVeiculosMeta');
const osVeiculosGrid = document.getElementById('osVeiculosGrid');
const btnAbrirCadastroRapidoVeiculo = document.getElementById('btnAbrirCadastroRapidoVeiculo');
const modalCadastroRapidoVeiculo = document.getElementById('modalCadastroRapidoVeiculo');
const formCadastroRapidoVeiculo = document.getElementById('formCadastroRapidoVeiculo');
const btnFecharModalRapidoVeiculo = document.getElementById('btnFecharModalRapidoVeiculo');
const btnCancelarModalRapidoVeiculo = document.getElementById('btnCancelarModalRapidoVeiculo');
const rapidoVeiculoClienteNome = document.getElementById('rapidoVeiculoClienteNome');
const rapidoVeiculoTipo = document.getElementById('rapidoVeiculoTipo');
const rapidoVeiculoPlaca = document.getElementById('rapidoVeiculoPlaca');
const rapidoVeiculoModelo = document.getElementById('rapidoVeiculoModelo');
const rapidoVeiculoCor = document.getElementById('rapidoVeiculoCor');

let clienteSelecionadoOS = null;
let veiculoSelecionadoId = null;

// Campos de Segmento (Lava Jato / Oficina Mecânica vs Outros)
const blocoCamposLavaJato = document.getElementById('blocoCamposLavaJato');
const blocoCamposOutroSegmento = document.getElementById('blocoCamposOutroSegmento');
const osFotoInput = document.getElementById('osFotoInput');
const btnEscolherFotoOS = document.getElementById('btnEscolherFotoOS');
const btnRemoverFotoOS = document.getElementById('btnRemoverFotoOS');
const osFotoPreviewImg = document.getElementById('osFotoPreviewImg');
const osFotoPlaceholderIcon = document.getElementById('osFotoPlaceholderIcon');
const pedidoItemDescricao = document.getElementById('pedidoItemDescricao');

// Lightbox da Foto
const modalVisualizadorFoto = document.getElementById('modalVisualizadorFoto');
const modalVisualizadorImg = document.getElementById('modalVisualizadorImg');
const modalVisualizadorTitulo = document.getElementById('modalVisualizadorTitulo');

let fotoOSBase64Atual = '';

// Verifica se o negócio atual utiliza veículos/placas (Lava Jato ou Oficina Mecânica)
function isSegmentoLavaJato() {
	if (typeof BrandService !== 'undefined') {
		if (typeof BrandService.isSegmentoAutomotivo === 'function') {
			return BrandService.isSegmentoAutomotivo();
		}
		if (typeof BrandService.getConfig === 'function') {
			const config = BrandService.getConfig();
			return !config.tipoNegocio || config.tipoNegocio === 'lava_jato' || config.tipoNegocio === 'mecanica';
		}
	}
	return true;
}

// Compressão de imagem via Canvas para manter alta resolução com tamanho pequeno (~15-25KB)
function compactarFotoOS(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const maxDim = 320;
				let width = img.width;
				let height = img.height;
				if (width > height) {
					if (width > maxDim) {
						height = Math.round((height * maxDim) / width);
						width = maxDim;
					}
				} else {
					if (height > maxDim) {
						width = Math.round((width * maxDim) / height);
						height = maxDim;
					}
				}
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, width, height);
				resolve(canvas.toDataURL('image/jpeg', 0.82));
			};
			img.onerror = reject;
			img.src = e.target.result;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function setOSFotoPreview(dataUrl) {
	fotoOSBase64Atual = dataUrl || '';
	if (fotoOSBase64Atual) {
		if (osFotoPreviewImg) {
			osFotoPreviewImg.src = fotoOSBase64Atual;
			osFotoPreviewImg.style.display = 'block';
		}
		if (osFotoPlaceholderIcon) osFotoPlaceholderIcon.style.display = 'none';
		if (btnRemoverFotoOS) btnRemoverFotoOS.style.display = 'inline-flex';
	} else {
		if (osFotoPreviewImg) {
			osFotoPreviewImg.src = '';
			osFotoPreviewImg.style.display = 'none';
		}
		if (osFotoPlaceholderIcon) osFotoPlaceholderIcon.style.display = 'block';
		if (btnRemoverFotoOS) btnRemoverFotoOS.style.display = 'none';
	}
}

// Funções de Lightbox
function abrirVisualizadorFoto(fotoUrl, titulo = 'Foto do Atendimento') {
	if (!modalVisualizadorFoto || !modalVisualizadorImg) return;
	modalVisualizadorImg.src = fotoUrl;
	if (modalVisualizadorTitulo) modalVisualizadorTitulo.textContent = `📸 ${titulo}`;
	modalVisualizadorFoto.classList.add('open');
	modalVisualizadorFoto.style.display = 'flex';
}

function fecharVisualizadorFoto() {
	if (modalVisualizadorFoto) {
		modalVisualizadorFoto.classList.remove('open');
		modalVisualizadorFoto.style.display = 'none';
	}
}

window.abrirVisualizadorFoto = abrirVisualizadorFoto;
window.fecharVisualizadorFoto = fecharVisualizadorFoto;

// Vistoria Checkboxes
const vistoriaPertences = document.getElementById('vistoriaPertences');
const vistoriaAvarias = document.getElementById('vistoriaAvarias');
const vistoriaVidros = document.getElementById('vistoriaVidros');
const vistoriaEstepe = document.getElementById('vistoriaEstepe');
const vistoriaObs = document.getElementById('vistoriaObs');

// Abas e visualizações
const tabPatioBtn = document.getElementById('tabPatioBtn');
const tabOrcamentosBtn = document.getElementById('tabOrcamentosBtn');
const tabEncerradosBtn = document.getElementById('tabEncerradosBtn');
const viewPatio = document.getElementById('viewPatio');
const viewOrcamentos = document.getElementById('viewOrcamentos');
const viewEncerrados = document.getElementById('viewEncerrados');
const countPatio = document.getElementById('countPatio');
const countOrcamentos = document.getElementById('countOrcamentos');
const countEncerrados = document.getElementById('countEncerrados');
const corpoTabelaPatio = document.getElementById('corpoTabelaPatio');
const corpoTabelaOrcamentos = document.getElementById('corpoTabelaOrcamentos');
const corpoTabelaEncerrados = document.getElementById('corpoTabelaEncerrados');

// Modal de Encerramento
const modalEncerramento = document.getElementById('modalEncerramento');
const formEncerramento = document.getElementById('formEncerramento');
const modalTitulo = document.getElementById('modalTitulo');
const modalDetalhesVeiculo = document.getElementById('modalDetalhesVeiculo');
const modalDetalhesCliente = document.getElementById('modalDetalhesCliente');
const modalDetalhesServicos = document.getElementById('modalDetalhesServicos');
const modalValorFinal = document.getElementById('modalValorFinal');
const modalFormaPagamento = document.getElementById('modalFormaPagamento');
const modalFecharBtn = document.getElementById('modalFecharBtn');
const modalCancelarBtn = document.getElementById('modalCancelarBtn');
const modalCheckImprimirRecibo = document.getElementById('modalCheckImprimirRecibo');
const blocoPixEncerramento = document.getElementById('blocoPixEncerramento');

// Produtos Comerciais / Venda Balcão na O.S.
const blocoProdutosVendaEntrada = document.getElementById('blocoProdutosVendaEntrada');
const gridProdutosVendaEntrada = document.getElementById('gridProdutosVendaEntrada');
const contadorItensVendaEntrada = document.getElementById('contadorItensVendaEntrada');
const modalSelectProdutoBalcao = document.getElementById('modalSelectProdutoBalcao');
const modalBtnAddProdutoBalcao = document.getElementById('modalBtnAddProdutoBalcao');
const modalListaProdutosFechamento = document.getElementById('modalListaProdutosFechamento');
const modalResumoSubtotalProdutos = document.getElementById('modalResumoSubtotalProdutos');

let produtosFechamentoAtuais = [];

// Modal de Recibo Cupom Fiscal
const modalRecibo = document.getElementById('modalRecibo');
const modalReciboConteudo = document.getElementById('modalReciboConteudo');
const modalReciboTitulo = document.getElementById('modalReciboTitulo');
const modalReciboFecharBtn = document.getElementById('modalReciboFecharBtn');
const modalReciboFecharInferiorBtn = document.getElementById('modalReciboFecharInferiorBtn');
const modalReciboImprimirBtn = document.getElementById('modalReciboImprimirBtn');
const modalReciboBaixarBtn = document.getElementById('modalReciboBaixarBtn');

let pedidoSelecionadoParaRecibo = null;
let pedidoSelecionadoParaEncerrar = null;

// Helpers de Auditoria e Histórico de Orçamentos
function obterOperadorLogadoNome() {
	try {
		const u = window.AuthService && typeof window.AuthService.getCurrentUser === 'function'
			? window.AuthService.getCurrentUser()
			: null;
		if (u && (u.nome || u.username)) return String(u.nome || u.username);
	} catch (e) {}
	return 'Atendimento';
}

function formatarDataHoraAuditoriaBR(isoStr) {
	if (!isoStr) return '';
	const dt = new Date(isoStr);
	if (Number.isNaN(dt.getTime())) return String(isoStr);
	return dt.toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).replace(',', ' às');
}

function registrarEventoHistoricoPedidoSeguro(pedido, evento = {}) {
	if (!pedido || typeof pedido !== 'object') return { lista: [], inserido: false };
	if (window.PublicoService && typeof window.PublicoService.registrarEventoOrcamentoHistorico === 'function') {
		return window.PublicoService.registrarEventoOrcamentoHistorico(pedido, evento);
	}
	if (!Array.isArray(pedido.orcamentoHistorico)) {
		pedido.orcamentoHistorico = [];
	}
	const tipo = String(evento.tipo || 'registro').trim().slice(0, 40);
	const dataHora = String(evento.dataHora || new Date().toISOString()).trim().slice(0, 40);
	const autor = String(evento.autor || 'Sistema').trim().slice(0, 80);
	const titulo = String(evento.titulo || 'Atualização do orçamento').trim().slice(0, 120);
	const comentario = String(evento.comentario || '').trim().slice(0, 600);
	const ip = String(evento.ip || '').trim().slice(0, 64);
	const token = String(evento.token || '').trim().slice(0, 96);
	const valorAnterior = (evento.valorAnterior !== null && evento.valorAnterior !== undefined && !Number.isNaN(Number(evento.valorAnterior)))
		? Number(evento.valorAnterior)
		: null;
	const valorNovo = (evento.valorNovo !== null && evento.valorNovo !== undefined && !Number.isNaN(Number(evento.valorNovo)))
		? Number(evento.valorNovo)
		: null;
	const alteracoes = Array.isArray(evento.alteracoes)
		? evento.alteracoes.map((a) => String(a || '').trim().slice(0, 240)).filter(Boolean).slice(0, 20)
		: [];

	const existente = pedido.orcamentoHistorico.find((h) =>
		h &&
		h.tipo === tipo &&
		String(h.token || '') === token &&
		String(h.comentario || '') === comentario &&
		(String(h.dataHora || '') === dataHora || (token && (tipo === 'cliente_ajuste' || tipo === 'cliente_aprovado')))
	);
	if (existente) {
		let atualizado = false;
		if (ip && (!existente.ip || existente.ip === 'Não identificado') && existente.ip !== ip) {
			existente.ip = ip;
			atualizado = true;
		}
		return { lista: pedido.orcamentoHistorico, inserido: atualizado };
	}

	pedido.orcamentoHistorico.push({
		id: `oh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		tipo,
		dataHora,
		autor,
		titulo,
		comentario,
		ip,
		token,
		valorAnterior,
		valorNovo,
		alteracoes
	});
	if (pedido.orcamentoHistorico.length > 200) {
		pedido.orcamentoHistorico = pedido.orcamentoHistorico.slice(-200);
	}
	return { lista: pedido.orcamentoHistorico, inserido: true };
}

function garantirHistoricoInicialPedidoSeguro(pedido) {
	if (!pedido || typeof pedido !== 'object') return false;
	if (window.PublicoService && typeof window.PublicoService.garantirHistoricoInicialOrcamento === 'function') {
		return window.PublicoService.garantirHistoricoInicialOrcamento(pedido);
	}
	let mudou = false;
	if (!Array.isArray(pedido.orcamentoHistorico)) {
		pedido.orcamentoHistorico = [];
		mudou = true;
	}
	if (pedido.orcamentoHistorico.length === 0) {
		const itensResumo = [];
		if (pedido.servicos) itensResumo.push(`Serviços: ${pedido.servicos}`);
		if (Array.isArray(pedido.produtosVendidos) && pedido.produtosVendidos.length > 0) {
			itensResumo.push(`Produtos: ${pedido.produtosVendidos.map((pv) => `${pv.quantidade || 1}x ${pv.nome}`).join(', ')}`);
		}
		registrarEventoHistoricoPedidoSeguro(pedido, {
			tipo: 'criado',
			dataHora: pedido.criadoEm || new Date().toISOString(),
			autor: pedido.operadorNome || 'Atendimento',
			titulo: 'Orçamento criado no sistema',
			alteracoes: itensResumo,
			valorNovo: Number(pedido.valor || 0) || 0
		});
		mudou = true;
	}
	if (pedido.orcamentoComentarioCliente) {
		const res = registrarEventoHistoricoPedidoSeguro(pedido, {
			tipo: 'cliente_ajuste',
			dataHora: pedido.orcamentoRespondidoEm || new Date().toISOString(),
			autor: 'Cliente (via Link)',
			titulo: 'Cliente solicitou ajuste pelo link',
			comentario: pedido.orcamentoComentarioCliente,
			ip: pedido.orcamentoUltimoIp || pedido.orcamentoAprovadoIp || '',
			token: pedido.orcamentoToken || ''
		});
		if (res.inserido) mudou = true;
	}
	return mudou;
}

// Normalização de dados legados no carregamento
function normalizarDadosPedidos() {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	let houveModificacao = false;

	pedidos.forEach((p, idx) => {
		if (!p.id) {
			p.id = 'os_' + (Date.now() - (pedidos.length - idx) * 1000);
			houveModificacao = true;
		}
		if (!p.status) {
			// Se já tinha forma de pagamento, é legado encerrado
			p.status = p.formaPagamento ? 'encerrado' : 'aberto';
			houveModificacao = true;
		}
		if (!p.placa) {
			p.placa = 'SEM PLACA';
			houveModificacao = true;
		}
		if (!p.cor) {
			p.cor = 'prata';
			houveModificacao = true;
		}
		if (p.status === 'orcamento' || p.orcamentoStatus || p.orcamentoToken || p.orcamentoComentarioCliente || p.orcamentoAprovadoIp || p.orcamentoUltimoIp) {
			if (garantirHistoricoInicialPedidoSeguro(p)) {
				houveModificacao = true;
			}
		}
	});

	if (houveModificacao) {
		localStorage.setItem('pedidos', JSON.stringify(pedidos));
	}
}

// Popular seletor de cores do veículo
function popularCoresVeiculo() {
	if (pedidoCor) {
		pedidoCor.innerHTML = '';
		CORES_VEICULOS.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.id;
			opt.textContent = `${c.nome}`;
			pedidoCor.appendChild(opt);
		});
		if (!pedidoCor.dataset.listenerBound) {
			pedidoCor.addEventListener('change', atualizarPreviewCor);
			pedidoCor.dataset.listenerBound = 'true';
		}
		atualizarPreviewCor();
	}

	if (rapidoVeiculoCor) {
		rapidoVeiculoCor.innerHTML = '';
		CORES_VEICULOS.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.id;
			opt.textContent = `${c.nome}`;
			rapidoVeiculoCor.appendChild(opt);
		});
		rapidoVeiculoCor.value = 'prata';
	}
}

function atualizarPreviewCor() {
	if (!pedidoCor || !previewCorContainer) return;
	const corId = pedidoCor.value;
	const corObj = obterCorVeiculo(corId);
	const tipoAtual = pedidoVeiculoTipo ? pedidoVeiculoTipo.value : 'carro';
	previewCorContainer.innerHTML = `
		${renderizarIconeCarro(corObj, 24, tipoAtual)}
		<small style="font-weight:600; color:var(--text-muted);">${corObj.nome}</small>
	`;
}

if (pedidoVeiculoTipo) {
	pedidoVeiculoTipo.addEventListener('change', atualizarPreviewCor);
}

// Data atual padrão
if (pedidoData && !pedidoData.value) {
	if (window.DateBR) {
		window.DateBR.setInputISO(pedidoData, obterDataHojeISO());
	} else {
		pedidoData.value = obterDataHojeISO();
	}
}

// Formatação automática da placa para maiúsculas
if (pedidoPlaca) {
	pedidoPlaca.addEventListener('input', (e) => {
		let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
		e.target.value = v;
		atualizarAvisoCompatibilidadePacoteEntrada();
	});
}

if (rapidoVeiculoPlaca) {
	rapidoVeiculoPlaca.addEventListener('input', (e) => {
		let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
		e.target.value = v;
	});
}

// Atualiza a lista de opções de serviços no select
function carregarSelectServicos() {
	const servicos = JSON.parse(localStorage.getItem('servicos')) || [];
	if (!pedidoServico) return;

	pedidoServico.innerHTML = '';
	if (servicos.length === 0) {
		const opt = document.createElement('option');
		opt.disabled = true;
		opt.textContent = 'Nenhum serviço cadastrado';
		pedidoServico.appendChild(opt);
	} else {
		servicos.forEach((s) => {
			const opt = document.createElement('option');
			opt.value = s.nome;
			const precoFmt = s.preco ? ` (R$ ${parseFloat(s.preco).toFixed(2)})` : '';
			opt.textContent = `${s.nome}${precoFmt}`;
			opt.dataset.preco = s.preco || 0;
			pedidoServico.appendChild(opt);
		});
	}
}

let pacotesAtivosEntradaCache = [];

function obterPacoteSelecionadoEntrada() {
	const selectPacote = document.getElementById('entradaSelectPacoteAtivo');
	if (!selectPacote || pacotesAtivosEntradaCache.length === 0) return null;
	return pacotesAtivosEntradaCache.find(a => String(a.id) === String(selectPacote.value)) || pacotesAtivosEntradaCache[0] || null;
}

function obterServicosInclusosPacoteEntrada(pacoteSel) {
	if (!pacoteSel) return [];
	if (typeof PacotesService !== 'undefined' && typeof PacotesService.getServicosInclusosAssinatura === 'function') {
		return PacotesService.getServicosInclusosAssinatura(pacoteSel);
	}
	return Array.isArray(pacoteSel.servicosInclusos) ? pacoteSel.servicosInclusos : [];
}

function obterDetalheServicosSelecionadosEntrada() {
	if (!pedidoServico) return [];
	return Array.from(pedidoServico.selectedOptions)
		.filter((opt) => !opt.disabled)
		.map((opt) => ({
			nome: opt.value,
			preco: parseFloat(opt.dataset.preco) || 0
		}));
}

function aplicarServicosDoPacoteNaEntrada() {
	const chkUsarPacote = document.getElementById('chkUsarPacoteEntrada');
	if (!chkUsarPacote || !chkUsarPacote.checked || !pedidoServico) return { naoEncontrados: [] };

	const pacoteSel = obterPacoteSelecionadoEntrada();
	const inclusos = obterServicosInclusosPacoteEntrada(pacoteSel);
	if (inclusos.length === 0) return { naoEncontrados: [] };

	const opcoes = Array.from(pedidoServico.options).filter((o) => !o.disabled);
	const naoEncontrados = [];

	inclusos.forEach((nomeIncluso) => {
		const alvo = String(nomeIncluso || '').trim().toLowerCase();
		if (!alvo) return;
		const match = opcoes.find((opt) => String(opt.value || '').trim().toLowerCase() === alvo);
		if (match) {
			match.selected = true;
		} else {
			naoEncontrados.push(nomeIncluso);
		}
	});

	return { naoEncontrados };
}

function atualizarAvisoCompatibilidadePacoteEntrada(servicosNaoEncontrados = []) {
	const selectPacote = document.getElementById('entradaSelectPacoteAtivo');
	const infoPacote = document.getElementById('infoPacoteEntrada');
	if (!selectPacote || !infoPacote || pacotesAtivosEntradaCache.length === 0) return;

	const isLavaJato = isSegmentoLavaJato();
	const pacoteSel = obterPacoteSelecionadoEntrada();
	const inclusos = obterServicosInclusosPacoteEntrada(pacoteSel);
	const placaAtual = isLavaJato && pedidoPlaca ? pedidoPlaca.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim() : '';
	const placasRestritas = isLavaJato && Array.isArray(pacoteSel?.placasAutorizadas) ? pacoteSel.placasAutorizadas : [];

	const partes = [];
	let corTexto = '#1d4ed8';

	if (placasRestritas.length > 0 && placaAtual && !placasRestritas.includes(placaAtual)) {
		corTexto = '#b45309';
		partes.push(`Atenção: pacote vinculado às placas ${placasRestritas.join(', ')} (placa atual: ${placaAtual}).`);
	}

	if (inclusos.length > 0) {
		partes.push(`Serviço(s) coberto(s) zerado(s): ${inclusos.join(', ')}. Serviços extras e produtos serão somados.`);
	} else {
		partes.push('Pacote sem serviço vinculado: ao marcar, os serviços selecionados serão zerados (mantendo produtos extras).');
	}

	if (Array.isArray(servicosNaoEncontrados) && servicosNaoEncontrados.length > 0) {
		corTexto = '#b45309';
		partes.push(`Não encontrado na lista atual de serviços: ${servicosNaoEncontrados.join(', ')}.`);
	}

	infoPacote.style.color = corTexto;
	infoPacote.textContent = partes.join(' ');
}

function atualizarPainelPacotesEntrada(clienteObj = null) {
	const bloco = document.getElementById('blocoPacoteAtivoEntrada');
	const chk = document.getElementById('chkUsarPacoteEntrada');
	const selectPacote = document.getElementById('entradaSelectPacoteAtivo');
	if (!bloco || !chk || !selectPacote) return;

	if (typeof PacotesService === 'undefined') {
		pacotesAtivosEntradaCache = [];
		bloco.style.display = 'none';
		return;
	}

	const cli = clienteObj || clienteSelecionadoOS || encontrarClientePorNome(pedidoCliente ? pedidoCliente.value : '');
	const nomeDigitado = pedidoCliente ? pedidoCliente.value.trim() : '';
	let pacotesAtivos = [];

	if (cli) {
		const chave = cli.id || cli.nome || '';
		pacotesAtivos = PacotesService.getAssinaturasAtivasCliente(chave);
		if (pacotesAtivos.length === 0 && cli.nome) {
			pacotesAtivos = PacotesService.getAssinaturasAtivasCliente(cli.nome);
		}
	} else if (nomeDigitado) {
		pacotesAtivos = PacotesService.getAssinaturasAtivasCliente(nomeDigitado);
	}

	pacotesAtivosEntradaCache = pacotesAtivos;

	if (pacotesAtivos.length === 0) {
		chk.checked = false;
		selectPacote.innerHTML = '';
		bloco.style.display = 'none';
		return;
	}

	const prevVal = selectPacote.value;
	const isLavaJato = isSegmentoLavaJato();
	const escPkg = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
	const placaAtual = isLavaJato && pedidoPlaca ? pedidoPlaca.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim() : '';

	bloco.style.display = 'block';
	selectPacote.innerHTML = pacotesAtivos.map(a => {
		const validadeFmt = window.DateBR ? window.DateBR.formatarParaBR(a.dataValidade) : a.dataValidade;
		const inclusos = obterServicosInclusosPacoteEntrada(a);
		const sufixoServs = inclusos.length > 0 ? ` • Cobre: ${inclusos.join(', ')}` : '';
		const placasAut = isLavaJato && Array.isArray(a.placasAutorizadas) ? a.placasAutorizadas : [];
		let sufixoPlaca = '';
		if (placasAut.length > 0) {
			const compativel = placaAtual && placasAut.includes(placaAtual);
			sufixoPlaca = compativel
				? ` • Placa ${placaAtual} OK`
				: ` • Placas: ${placasAut.join(', ')}`;
		}
		return `<option value="${escPkg(a.id)}">${escPkg(a.planoNome)} (${a.creditosRestantes}/${a.creditosTotais} créditos • Válido até ${escPkg(validadeFmt)}${escPkg(sufixoServs)}${escPkg(sufixoPlaca)})</option>`;
	}).join('');

	if (prevVal && pacotesAtivos.some(a => String(a.id) === String(prevVal))) {
		selectPacote.value = prevVal;
	}

	atualizarAvisoCompatibilidadePacoteEntrada();
}

// Cálculo automático de preço ao selecionar serviços ou produtos
function calcularValorTotalEntrada(forcarZeroQuandoSemItem = false) {
	const servicosSelecionados = obterDetalheServicosSelecionadosEntrada();
	let totalServicos = servicosSelecionados.reduce((acc, s) => acc + (parseFloat(s.preco) || 0), 0);

	let totalProdutos = 0;
	const checks = document.querySelectorAll('.check-produto-venda:checked');
	checks.forEach(chk => {
		totalProdutos += parseFloat(chk.dataset.preco || 0);
	});

	const chkUsarPacote = document.getElementById('chkUsarPacoteEntrada');
	const selectPacote = document.getElementById('entradaSelectPacoteAtivo');
	const usandoPacote = Boolean(chkUsarPacote && chkUsarPacote.checked && selectPacote && selectPacote.value);

	let total = totalServicos + totalProdutos;
	if (usandoPacote) {
		const pacoteSel = obterPacoteSelecionadoEntrada();
		const inclusos = obterServicosInclusosPacoteEntrada(pacoteSel);
		if (typeof PacotesService !== 'undefined' && typeof PacotesService.calcularAbatimentoServicos === 'function') {
			const abat = PacotesService.calcularAbatimentoServicos(servicosSelecionados, inclusos);
			total = Math.max(0, abat.valorServicosRestantes + totalProdutos);
		} else {
			total = totalProdutos;
		}
	}

	if (pedidoValor && (usandoPacote || total > 0 || forcarZeroQuandoSemItem)) {
		pedidoValor.value = total.toFixed(2);
	}
}

if (pedidoServico) {
	pedidoServico.addEventListener('change', () => calcularValorTotalEntrada(false));
}

const chkUsarPacoteEntradaEl = document.getElementById('chkUsarPacoteEntrada');
if (chkUsarPacoteEntradaEl) {
	chkUsarPacoteEntradaEl.addEventListener('change', () => {
		let naoEncontrados = [];
		if (chkUsarPacoteEntradaEl.checked) {
			const res = aplicarServicosDoPacoteNaEntrada();
			naoEncontrados = res.naoEncontrados || [];
		}
		atualizarAvisoCompatibilidadePacoteEntrada(naoEncontrados);
		calcularValorTotalEntrada(true);
	});
}

const selectPacoteEntradaEl = document.getElementById('entradaSelectPacoteAtivo');
if (selectPacoteEntradaEl) {
	selectPacoteEntradaEl.addEventListener('change', () => {
		let naoEncontrados = [];
		if (chkUsarPacoteEntradaEl && chkUsarPacoteEntradaEl.checked) {
			const res = aplicarServicosDoPacoteNaEntrada();
			naoEncontrados = res.naoEncontrados || [];
		}
		atualizarAvisoCompatibilidadePacoteEntrada(naoEncontrados);
		calcularValorTotalEntrada(true);
	});
}

// Carregar produtos comerciais disponíveis para seleção na entrada da O.S.
function carregarProdutosVendaEntrada() {
	if (!gridProdutosVendaEntrada || typeof EstoqueService === 'undefined') return;
	const produtosVenda = EstoqueService.getProdutosParaVenda();

	gridProdutosVendaEntrada.innerHTML = '';
	if (contadorItensVendaEntrada) {
		contadorItensVendaEntrada.textContent = `${produtosVenda.length} produto(s) de balcão`;
	}

	if (produtosVenda.length === 0) {
		gridProdutosVendaEntrada.innerHTML = `
			<div style="font-size:0.82rem; color:var(--text-muted); grid-column: 1 / -1;">
				Nenhum produto cadastrado para venda direta. Cadastre na aba <a href="estoque.html" style="color:var(--primary); font-weight:600;">Estoque</a> marcando a opção "Venda ao Consumidor".
			</div>
		`;
		return;
	}

	produtosVenda.forEach(p => {
		const saldo = parseFloat(p.quantidade || 0);
		const semEstoque = saldo <= 0;
		const precoVenda = parseFloat(p.precoVenda || 0);

		const label = document.createElement('label');
		label.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			background: var(--bg-input);
			padding: 8px 10px;
			border: 1px solid ${semEstoque ? 'var(--border-color)' : 'var(--success-border)'};
			border-radius: var(--radius-sm);
			cursor: ${semEstoque ? 'not-allowed' : 'pointer'};
			opacity: ${semEstoque ? '0.6' : '1'};
			transition: all 0.15s ease;
		`;

		label.innerHTML = `
			<input type="checkbox" class="check-produto-venda" 
				data-id="${p.id}" 
				data-nome="${p.nome}" 
				data-preco="${precoVenda}" 
				data-saldo="${saldo}" 
				${semEstoque ? 'disabled' : ''} 
				style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer;" />
			<div style="flex: 1; line-height: 1.25;">
				<div style="font-size: 0.84rem; font-weight: 700; color: var(--text-main);">${p.nome}</div>
				<div style="font-size: 0.76rem; color: var(--success); font-weight: 700; margin-top: 2px;">
					R$ ${precoVenda.toFixed(2)} 
					<span style="color: var(--text-muted); font-weight: normal; font-size: 0.72rem;">(Disp: ${saldo})</span>
				</div>
			</div>
		`;

		const chk = label.querySelector('.check-produto-venda');
		chk.addEventListener('change', () => {
			if (chk.checked) {
				label.style.borderColor = 'var(--primary)';
				label.style.background = 'var(--success-light)';
			} else {
				label.style.borderColor = 'var(--success-border)';
				label.style.background = 'var(--bg-input)';
			}
			calcularValorTotalEntrada();
		});

		gridProdutosVendaEntrada.appendChild(label);
	});
}

function encontrarClientePorNome(nome) {
	if (!nome) return null;
	const termo = nome.trim().toLowerCase();
	if (!termo) return null;
	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	return clientes.find((c) => c.nome && c.nome.trim().toLowerCase() === termo) || null;
}

function aplicarVeiculoNoFormularioOS(veiculo) {
	if (!veiculo) return;
	veiculoSelecionadoId = veiculo.id || veiculo.placa;
	const tipoNorm = typeof normalizarTipoVeiculo === 'function'
		? normalizarTipoVeiculo(veiculo.tipo)
		: (veiculo.tipo === 'moto' ? 'moto' : (veiculo.tipo === 'caminhao' ? 'caminhao' : 'carro'));
	if (pedidoVeiculoTipo) pedidoVeiculoTipo.value = tipoNorm;
	if (pedidoPlaca) pedidoPlaca.value = (veiculo.placa || '').toUpperCase();
	if (pedidoModelo) pedidoModelo.value = veiculo.modelo || '';
	if (pedidoCor && veiculo.cor) {
		pedidoCor.value = veiculo.cor;
	}
	atualizarPreviewCor();
	atualizarPainelPacotesEntrada();

	if (osVeiculosGrid) {
		osVeiculosGrid.querySelectorAll('.os-veiculo-option').forEach((btn) => {
			if (btn.dataset.vid === String(veiculoSelecionadoId)) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});
	}
}

function atualizarPainelVeiculosClienteOS(clienteObj, autoSelecionar = true) {
	if (!painelVeiculosClienteOS) return;

	if (!isSegmentoLavaJato() || !clienteObj) {
		painelVeiculosClienteOS.style.display = 'none';
		if (osVeiculosGrid) osVeiculosGrid.innerHTML = '';
		return;
	}

	clienteSelecionadoOS = clienteObj;
	const veiculos = Array.isArray(clienteObj.veiculos) ? clienteObj.veiculos : [];
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	painelVeiculosClienteOS.style.display = 'block';
	if (osVeiculosTitulo) {
		osVeiculosTitulo.textContent = `Veículos de ${clienteObj.nome}`;
	}
	if (osVeiculosMeta) {
		if (veiculos.length === 0) {
			osVeiculosMeta.textContent = 'Nenhum veículo cadastrado para este cliente ainda';
		} else if (veiculos.length === 1) {
			osVeiculosMeta.textContent = '1 veículo cadastrado · selecionado automaticamente';
		} else {
			osVeiculosMeta.textContent = `${veiculos.length} veículos cadastrados · clique em uma placa para selecionar`;
		}
	}

	if (!osVeiculosGrid) return;
	osVeiculosGrid.innerHTML = '';

	if (veiculos.length === 0) {
		osVeiculosGrid.innerHTML = `
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
		btn.className = 'os-veiculo-option' + (String(veiculoSelecionadoId) === String(vid) ? ' active' : '');
		btn.dataset.vid = String(vid);
		btn.innerHTML = `
			${renderizarIconeCarro(corObj, 28, v.tipo)}
			<div class="os-veiculo-option-info">
				<span class="os-veiculo-option-placa">${esc(v.placa)}</span>
				<span class="os-veiculo-option-desc">${esc(tipoLabel)} · ${esc(v.modelo || 'Modelo não inf.')} · ${esc(corObj.nome)}</span>
			</div>
		`;
		btn.addEventListener('click', () => {
			aplicarVeiculoNoFormularioOS(v);
		});
		osVeiculosGrid.appendChild(btn);
	});

	if (autoSelecionar && veiculos.length === 1) {
		aplicarVeiculoNoFormularioOS(veiculos[0]);
	}
}

function abrirModalCadastroRapidoVeiculo() {
	const clienteAtual = clienteSelecionadoOS || encontrarClientePorNome(pedidoCliente ? pedidoCliente.value : '');
	if (!clienteAtual) {
		if (window.UI) window.UI.toast('Selecione primeiro um cliente cadastrado antes de vincular um veículo.', 'warning');
		if (pedidoCliente) pedidoCliente.focus();
		return;
	}

	clienteSelecionadoOS = clienteAtual;
	if (rapidoVeiculoClienteNome) {
		rapidoVeiculoClienteNome.textContent = clienteAtual.tel1
			? `${clienteAtual.nome} (${clienteAtual.tel1})`
			: clienteAtual.nome;
	}
	if (rapidoVeiculoTipo && pedidoVeiculoTipo) {
		rapidoVeiculoTipo.value = pedidoVeiculoTipo.value || 'carro';
	}
	if (rapidoVeiculoPlaca) {
		rapidoVeiculoPlaca.value = pedidoPlaca ? pedidoPlaca.value.trim().toUpperCase() : '';
	}
	if (rapidoVeiculoModelo) {
		rapidoVeiculoModelo.value = pedidoModelo ? pedidoModelo.value.trim() : '';
	}
	if (rapidoVeiculoCor && pedidoCor) {
		rapidoVeiculoCor.value = pedidoCor.value || 'prata';
	}

	if (modalCadastroRapidoVeiculo) {
		modalCadastroRapidoVeiculo.classList.add('open');
		modalCadastroRapidoVeiculo.style.display = 'flex';
		setTimeout(() => {
			if (rapidoVeiculoPlaca && !rapidoVeiculoPlaca.value) {
				rapidoVeiculoPlaca.focus();
			} else if (rapidoVeiculoModelo) {
				rapidoVeiculoModelo.focus();
			}
		}, 60);
	}
}

function fecharModalCadastroRapidoVeiculo() {
	if (modalCadastroRapidoVeiculo) {
		modalCadastroRapidoVeiculo.classList.remove('open');
		modalCadastroRapidoVeiculo.style.display = 'none';
	}
	if (formCadastroRapidoVeiculo) {
		formCadastroRapidoVeiculo.reset();
	}
}

if (btnAbrirCadastroRapidoVeiculo) {
	btnAbrirCadastroRapidoVeiculo.addEventListener('click', abrirModalCadastroRapidoVeiculo);
}
if (btnFecharModalRapidoVeiculo) {
	btnFecharModalRapidoVeiculo.addEventListener('click', fecharModalCadastroRapidoVeiculo);
}
if (btnCancelarModalRapidoVeiculo) {
	btnCancelarModalRapidoVeiculo.addEventListener('click', fecharModalCadastroRapidoVeiculo);
}

if (formCadastroRapidoVeiculo) {
	formCadastroRapidoVeiculo.addEventListener('submit', (e) => {
		e.preventDefault();
		const clienteRef = clienteSelecionadoOS || encontrarClientePorNome(pedidoCliente ? pedidoCliente.value : '');
		if (!clienteRef) {
			if (window.UI) window.UI.toast('Cliente selecionado não encontrado.', 'error');
			return;
		}

		const tipo = rapidoVeiculoTipo ? rapidoVeiculoTipo.value : 'carro';
		const placa = (rapidoVeiculoPlaca ? rapidoVeiculoPlaca.value : '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
		const modelo = rapidoVeiculoModelo ? rapidoVeiculoModelo.value.trim() : '';
		const cor = rapidoVeiculoCor ? rapidoVeiculoCor.value : 'prata';

		if (!placa || placa.length < 3) {
			if (window.UI) window.UI.toast('Informe uma placa válida para cadastrar.', 'warning');
			if (rapidoVeiculoPlaca) rapidoVeiculoPlaca.focus();
			return;
		}
		if (!modelo) {
			if (window.UI) window.UI.toast('Informe o modelo do veículo.', 'warning');
			if (rapidoVeiculoModelo) rapidoVeiculoModelo.focus();
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
			clienteSelecionadoOS = clientes[idx];
			fecharModalCadastroRapidoVeiculo();
			atualizarPainelVeiculosClienteOS(clientes[idx], false);
			aplicarVeiculoNoFormularioOS(jaExiste);
			return;
		}

		const tipoNormRapido = typeof normalizarTipoVeiculo === 'function'
			? normalizarTipoVeiculo(tipo)
			: (tipo === 'moto' ? 'moto' : (tipo === 'caminhao' ? 'caminhao' : 'carro'));

		const novoVeiculo = {
			id: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			tipo: tipoNormRapido,
			placa,
			modelo,
			cor: cor || 'prata'
		};

		clientes[idx].veiculos.push(novoVeiculo);
		localStorage.setItem('clientes', JSON.stringify(clientes));

		clienteSelecionadoOS = clientes[idx];
		fecharModalCadastroRapidoVeiculo();
		atualizarPainelVeiculosClienteOS(clientes[idx], false);
		aplicarVeiculoNoFormularioOS(novoVeiculo);

		if (window.UI) {
			window.UI.toast(`Veículo ${placa} (${modelo}) salvo no cadastro de ${clientes[idx].nome}!`, 'success');
		}
	});
}

// Autocomplete de clientes (por Nome ou Telefone/Código)
if (pedidoCliente && sugestoesDiv) {
	pedidoCliente.addEventListener('input', () => {
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const termo = pedidoCliente.value.trim().toLowerCase();
		const termoApenasDigitos = termo.replace(/\D/g, '');
		sugestoesDiv.innerHTML = '';

		if (clienteSelecionadoOS && clienteSelecionadoOS.nome.trim().toLowerCase() !== termo) {
			clienteSelecionadoOS = null;
			veiculoSelecionadoId = null;
		}

		if (termo === '') {
			atualizarPainelVeiculosClienteOS(null);
			atualizarPainelPacotesEntrada(null);
			return;
		}

		const clienteExato = clientes.find((c) => c.nome && c.nome.trim().toLowerCase() === termo);
		if (clienteExato) {
			atualizarPainelVeiculosClienteOS(clienteExato, false);
			atualizarPainelPacotesEntrada(clienteExato);
		} else {
			atualizarPainelVeiculosClienteOS(null);
			atualizarPainelPacotesEntrada(null);
		}

		const resultados = clientes.filter((c) => {
			const nomeMatch = c.nome && c.nome.toLowerCase().includes(termo);
			const tel1Limpo = (c.tel1 || '').replace(/\D/g, '');
			const tel2Limpo = (c.tel2 || '').replace(/\D/g, '');
			const telMatch = termoApenasDigitos.length > 0 && (
				tel1Limpo.includes(termoApenasDigitos) || tel2Limpo.includes(termoApenasDigitos)
			);
			return nomeMatch || telMatch;
		});

		if (resultados.length === 0) {
			const div = document.createElement('div');
			div.textContent = 'Nenhum cliente cadastrado com este nome ou telefone';
			div.classList.add('sugestaoItem');
			div.style.color = 'var(--text-muted)';
			div.style.cursor = 'default';
			sugestoesDiv.appendChild(div);
			return;
		}

		resultados.forEach((c) => {
			const div = document.createElement('div');
			const telDestaque = c.tel1 ? ` • 📞 ${c.tel1}` : '';
			const qtdVeiculos = Array.isArray(c.veiculos) ? c.veiculos.length : 0;
			const veiculosTag = (isSegmentoLavaJato() && qtdVeiculos > 0)
				? ` • 🚗 ${qtdVeiculos} ${qtdVeiculos === 1 ? 'veículo' : 'veículos'}`
				: '';
			div.innerHTML = `<strong>${c.nome}</strong>${telDestaque}${veiculosTag}`;
			div.classList.add('sugestaoItem');
			div.addEventListener('click', () => {
				pedidoCliente.value = c.nome;
				sugestoesDiv.innerHTML = '';
				veiculoSelecionadoId = null;
				if (pedidoPlaca) pedidoPlaca.value = '';
				if (pedidoModelo) pedidoModelo.value = '';
				atualizarPainelVeiculosClienteOS(c, true);
				atualizarPainelPacotesEntrada(c);
			});
			sugestoesDiv.appendChild(div);
		});
	});

	pedidoCliente.addEventListener('change', () => {
		const clienteExato = encontrarClientePorNome(pedidoCliente.value);
		if (clienteExato) {
			atualizarPainelVeiculosClienteOS(clienteExato, true);
			atualizarPainelPacotesEntrada(clienteExato);
		} else {
			atualizarPainelPacotesEntrada(null);
		}
	});

	document.addEventListener('click', (e) => {
		if (!pedidoCliente.contains(e.target) && !sugestoesDiv.contains(e.target)) {
			sugestoesDiv.innerHTML = '';
		}
	});
}

// Alternar abas Pátio x Orçamentos x Encerrados
function ativarAbaPedidos(aba = 'patio') {
	if (aba === 'orcamentos' && window.AuthService && typeof window.AuthService.hasPermission === 'function' && !window.AuthService.hasPermission('orcamentos')) {
		aba = 'patio';
	}
	const botoes = [
		{ id: 'patio', btn: tabPatioBtn, view: viewPatio },
		{ id: 'orcamentos', btn: tabOrcamentosBtn, view: viewOrcamentos },
		{ id: 'encerrados', btn: tabEncerradosBtn, view: viewEncerrados }
	];
	botoes.forEach((item) => {
		const ativo = item.id === aba;
		if (item.btn) item.btn.classList.toggle('active', ativo);
		if (item.view) item.view.style.display = ativo ? 'block' : 'none';
	});
}

if (tabPatioBtn) tabPatioBtn.addEventListener('click', () => ativarAbaPedidos('patio'));
if (tabOrcamentosBtn) tabOrcamentosBtn.addEventListener('click', () => ativarAbaPedidos('orcamentos'));
if (tabEncerradosBtn) tabEncerradosBtn.addEventListener('click', () => ativarAbaPedidos('encerrados'));

// Função auxiliar para renderizar identificação da O.S. (Placa para Lava Jato/Mecânica OU Foto/Miniatura para outros segmentos)
function renderizarIdentificacaoOS(p, isLavaJato, tamanhoIcone = 32) {
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	if (isLavaJato) {
		const corObj = obterCorVeiculo(p.cor);
		const modeloTexto = p.modelo ? ` • ${esc(p.modelo)}` : '';
		return `
			<div class="veiculo-info-cell">
				${renderizarIconeCarro(corObj, tamanhoIcone, p.veiculoTipo)}
				<div class="veiculo-meta">
					<span class="badge-placa">${esc(p.placa || 'SEM PLACA')}</span>
					<span class="veiculo-cor-nome">${esc(corObj.nome)}${modeloTexto}</span>
				</div>
			</div>
		`;
	}

	// Outros Segmentos: Prioriza Foto do Pedido/Atendimento, fallback para Foto do Cliente ou Iniciais
	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	const cliObj = clientes.find(c => c.nome && c.nome.toLowerCase() === (p.cliente || '').toLowerCase());
	const fotoFinal = p.foto || (cliObj && cliObj.foto ? cliObj.foto : '');
	const itemTexto = p.itemDescricao || p.modelo || 'Atendimento / Serviço';

	if (fotoFinal) {
		return `
			<div class="os-foto-cell">
				<div class="os-foto-thumbnail" style="background-image: url('${fotoFinal}'); width:${tamanhoIcone + 10}px; height:${tamanhoIcone + 10}px;" onclick="window.abrirVisualizadorFoto('${fotoFinal}', '${esc(p.cliente)} - ${esc(itemTexto)}')" title="Clique para ampliar foto"></div>
				<div class="os-foto-meta">
					<span class="os-foto-badge-tag">📸 ${esc(itemTexto)}</span>
					<span class="os-foto-item-nome">${esc(p.cliente || 'Cliente')}</span>
				</div>
			</div>
		`;
	}

	// Sem foto: Exibe avatar com iniciais do cliente
	const iniciais = (p.cliente || 'CL').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
	return `
		<div class="os-foto-cell">
			<div class="os-foto-thumbnail sem-foto" style="width:${tamanhoIcone + 10}px; height:${tamanhoIcone + 10}px;" title="Sem foto anexada">
				${iniciais}
			</div>
			<div class="os-foto-meta">
				<span class="os-foto-badge-tag" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">📋 ${esc(itemTexto)}</span>
				<span class="os-foto-item-nome">${esc(p.cliente || 'Cliente')}</span>
			</div>
		</div>
	`;
}

// Renderização das Tabelas (Pátio e Encerrados)
function renderizarTabelas() {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const isLavaJato = isSegmentoLavaJato();

	// Ajusta títulos dos cabeçalhos da tabela conforme o segmento
	const thVeiculoPatio = document.getElementById('thVeiculoPatio');
	const thVeiculoOrcamentos = document.getElementById('thVeiculoOrcamentos');
	const thVeiculoEncerrados = document.getElementById('thVeiculoEncerrados');
	if (thVeiculoPatio) {
		thVeiculoPatio.textContent = isLavaJato ? 'Veículo & Placa' : 'Identificação & Foto';
	}
	if (thVeiculoOrcamentos) {
		thVeiculoOrcamentos.textContent = isLavaJato ? 'Veículo & Placa' : 'Identificação & Foto';
	}
	if (thVeiculoEncerrados) {
		thVeiculoEncerrados.textContent = isLavaJato ? 'Veículo & Placa' : 'Identificação & Foto';
	}

	const pedidosPatio = pedidos.filter((p) => p.status === 'aberto');
	const pedidosOrcamento = pedidos.filter((p) => p.status === 'orcamento');
	const pedidosEncerrados = pedidos.filter((p) => p.status === 'encerrado');

	const countPatioAtual = document.getElementById('countPatio');
	const countOrcAtual = document.getElementById('countOrcamentos');
	const countEncAtual = document.getElementById('countEncerrados');
	if (countPatioAtual) countPatioAtual.textContent = pedidosPatio.length;
	if (countOrcAtual) countOrcAtual.textContent = pedidosOrcamento.length;
	if (countEncAtual) countEncAtual.textContent = pedidosEncerrados.length;

	// Renderizar Pátio (Em Aberto)
	corpoTabelaPatio.innerHTML = '';
	if (pedidosPatio.length === 0) {
		const msgLivre = isLavaJato 
			? '🅿️ Nenhum veículo em atendimento no pátio no momento. Preencha o formulário acima para dar entrada.'
			: '📋 Nenhum atendimento em andamento no momento. Preencha o formulário acima para abrir uma nova O.S.';
		corpoTabelaPatio.innerHTML = `
			<tr>
				<td colspan="6" class="empty-table-message">
					${msgLivre}
				</td>
			</tr>
		`;
	} else {
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		// Mostrar mais recentes primeiro
		[...pedidosPatio].reverse().forEach((p) => {
			const tr = document.createElement('tr');
			const valorFormatado = parseFloat(p.valor || 0).toFixed(2);
			const prontoNaTV = p.statusTV === 'pronto';

			const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliObj = clientes.find(c => c.nome && c.nome.toLowerCase() === (p.cliente || '').toLowerCase());
			const temTelefone = cliObj && cliObj.tel1;

			const possuiHistoricoOrc = Boolean(
				(Array.isArray(p.orcamentoHistorico) && p.orcamentoHistorico.length > 0) ||
				p.orcamentoAprovadoIp ||
				p.orcamentoUltimoIp ||
				p.orcamentoToken
			);
			const dataAprovLink = formatarDataHoraAuditoriaBR(p.orcamentoAprovadoEm || p.aprovadoViaLinkEm || p.orcamentoRespondidoEm);

			tr.innerHTML = `
				<td>
					${renderizarIdentificacaoOS(p, isLavaJato, 32)}
				</td>
				<td>
					<strong>${esc(p.cliente || 'Não identificado')}</strong>
					${p.operadorNome ? `<small style="display:block; color:var(--text-muted);">👤 Resp: ${esc(p.operadorNome)}</small>` : ''}
				</td>
				<td>
					<div>${esc(window.DateBR ? (window.DateBR.formatarParaBR(p.data) || '-') : (p.data || '-'))}</div>
					<small style="color:var(--text-muted);">${p.horaEntrada ? 'Chegada: ' + esc(p.horaEntrada) : ''}</small>
				</td>
				<td>
					<div>${esc(p.servicos || '-')}</div>
					${p.produtosVendidos && p.produtosVendidos.length > 0 ? `
						<div style="margin-top:4px;">
							<span class="badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-size:0.75rem;">
								🛍️ ${p.produtosVendidos.map(pv => `${pv.quantidade || 1}x ${esc(pv.nome)}`).join(', ')}
							</span>
						</div>
					` : ''}
				</td>
				<td>
					<span class="badge-price">R$ ${valorFormatado}</span>
					<div><span class="badge badge-status badge-status-aberto">Em Andamento</span></div>
					<div style="margin-top:4px;">
						<span class="badge" style="font-size:0.72rem; ${prontoNaTV ? 'background:#dcfce7; color:#15803d; border-color:#bbf7d0;' : 'background:#e0f2fe; color:#0369a1; border-color:#bae6fd;'}">
							${prontoNaTV ? '📺 Pronto na TV' : '📺 Em Serviço na TV'}
						</span>
					</div>
					${p.orcamentoAprovadoIp ? `
						<div class="orc-audit-chip" title="Aprovação registrada pelo cliente via link">
							✅ IP: ${esc(p.orcamentoAprovadoIp)}${dataAprovLink ? ` • ${esc(dataAprovLink)}` : ''}
						</div>
					` : ''}
					${p.pacoteAbatido ? `
						<div style="margin-top:4px;">
							<span class="badge" style="font-size:0.72rem; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">
								🎟️ ${esc(p.pacoteNome || 'Pacote')}
							</span>
						</div>
					` : ''}
				</td>
				<td style="text-align: center;">
					<div class="btn-action-group" style="flex-wrap:wrap; justify-content:center;">
						<button type="button" class="btn btn-sm" onclick="window.alternarStatusTVPedido('${p.id}')" style="background:${prontoNaTV ? '#f59e0b' : '#0284c7'}; color:#fff; font-weight:600;" title="Alternar status no Painel TV da sala de espera">
							${prontoNaTV ? '🔧 Voltar Serviço' : '📺 Pronto TV'}
						</button>
						${temTelefone ? `
							<button type="button" class="btn btn-sm" onclick="abrirDisparoWhatsAppCarroPronto('${p.id}')" style="background:#16a34a; color:#fff; display:inline-flex; align-items:center; gap:4px;" title="Avisar cliente no WhatsApp que o serviço está pronto">
								💬 ${isLavaJato ? 'Carro Pronto' : 'Avisar Pronto'}
							</button>
						` : ''}
						${possuiHistoricoOrc ? `
							<button type="button" class="btn btn-sm btn-secondary" onclick="window.abrirHistoricoOrcamento('${p.id}')" title="Ver histórico do orçamento, mensagens e IP de aprovação">
								📜 Hist. Orç.
							</button>
						` : ''}
						<button type="button" class="btn btn-sm btn-receber-os" data-id="${p.id}" onclick="window.abrirModalEncerramento('${p.id}')" style="background-color: var(--success); color: #fff; cursor: pointer; font-weight:700;">
							💰 Receber
						</button>
						<button type="button" class="btn btn-sm btn-secondary btn-cancelar-os" data-id="${p.id}" style="color: var(--danger);" title="Remover O.S.">
							🗑️
						</button>
					</div>
				</td>
			`;
			corpoTabelaPatio.appendChild(tr);
		});
	}

	// Renderizar Orçamentos Digitais
	if (corpoTabelaOrcamentos) {
		corpoTabelaOrcamentos.innerHTML = '';
		if (pedidosOrcamento.length === 0) {
			corpoTabelaOrcamentos.innerHTML = `
				<tr>
					<td colspan="7" class="empty-table-message">
						📝 Nenhum orçamento pendente. No formulário acima, selecione "Salvar como Orçamento" para gerar um link aprovável ao cliente.
					</td>
				</tr>
			`;
		} else {
			const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
			[...pedidosOrcamento].reverse().forEach((p) => {
				const tr = document.createElement('tr');
				const valorFormatado = parseFloat(p.valor || 0).toFixed(2);
				const dataFmt = window.DateBR ? (window.DateBR.formatarParaBR(p.data) || '-') : (p.data || '-');

				let statusBadgeHtml = '<span class="badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">⏳ Aguardando Cliente</span>';
				if (p.orcamentoStatus === 'aprovado') {
					statusBadgeHtml = '<span class="badge" style="background:#dcfce7; color:#15803d; border-color:#bbf7d0;">✅ Aprovado</span>';
				} else if (p.orcamentoStatus === 'ajuste_solicitado') {
					statusBadgeHtml = '<span class="badge" style="background:#fef3c7; color:#b45309; border-color:#fde68a;">✏️ Ajuste Solicitado</span>';
				}

				const comentarioHtml = p.orcamentoComentarioCliente
					? `<div class="orc-comment-preview">"${esc(p.orcamentoComentarioCliente)}"</div>`
					: '';

				const ipAuditoria = p.orcamentoUltimoIp || p.orcamentoAprovadoIp || '';
				const dataAuditoria = formatarDataHoraAuditoriaBR(p.orcamentoRespondidoEm || p.orcamentoAprovadoEm);
				const auditoriaHtml = (ipAuditoria || dataAuditoria)
					? `<div class="orc-audit-chip" title="Registro de resposta do cliente">${ipAuditoria ? `🌐 IP: ${esc(ipAuditoria)}` : '🕒 Resposta'}${dataAuditoria ? ` • ${esc(dataAuditoria)}` : ''}</div>`
					: '';

				const qtdHistorico = Array.isArray(p.orcamentoHistorico) ? p.orcamentoHistorico.length : 0;
				const historicoLinkHtml = `
					<div>
						<button type="button" class="orc-history-link-btn" onclick="window.abrirHistoricoOrcamento('${p.id}')" title="Ver linha do tempo completa de mensagens, edições e IP">
							📜 Histórico (${qtdHistorico})
						</button>
					</div>
				`;

				tr.innerHTML = `
					<td>${renderizarIdentificacaoOS(p, isLavaJato, 30)}</td>
					<td>
						<strong>${esc(p.cliente || 'Não identificado')}</strong>
						${p.operadorNome ? `<small style="display:block; color:var(--text-muted);">👤 Resp: ${esc(p.operadorNome)}</small>` : ''}
					</td>
					<td>
						<div>${esc(dataFmt)}</div>
						<small style="color:var(--text-muted);">${p.horaEntrada ? esc(p.horaEntrada) : ''}</small>
					</td>
					<td>
						<div>${esc(p.servicos || '-')}</div>
						${p.produtosVendidos && p.produtosVendidos.length > 0 ? `
							<div style="margin-top:4px;">
								<span class="badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-size:0.75rem;">
									🛍️ ${p.produtosVendidos.map(pv => `${pv.quantidade || 1}x ${esc(pv.nome)}`).join(', ')}
								</span>
							</div>
						` : ''}
					</td>
					<td><span class="badge-price">R$ ${valorFormatado}</span></td>
					<td>
						${statusBadgeHtml}
						${comentarioHtml}
						${auditoriaHtml}
						${historicoLinkHtml}
					</td>
					<td style="text-align: center;">
						<div class="btn-action-group" style="flex-wrap:wrap; justify-content:center;">
							<button type="button" class="btn btn-sm" onclick="window.gerarECopiarLinkOrcamento('${p.id}')" style="background:#2563eb; color:#fff; font-weight:600;" title="Gerar ou renovar link público e copiar para enviar ao cliente">
								🔗 ${p.orcamentoPublicoUrl ? 'Copiar Link' : 'Gerar Link'}
							</button>
							<button type="button" class="btn btn-sm" onclick="window.enviarOrcamentoWhatsApp('${p.id}')" style="background:#16a34a; color:#fff; font-weight:600;" title="Enviar link de aprovação no WhatsApp">
								💬 WhatsApp
							</button>
							<button type="button" class="btn btn-sm" onclick="window.abrirModalEditarOrcamento('${p.id}')" style="background:#7c3aed; color:#fff; font-weight:600;" title="Editar serviços, produtos, valor e observações do orçamento">
								✏️ Editar
							</button>
							<button type="button" class="btn btn-sm btn-secondary" onclick="window.abrirHistoricoOrcamento('${p.id}')" title="Ver histórico de edições, mensagens e IPs">
								📜 Histórico
							</button>
							<button type="button" class="btn btn-sm" onclick="window.aprovarManualOrcamento('${p.id}')" style="background:#0f766e; color:#fff; font-weight:600;" title="Aprovar orçamento manualmente e mover para o Pátio">
								✅ Abrir Pátio
							</button>
							<button type="button" class="btn btn-sm btn-secondary btn-cancelar-os" data-id="${p.id}" style="color: var(--danger);" title="Excluir Orçamento">
								🗑️
							</button>
						</div>
					</td>
				`;
				corpoTabelaOrcamentos.appendChild(tr);
			});
		}
	}

	// Renderizar Encerrados
	corpoTabelaEncerrados.innerHTML = '';
	if (pedidosEncerrados.length === 0) {
		corpoTabelaEncerrados.innerHTML = `
			<tr>
				<td colspan="7" class="empty-table-message">
					Nenhuma ordem de serviço encerrada ainda.
				</td>
			</tr>
		`;
	} else {
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		[...pedidosEncerrados].reverse().forEach((p) => {
			const tr = document.createElement('tr');
			const valorFormatado = parseFloat(p.valor || 0).toFixed(2);
			const dataSaidaBruta = p.dataEncerramento || p.data || '';
			const dataSaida = window.DateBR ? (window.DateBR.formatarParaBR(dataSaidaBruta) || '-') : (dataSaidaBruta || '-');
			const horaSaida = p.horaEncerramento ? ` às ${esc(p.horaEncerramento)}` : '';
			const possuiHistoricoOrc = Boolean(
				(Array.isArray(p.orcamentoHistorico) && p.orcamentoHistorico.length > 0) ||
				p.orcamentoAprovadoIp ||
				p.orcamentoUltimoIp ||
				p.orcamentoToken
			);
			const dataAprovLink = formatarDataHoraAuditoriaBR(p.orcamentoAprovadoEm || p.aprovadoViaLinkEm || p.orcamentoRespondidoEm);

			tr.innerHTML = `
				<td>
					${renderizarIdentificacaoOS(p, isLavaJato, 30)}
				</td>
				<td><strong>${esc(p.cliente || 'Não identificado')}</strong></td>
				<td>
					<div>${esc(dataSaida)}</div>
					<small style="color:var(--text-muted);">${horaSaida}</small>
				</td>
				<td>
					<div>${esc(p.servicos || '-')}</div>
					${p.produtosVendidos && p.produtosVendidos.length > 0 ? `
						<div style="margin-top:4px;">
							<span class="badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-size:0.75rem;">
								🛍️ ${p.produtosVendidos.map(pv => `${pv.quantidade || 1}x ${esc(pv.nome)}`).join(', ')}
							</span>
						</div>
					` : ''}
				</td>
				<td><span class="badge-price">R$ ${valorFormatado}</span></td>
				<td>
					<span class="badge badge-payment">${esc(p.formaPagamento || 'Outro')}</span>
					${p.formaPagamento === 'Faturado / A Receber' ? `
						<div style="margin-top:4px;">
							<span class="badge" style="font-size:0.72rem; ${p.statusFaturamento === 'pago' ? 'background:#dcfce7; color:#15803d; border-color:#bbf7d0;' : 'background:#fef3c7; color:#b45309; border-color:#fde68a;'}">
								${p.statusFaturamento === 'pago' ? '✅ Fatura Quitada' : '⏳ A Receber'}
							</span>
						</div>
					` : ''}
					${p.orcamentoAprovadoIp ? `
						<div class="orc-audit-chip" title="Aprovação registrada pelo cliente via link">
							✅ IP: ${esc(p.orcamentoAprovadoIp)}${dataAprovLink ? ` • ${esc(dataAprovLink)}` : ''}
						</div>
					` : ''}
					${p.pacoteAbatido ? `
						<div style="margin-top:4px;">
							<span class="badge" style="font-size:0.72rem; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">
								🎟️ ${esc(p.pacoteNome || 'Pacote')}
							</span>
						</div>
					` : ''}
				</td>
				<td style="text-align: center;">
					<div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;">
						<button type="button" class="btn btn-sm btn-recibo-os" data-id="${p.id}" onclick="abrirModalRecibo('${p.id}')" title="Ver e Imprimir Recibo Estilo Cupom Fiscal">
							🧾 Recibo
						</button>
						${possuiHistoricoOrc ? `
							<button type="button" class="btn btn-sm btn-secondary" onclick="window.abrirHistoricoOrcamento('${p.id}')" title="Ver histórico e IP de aprovação do orçamento">
								📜 Hist.
							</button>
						` : ''}
						<button type="button" class="btn btn-sm btn-secondary btn-cancelar-os" data-id="${p.id}" style="color: var(--danger);" title="Excluir Registro">
							🗑️
						</button>
					</div>
				</td>
			`;
			corpoTabelaEncerrados.appendChild(tr);
		});
	}

	// Vincular eventos de Visualizar/Imprimir Recibo
	document.querySelectorAll('.btn-recibo-os').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const osId = e.currentTarget.getAttribute('data-id');
			abrirModalRecibo(osId);
		});
	});

	// Vincular eventos de Receber & Encerrar via Event Delegation
	document.querySelectorAll('.btn-receber-os').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const osId = e.currentTarget.getAttribute('data-id');
			abrirModalEncerramento(osId);
		});
	});

	// Vincular eventos de Cancelar/Excluir
	document.querySelectorAll('.btn-cancelar-os').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const osId = e.currentTarget.getAttribute('data-id');
			const todosPedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
			const p = todosPedidos.find((item) => String(item.id) === String(osId));
			if (!p) return;

			let confirmado = false;
			const itemIdentificador = isLavaJato ? `placa "${p.placa || 'Sem placa'}"` : `item "${p.itemDescricao || 'Serviço'}"`;
			if (window.UI) {
				confirmado = await window.UI.confirm({
					title: 'Cancelar O.S.',
					message: `Deseja realmente remover o registro da O.S. de ${itemIdentificador} (${p.cliente})?`,
					confirmText: 'Sim, Remover O.S.',
					danger: true,
					icon: '🗑️'
				});
			} else {
				confirmado = confirm(`Deseja realmente remover o registro da O.S. de ${itemIdentificador} (${p.cliente})?`);
			}

			if (confirmado) {
				let creditoEstornado = false;
				if (p.status !== 'encerrado' && p.pacoteAbatido && p.pacoteAssinaturaId && typeof PacotesService !== 'undefined' && typeof PacotesService.estornarCredito === 'function') {
					const estRes = PacotesService.estornarCredito({
						assinaturaId: p.pacoteAssinaturaId,
						pedidoId: p.id
					});
					creditoEstornado = Boolean(estRes && estRes.estornado);
				}
				const atualizados = todosPedidos.filter((item) => String(item.id) !== String(osId));
				localStorage.setItem('pedidos', JSON.stringify(atualizados));
				if (window.UI) {
					window.UI.toast(
						creditoEstornado
							? 'Ordem de serviço removida e 1 crédito estornado para o pacote do cliente.'
							: 'Ordem de serviço removida.',
						'info'
					);
				}
				renderizarTabelas();
				sincronizarPainelTvSeguro(atualizados);
			}
		});
	});
}

// Modal de Encerramento e Pagamento
function abrirModalEncerramento(osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find((item) => String(item.id) === String(osId));
	if (!p) {
		console.warn('O.S. não encontrada para encerramento:', osId);
		return;
	}

	pedidoSelecionadoParaEncerrar = p;
	const isLavaJato = isSegmentoLavaJato();

	if (modalTitulo) {
		modalTitulo.textContent = isLavaJato 
			? `Receber O.S. - Placa ${p.placa || 'S/P'}`
			: `Receber Pagamento - ${p.cliente || 'Cliente'}`;
	}

	if (modalDetalhesVeiculo) {
		if (isLavaJato) {
			const corObj = obterCorVeiculo(p.cor);
			modalDetalhesVeiculo.innerHTML = `
				${renderizarIconeCarro(corObj, 28, p.veiculoTipo)}
				<div>
					<strong class="badge-placa">${p.placa}</strong> 
					<span style="font-size:0.85rem; color:var(--text-muted); margin-left:6px;">${corObj.nome} ${p.modelo ? '• ' + p.modelo : ''}</span>
				</div>
			`;
		} else {
			const itemNome = p.itemDescricao || p.modelo || 'Atendimento / Serviço';
			const fotoFinal = p.foto || '';
			modalDetalhesVeiculo.innerHTML = `
				${fotoFinal ? `<div class="os-foto-thumbnail" style="background-image: url('${fotoFinal}'); width:36px; height:36px;"></div>` : '📋'}
				<div>
					<strong style="font-size: 0.95rem; color: var(--text-main);">${itemNome}</strong>
				</div>
			`;
		}
	}

	if (modalDetalhesCliente) {
		const dataEntradaFmt = window.DateBR ? (window.DateBR.formatarParaBR(p.data) || p.data || '-') : (p.data || '-');
		modalDetalhesCliente.innerHTML = `👤 Cliente: <strong>${p.cliente}</strong> (Entrada: ${dataEntradaFmt} às ${p.horaEntrada || '--:--'})`;
	}

	if (modalDetalhesServicos) {
		modalDetalhesServicos.innerHTML = `🛠️ Serviços: <strong>${p.servicos}</strong>`;
	}

	// Inicializa produtos vinculados a esta OS no fechamento
	produtosFechamentoAtuais = [];
	if (p.produtosVendidos && Array.isArray(p.produtosVendidos)) {
		produtosFechamentoAtuais = JSON.parse(JSON.stringify(p.produtosVendidos));
	}

	popularSelectProdutosBalcao();
	renderizarProdutosFechamento();

	if (modalValorFinal) {
		modalValorFinal.value = parseFloat(p.valor || 0).toFixed(2);
	}

	if (modalFormaPagamento) {
		modalFormaPagamento.value = (p.pacoteAbatido && parseFloat(p.valor || 0) <= 0) ? 'Pacote / Crédito' : 'Pix';
	}

	// Pacotes ativos do cliente (ou pacote já utilizado na entrada da O.S.)
	const blocoPacote = document.getElementById('blocoPacoteAtivoEncerramento');
	const chkPacote = document.getElementById('chkAbaterPacoteOS');
	const selectPacote = document.getElementById('modalSelectPacoteAtivo');
	const infoPacote = document.getElementById('infoPacoteAtivoEncerramento');
	if (blocoPacote && chkPacote && selectPacote) {
		const escPkg = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		if (p.pacoteAbatido) {
			blocoPacote.style.display = 'block';
			chkPacote.checked = true;
			chkPacote.disabled = true;
			selectPacote.disabled = true;
			selectPacote.onchange = null;
			selectPacote.innerHTML = `<option value="${escPkg(p.pacoteAssinaturaId || '')}">${escPkg(p.pacoteNome || 'Pacote')} — 1 crédito já utilizado na abertura</option>`;
			if (infoPacote) {
				infoPacote.textContent = 'Crédito já abatido na abertura desta O.S. (não será descontado novamente). Cobre apenas extras ou produtos adicionados.';
			}
		} else {
			chkPacote.disabled = false;
			selectPacote.disabled = false;
			chkPacote.checked = false;
			let pacotesAtivos = [];
			if (typeof PacotesService !== 'undefined') {
				const chaveBusca = p.clienteId || p.cliente || '';
				pacotesAtivos = PacotesService.getAssinaturasAtivasCliente(chaveBusca);
				if (pacotesAtivos.length === 0 && p.cliente) {
					pacotesAtivos = PacotesService.getAssinaturasAtivasCliente(p.cliente);
				}
			}

			if (pacotesAtivos.length > 0) {
				blocoPacote.style.display = 'block';
				const placaAtual = (p.placa || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
				selectPacote.innerHTML = pacotesAtivos.map(a => {
					const validadeFmt = window.DateBR ? window.DateBR.formatarParaBR(a.dataValidade) : a.dataValidade;
					const placasAut = isLavaJato && Array.isArray(a.placasAutorizadas) ? a.placasAutorizadas : [];
					let sufixoPlaca = '';
					if (placasAut.length > 0) {
						const compativel = placaAtual && placasAut.includes(placaAtual);
						sufixoPlaca = compativel
							? ` • Placa ${placaAtual} OK`
							: ` • Placas: ${placasAut.join(', ')}`;
					}
					return `<option value="${escPkg(a.id)}">${escPkg(a.planoNome)} (${a.creditosRestantes}/${a.creditosTotais} créditos • Válido até ${escPkg(validadeFmt)}${escPkg(sufixoPlaca)})</option>`;
				}).join('');

				const atualizarAvisoPacote = () => {
					if (!infoPacote) return;
					const pacoteSel = pacotesAtivos.find(a => String(a.id) === String(selectPacote.value)) || pacotesAtivos[0];
					const inclusos = obterServicosInclusosPacoteEntrada(pacoteSel);
					const placasRestritas = isLavaJato && Array.isArray(pacoteSel?.placasAutorizadas) ? pacoteSel.placasAutorizadas : [];
					const partes = [];
					if (placasRestritas.length > 0 && placaAtual && !placasRestritas.includes(placaAtual)) {
						partes.push(`Atenção: pacote vinculado às placas ${placasRestritas.join(', ')} (O.S. atual: ${placaAtual}).`);
					}
					if (inclusos.length > 0) {
						partes.push(`Serviço(s) coberto(s) zerado(s): ${inclusos.join(', ')} (extras e produtos permanecem somados).`);
					} else {
						partes.push('Ao marcar, o valor dos serviços desta O.S. será zerado e 1 crédito será descontado do pacote selecionado.');
					}
					infoPacote.textContent = partes.join(' ');
				};
				selectPacote.onchange = () => {
					atualizarAvisoPacote();
					const chkP = document.getElementById('chkAbaterPacoteOS');
					if (chkP && chkP.checked) {
						chkP.dispatchEvent(new Event('change'));
					}
				};
				atualizarAvisoPacote();
			} else {
				blocoPacote.style.display = 'none';
				selectPacote.innerHTML = '';
				selectPacote.onchange = null;
			}
		}
	}

	atualizarPreviewPixEncerramento();

	if (modalEncerramento) {
		modalEncerramento.classList.add('open');
		modalEncerramento.style.display = 'flex';
	}
}

function atualizarPreviewPixEncerramento() {
	if (!blocoPixEncerramento) return;

	const forma = modalFormaPagamento ? modalFormaPagamento.value : '';
	const valorNum = modalValorFinal ? (parseFloat(modalValorFinal.value) || 0) : 0;

	if (forma !== 'Pix') {
		blocoPixEncerramento.style.display = 'none';
		blocoPixEncerramento.innerHTML = '';
		return;
	}

	blocoPixEncerramento.style.display = 'block';

	if (typeof PixService === 'undefined') {
		blocoPixEncerramento.innerHTML = '<small style="color:var(--text-muted);">Serviço PIX indisponível.</small>';
		return;
	}

	const resPix = PixService.gerarCobrancaPixOS(pedidoSelecionadoParaEncerrar || {}, valorNum);
	if (!resPix.valido) {
		blocoPixEncerramento.innerHTML = `
			<div style="font-size:0.84rem; color:var(--text-muted);">
				🔑 Nenhuma Chave PIX cadastrada ainda.
				<a href="configuracoes.html?aba=negocio" style="color:var(--primary); font-weight:700; text-decoration:underline; margin-left:4px;">Configurar Chave PIX</a>
			</div>
		`;
		return;
	}

	if (valorNum <= 0) {
		blocoPixEncerramento.innerHTML = '<small style="color:var(--text-muted);">Informe um valor maior que R$ 0,00 para gerar o QR Code PIX.</small>';
		return;
	}

	const qrSvg = PixService.gerarSVG(resPix.payload, { size: 148, margin: 2 });
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	blocoPixEncerramento.innerHTML = `
		<div style="font-size:0.86rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">
			📱 QR Code PIX para Pagamento (R$ ${valorNum.toFixed(2)})
		</div>
		<div style="display:inline-block; background:#fff; padding:6px; border:1px solid var(--border-color); border-radius:8px; box-shadow:var(--shadow-sm);">
			${qrSvg}
		</div>
		<div style="font-size:0.78rem; color:var(--text-muted); margin-top:6px;">
			Chave: <strong>${esc(resPix.chaveNormalizada)}</strong> &bull; ${esc(resPix.nomeRecebedor)}
		</div>
		<div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-top:10px;">
			<button type="button" id="btnEnviarPixWppEncerramento" class="btn btn-sm" style="background:#0d9488; color:#ffffff; font-weight:700;">
				📲 Enviar QR Code no WhatsApp
			</button>
			<button type="button" id="btnBaixarPixEncerramento" class="btn btn-sm btn-secondary">
				📥 Baixar QR (PNG)
			</button>
			<button type="button" id="btnCopiarPixEncerramento" class="btn btn-sm btn-secondary">
				📋 Copiar Copia e Cola
			</button>
		</div>
	`;

	const btnEnviarWppPix = document.getElementById('btnEnviarPixWppEncerramento');
	if (btnEnviarWppPix) {
		btnEnviarWppPix.addEventListener('click', async () => {
			const ped = pedidoSelecionadoParaEncerrar || {};
			const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliObj = clientes.find(c => c.nome && ped.cliente && c.nome.trim().toLowerCase() === ped.cliente.trim().toLowerCase());
			const telLimpo = cliObj && cliObj.tel1 ? cliObj.tel1 : '';
			const valorFmt = valorNum.toFixed(2).replace('.', ',');
			const msg = `Olá ${ped.cliente || 'Cliente'}! Segue o QR Code PIX no valor de R$ ${valorFmt} referente ao atendimento (${ped.modelo || ped.itemDescricao || 'Serviço'}${ped.placa ? ' - ' + ped.placa : ''}).`;

			try {
				const shareRes = await PixService.compartilharCartaoPix(ped, {
					valor: valorNum,
					title: `QR Code PIX - R$ ${valorFmt}`,
					text: msg
				});
				if (shareRes && shareRes.sucesso) {
					if (window.UI) window.UI.toast('QR Code PIX compartilhado!', 'success');
					return;
				}
			} catch (errShare) {
				if (errShare && errShare.name === 'AbortError') return;
			}

			let copiou = false;
			try {
				const clipRes = await PixService.copiarCartaoPixClipboard(ped, { valor: valorNum });
				copiou = Boolean(clipRes && clipRes.sucesso);
			} catch (e) {
				copiou = false;
			}
			if (!copiou) {
				try { await PixService.baixarCartaoPix(ped, { valor: valorNum }); } catch (e) {}
			}
			if (typeof WhatsAppService !== 'undefined') {
				WhatsAppService.abrirWhatsApp(telLimpo, msg, { preservarClipboard: copiou });
			} else {
				const telDigits = (telLimpo || '').replace(/\D/g, '').replace(/^0+/, '');
				const telWpp = telDigits.length >= 10 && telDigits.length <= 11 && !telDigits.startsWith('55') ? '55' + telDigits : telDigits;
				const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
				const canalSalvo = localStorage.getItem('whatsapp_canal_preferido');
				const baseUrl = (isDesktop && canalSalvo === 'web') ? 'https://web.whatsapp.com/send' : 'https://api.whatsapp.com/send';
				window.open(telWpp ? `${baseUrl}?phone=${telWpp}&text=${encodeURIComponent(msg)}` : `${baseUrl}?text=${encodeURIComponent(msg)}`, '_blank');
			}
			if (window.UI) {
				window.UI.toast(
					copiou
						? 'QR Code copiado! Cole (Ctrl+V) na conversa do WhatsApp.'
						: 'QR Code baixado em PNG! Anexe a imagem no WhatsApp.',
					'info'
				);
			}
		});
	}

	const btnBaixarPix = document.getElementById('btnBaixarPixEncerramento');
	if (btnBaixarPix) {
		btnBaixarPix.addEventListener('click', async () => {
			try {
				await PixService.baixarCartaoPix(pedidoSelecionadoParaEncerrar || {}, { valor: valorNum });
				if (window.UI) window.UI.toast('Cartão QR Code PIX baixado em PNG!', 'success');
			} catch (e) {
				if (window.UI) window.UI.toast('Erro ao gerar imagem do QR Code.', 'warning');
			}
		});
	}

	const btnCopiar = document.getElementById('btnCopiarPixEncerramento');
	if (btnCopiar) {
		btnCopiar.addEventListener('click', () => {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(resPix.payload).then(() => {
					if (window.UI) window.UI.toast('Código PIX Copia e Cola copiado!', 'success');
					btnCopiar.textContent = '✅ Código Copiado!';
					setTimeout(() => { btnCopiar.textContent = '📋 Copiar Copia e Cola'; }, 2000);
				}).catch(() => {});
			}
		});
	}
}

if (modalFormaPagamento) {
	modalFormaPagamento.addEventListener('change', atualizarPreviewPixEncerramento);
}
if (modalValorFinal) {
	modalValorFinal.addEventListener('input', atualizarPreviewPixEncerramento);
}

function obterDetalheServicosPedido(pedido) {
	if (!pedido) return [];
	if (Array.isArray(pedido.servicosDetalhe) && pedido.servicosDetalhe.length > 0) {
		return pedido.servicosDetalhe.map((s) => ({
			nome: String(s?.nome || '').trim(),
			preco: Math.max(0, parseFloat(s?.preco || 0) || 0)
		})).filter((s) => s.nome);
	}
	const catalogo = JSON.parse(localStorage.getItem('servicos')) || [];
	const nomes = String(pedido.servicos || '').split(',').map((x) => x.trim()).filter(Boolean);
	return nomes.map((nome) => {
		const match = catalogo.find((s) => s && s.nome && s.nome.trim().toLowerCase() === nome.toLowerCase());
		return {
			nome,
			preco: match ? Math.max(0, parseFloat(match.preco || 0) || 0) : 0
		};
	});
}

const chkAbaterPacoteOSEl = document.getElementById('chkAbaterPacoteOS');
if (chkAbaterPacoteOSEl) {
	chkAbaterPacoteOSEl.addEventListener('change', () => {
		if (!pedidoSelecionadoParaEncerrar || pedidoSelecionadoParaEncerrar.pacoteAbatido) return;
		const subtotalProdutos = (produtosFechamentoAtuais || []).reduce(
			(acc, item) => acc + ((parseFloat(item.quantidade || 1) || 1) * (parseFloat(item.precoUnitario || item.preco || 0) || 0)),
			0
		);

		if (chkAbaterPacoteOSEl.checked) {
			const selectPacote = document.getElementById('modalSelectPacoteAtivo');
			const assinaturaId = selectPacote ? selectPacote.value : '';
			const assinatura = typeof PacotesService !== 'undefined'
				? PacotesService.getAssinaturas().find((a) => String(a.id) === String(assinaturaId))
				: null;
			const inclusos = obterServicosInclusosPacoteEntrada(assinatura);
			let valorServicosRestantes = 0;

			if (typeof PacotesService !== 'undefined' && typeof PacotesService.calcularAbatimentoServicos === 'function') {
				const detalheServicos = obterDetalheServicosPedido(pedidoSelecionadoParaEncerrar);
				if (detalheServicos.length > 0) {
					const abat = PacotesService.calcularAbatimentoServicos(detalheServicos, inclusos);
					valorServicosRestantes = abat.valorServicosRestantes;
				}
			}

			const valorComDesconto = Math.max(0, valorServicosRestantes + subtotalProdutos);
			if (modalValorFinal) modalValorFinal.value = valorComDesconto.toFixed(2);
			if (modalFormaPagamento) {
				modalFormaPagamento.value = valorComDesconto > 0 ? 'Pix' : 'Pacote / Crédito';
			}
		} else {
			const valorOriginalOS = parseFloat(pedidoSelecionadoParaEncerrar.valor || 0) || 0;
			const produtosIniciais = Array.isArray(pedidoSelecionadoParaEncerrar.produtosVendidos)
				? pedidoSelecionadoParaEncerrar.produtosVendidos.reduce((acc, item) => acc + ((parseFloat(item.quantidade || 1) || 1) * (parseFloat(item.precoUnitario || item.preco || 0) || 0)), 0)
				: 0;
			const deltaProdutos = subtotalProdutos - produtosIniciais;
			if (modalValorFinal) modalValorFinal.value = Math.max(0, valorOriginalOS + deltaProdutos).toFixed(2);
			if (modalFormaPagamento && modalFormaPagamento.value === 'Pacote / Crédito') {
				modalFormaPagamento.value = 'Pix';
			}
		}
		atualizarPreviewPixEncerramento();
	});
}

window.abrirModalEncerramento = abrirModalEncerramento;

function popularSelectProdutosBalcao() {
	if (!modalSelectProdutoBalcao || typeof EstoqueService === 'undefined') return;
	const produtosVenda = EstoqueService.getProdutosParaVenda();
	modalSelectProdutoBalcao.innerHTML = '<option value="">Selecione um produto para adicionar à O.S....</option>';
	produtosVenda.forEach(p => {
		const saldo = parseFloat(p.quantidade || 0);
		if (saldo > 0) {
			const opt = document.createElement('option');
			opt.value = p.id;
			opt.textContent = `${p.nome} - R$ ${parseFloat(p.precoVenda || 0).toFixed(2)} (Saldo: ${saldo})`;
			opt.dataset.nome = p.nome;
			opt.dataset.preco = p.precoVenda || 0;
			modalSelectProdutoBalcao.appendChild(opt);
		}
	});
}

function renderizarProdutosFechamento() {
	if (!modalListaProdutosFechamento) return;
	modalListaProdutosFechamento.innerHTML = '';

	let subtotalProdutos = 0;
	if (produtosFechamentoAtuais.length === 0) {
		modalListaProdutosFechamento.innerHTML = `
			<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">
				Nenhum produto de balcão adicionado nesta O.S.
			</span>
		`;
		if (modalResumoSubtotalProdutos) modalResumoSubtotalProdutos.textContent = '';
		return;
	}

	produtosFechamentoAtuais.forEach((item, index) => {
		const qtd = parseFloat(item.quantidade || 1);
		const preco = parseFloat(item.precoUnitario || item.preco || 0);
		const subtotal = qtd * preco;
		subtotalProdutos += subtotal;

		const div = document.createElement('div');
		div.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			background: var(--bg-input);
			padding: 6px 10px;
			border: 1px solid var(--border-color);
			border-radius: 4px;
		`;

		div.innerHTML = `
			<div>
				<strong style="color: var(--text-main); font-size: 0.82rem;">🛍️ ${item.nome}</strong>
				<span style="color: var(--success); font-size: 0.78rem; margin-left: 6px;">
					${qtd}x R$ ${preco.toFixed(2)} = <strong>R$ ${subtotal.toFixed(2)}</strong>
				</span>
			</div>
			<button type="button" class="btn btn-sm" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 1px 6px; font-size: 0.75rem; cursor: pointer;" onclick="removerProdutoFechamento(${index})" title="Remover produto da O.S.">
				✕
			</button>
		`;
		modalListaProdutosFechamento.appendChild(div);
	});

	if (modalResumoSubtotalProdutos) {
		modalResumoSubtotalProdutos.textContent = `Subtotal Produtos: R$ ${subtotalProdutos.toFixed(2)}`;
	}
}

window.removerProdutoFechamento = function(index) {
	if (index >= 0 && index < produtosFechamentoAtuais.length) {
		const itemRemovido = produtosFechamentoAtuais[index];
		const valorReduzir = parseFloat(itemRemovido.quantidade || 1) * parseFloat(itemRemovido.precoUnitario || itemRemovido.preco || 0);
		produtosFechamentoAtuais.splice(index, 1);
		if (modalValorFinal) {
			const valorAtual = parseFloat(modalValorFinal.value || 0);
			modalValorFinal.value = Math.max(0, valorAtual - valorReduzir).toFixed(2);
		}
		renderizarProdutosFechamento();
		atualizarPreviewPixEncerramento();
	}
};

if (modalBtnAddProdutoBalcao && modalSelectProdutoBalcao) {
	modalBtnAddProdutoBalcao.addEventListener('click', () => {
		const opt = modalSelectProdutoBalcao.selectedOptions[0];
		if (!opt || !opt.value) {
			if (window.UI) window.UI.toast('Selecione um produto para adicionar à O.S.', 'warning');
			else alert('Selecione um produto para adicionar à O.S.');
			return;
		}

		const id = opt.value;
		const nome = opt.dataset.nome;
		const preco = parseFloat(opt.dataset.preco || 0);

		// Se já existe na lista, apenas incrementa quantidade
		const existente = produtosFechamentoAtuais.find(p => p.id === id);
		if (existente) {
			existente.quantidade = (parseFloat(existente.quantidade || 1) + 1);
		} else {
			produtosFechamentoAtuais.push({
				id: id,
				nome: nome,
				quantidade: 1,
				precoUnitario: preco
			});
		}

		if (modalValorFinal) {
			const valorAtual = parseFloat(modalValorFinal.value || 0);
			modalValorFinal.value = (valorAtual + preco).toFixed(2);
		}

		modalSelectProdutoBalcao.value = '';
		renderizarProdutosFechamento();
		atualizarPreviewPixEncerramento();
	});
}

function fecharModalEncerramento() {
	modalEncerramento.classList.remove('open');
	pedidoSelecionadoParaEncerrar = null;
	produtosFechamentoAtuais = [];
}

if (modalFecharBtn) modalFecharBtn.addEventListener('click', fecharModalEncerramento);
if (modalCancelarBtn) modalCancelarBtn.addEventListener('click', fecharModalEncerramento);

// Submissão do Encerramento
if (formEncerramento) {
	formEncerramento.addEventListener('submit', (e) => {
		e.preventDefault();
		if (!pedidoSelecionadoParaEncerrar) return;

		const valorFinal = parseFloat(modalValorFinal.value) || 0;
		const formaPagamento = modalFormaPagamento.value;
		const hoje = obterDataHojeISO();
		const horaAtual = obterHoraAtual();

		const chkPacote = document.getElementById('chkAbaterPacoteOS');
		const selectPacote = document.getElementById('modalSelectPacoteAtivo');
		const usarPacote = Boolean(!pedidoSelecionadoParaEncerrar.pacoteAbatido && chkPacote && chkPacote.checked && selectPacote && selectPacote.value);

		let resPacote = null;
		if (usarPacote && typeof PacotesService !== 'undefined') {
			resPacote = PacotesService.consumirCredito({
				assinaturaId: selectPacote.value,
				pedidoId: pedidoSelecionadoParaEncerrar.id,
				cliente: pedidoSelecionadoParaEncerrar.cliente,
				placa: pedidoSelecionadoParaEncerrar.placa,
				modelo: pedidoSelecionadoParaEncerrar.modelo,
				itemDescricao: pedidoSelecionadoParaEncerrar.itemDescricao || '',
				servicos: pedidoSelecionadoParaEncerrar.servicos,
				operador: pedidoSelecionadoParaEncerrar.operadorNome || ''
			});
			if (!resPacote || !resPacote.sucesso) {
				if (window.UI) window.UI.toast((resPacote && resPacote.erro) || 'Não foi possível abater do pacote.', 'warning');
				return;
			}
		}

		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const index = pedidos.findIndex((item) => item.id === pedidoSelecionadoParaEncerrar.id);

		let pedidoEncerradoFinal = null;

		if (index !== -1) {
			pedidos[index].status = 'encerrado';
			pedidos[index].valor = valorFinal;
			pedidos[index].formaPagamento = formaPagamento;
			pedidos[index].dataEncerramento = hoje;
			pedidos[index].horaEncerramento = horaAtual;
			pedidos[index].produtosVendidos = produtosFechamentoAtuais;

			if (formaPagamento === 'Faturado / A Receber') {
				pedidos[index].statusFaturamento = 'pendente';
			} else {
				delete pedidos[index].statusFaturamento;
			}

			if (usarPacote && resPacote && resPacote.assinatura) {
				pedidos[index].pacoteAbatido = true;
				pedidos[index].pacoteAssinaturaId = resPacote.assinatura.id;
				pedidos[index].pacoteNome = resPacote.assinatura.planoNome;
				pedidos[index].pacoteCreditosRestantes = resPacote.creditosRestantes;
			}

			// Dá baixa automática no estoque para os produtos vendidos
			if (typeof EstoqueService !== 'undefined' && produtosFechamentoAtuais.length > 0) {
				EstoqueService.darBaixaEstoqueVenda(produtosFechamentoAtuais);
			}

			pedidoEncerradoFinal = pedidos[index];
			localStorage.setItem('pedidos', JSON.stringify(pedidos));

			if (usarPacote && resPacote && resPacote.assinatura && window.UI) {
				window.UI.toast(`Crédito abatido! Restam ${resPacote.creditosRestantes} crédito(s) no pacote.`, 'success');
			}
		}

		const deveImprimirRecibo = !modalCheckImprimirRecibo || modalCheckImprimirRecibo.checked;

		fecharModalEncerramento();
		renderizarTabelas();
		sincronizarPainelTvSeguro();

		// Alterna para a aba de encerrados para feedback imediato
		if (tabEncerradosBtn) tabEncerradosBtn.click();

		// Abre imediatamente o recibo / cupom fiscal para visualização e impressão
		if (pedidoEncerradoFinal && deveImprimirRecibo) {
			abrirModalRecibo(pedidoEncerradoFinal.id);
		}
	});
}

// Funções de Abertura, Visualização e Impressão do Recibo Cupom Fiscal
function abrirModalRecibo(osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find((item) => item.id === osId);
	if (!p) return;

	pedidoSelecionadoParaRecibo = p;

	const numOS = (p.id || '').replace(/^os_/, '').slice(-6) || '000001';
	if (modalReciboTitulo) {
		modalReciboTitulo.textContent = `Recibo / Cupom Fiscal - O.S. #${numOS}`;
	}

	if (modalReciboConteudo && typeof ReciboService !== 'undefined') {
		modalReciboConteudo.innerHTML = ReciboService.gerarCupomHTML(p);
	}

	if (modalRecibo) {
		modalRecibo.classList.add('open');
	}
}

function fecharModalRecibo() {
	if (modalRecibo) {
		modalRecibo.classList.remove('open');
	}
	pedidoSelecionadoParaRecibo = null;
}

if (modalReciboFecharBtn) modalReciboFecharBtn.addEventListener('click', fecharModalRecibo);
if (modalReciboFecharInferiorBtn) modalReciboFecharInferiorBtn.addEventListener('click', fecharModalRecibo);

if (modalReciboImprimirBtn) {
	modalReciboImprimirBtn.addEventListener('click', () => {
		if (pedidoSelecionadoParaRecibo && typeof ReciboService !== 'undefined') {
			ReciboService.imprimirCupom(pedidoSelecionadoParaRecibo);
		}
	});
}

if (modalReciboBaixarBtn) {
	modalReciboBaixarBtn.addEventListener('click', async () => {
		if (pedidoSelecionadoParaRecibo && typeof ReciboService !== 'undefined') {
			const textoOriginal = modalReciboBaixarBtn.innerHTML;
			modalReciboBaixarBtn.innerHTML = '⏳ Gerando...';
			modalReciboBaixarBtn.disabled = true;
			try {
				await ReciboService.baixarImagemRecibo(pedidoSelecionadoParaRecibo);
			} finally {
				modalReciboBaixarBtn.innerHTML = textoOriginal;
				modalReciboBaixarBtn.disabled = false;
			}
		}
	});
}

function popularSelectOperadores() {
	if (!pedidoOperador || typeof EquipeService === 'undefined') return;
	const membros = EquipeService.getMembros();
	pedidoOperador.innerHTML = '<option value="">Selecione quem executará o serviço...</option>';
	membros.forEach((m) => {
		const opt = document.createElement('option');
		opt.value = m.id;
		opt.textContent = `${m.nome} (${m.cargo || 'Lavador'})`;
		pedidoOperador.appendChild(opt);
	});
}

// Formulário de Entrada do Veículo (Abrir O.S. ou Orçamento Digital)
if (pedidoForm) {
	pedidoForm.addEventListener('submit', (e) => {
		e.preventDefault();

		if (window.SaasGuard && typeof window.SaasGuard.bloquearSeSuspenso === 'function') {
			if (!window.SaasGuard.bloquearSeSuspenso('abrir nova O.S. ou orçamento')) {
				return;
			}
		}

		const isLavaJato = isSegmentoLavaJato();
		const estagioSelectEl = document.getElementById('pedidoEstagioInicial');
		const estagioInicial = estagioSelectEl && estagioSelectEl.value === 'orcamento' ? 'orcamento' : 'aberto';
		const clienteNome = pedidoCliente.value.trim();
		const tipoRaw = isLavaJato && pedidoVeiculoTipo ? pedidoVeiculoTipo.value : 'carro';
		const veiculoTipo = typeof normalizarTipoVeiculo === 'function'
			? normalizarTipoVeiculo(tipoRaw)
			: (tipoRaw === 'moto' ? 'moto' : (tipoRaw === 'caminhao' ? 'caminhao' : 'carro'));
		const placa = isLavaJato ? pedidoPlaca.value.trim().toUpperCase() : '';
		const cor = isLavaJato ? pedidoCor.value : 'prata';
		const modelo = isLavaJato ? pedidoModelo.value.trim() : '';
		const itemDescricao = !isLavaJato && pedidoItemDescricao ? pedidoItemDescricao.value.trim() : '';
		const fotoOS = fotoOSBase64Atual || '';
		const valor = parseFloat(pedidoValor.value) || 0;
		const rawData = pedidoData ? pedidoData.value.trim() : '';
		let data = rawData
			? (window.DateBR ? window.DateBR.converterBRParaISO(rawData) : rawData)
			: obterDataHojeISO();
		if (rawData && !data) {
			if (window.UI) window.UI.toast('Informe uma Data de Chegada válida no formato dd/mm/aaaa.', 'warning');
			if (pedidoData) pedidoData.focus();
			return;
		}

		if (isLavaJato && !placa) {
			if (window.UI) window.UI.toast('Por favor, informe a placa do veículo.', 'warning');
			else alert('Por favor, informe a placa do veículo.');
			if (pedidoPlaca) pedidoPlaca.focus();
			return;
		}

		const operadorId = pedidoOperador ? pedidoOperador.value : '';
		let operadorNome = '';
		if (operadorId && typeof EquipeService !== 'undefined') {
			const m = EquipeService.getMembros().find(x => x.id === operadorId);
			if (m) operadorNome = m.nome;
		}

		const servicosSelecionados = Array.from(pedidoServico.selectedOptions)
			.filter((o) => !o.disabled)
			.map((o) => o.value);

		if (servicosSelecionados.length === 0) {
			if (window.UI) window.UI.toast('Por favor, selecione ao menos um serviço para o atendimento.', 'warning');
			else alert('Por favor, selecione ao menos um serviço para o atendimento.');
			return;
		}

		// Se o cliente ainda não estiver cadastrado na base de clientes, salvamos com foto/veículo se aplicável
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const clienteIndex = clientes.findIndex((c) => c.nome.toLowerCase() === clienteNome.toLowerCase());
		if (clienteIndex === -1 && clienteNome) {
			const veiculosIniciais = (isLavaJato && placa)
				? [{
					id: `veh_${Date.now()}`,
					tipo: veiculoTipo,
					placa,
					modelo: modelo || 'Não informado',
					cor: cor || 'prata'
				}]
				: [];
			clientes.push({
				nome: clienteNome,
				tel1: '',
				wpp1: '❌',
				tel2: '',
				wpp2: '❌',
				endereco: '',
				foto: fotoOS,
				veiculos: veiculosIniciais
			});
			localStorage.setItem('clientes', JSON.stringify(clientes));
		} else if (clienteIndex !== -1 && fotoOS && !clientes[clienteIndex].foto) {
			clientes[clienteIndex].foto = fotoOS;
			localStorage.setItem('clientes', JSON.stringify(clientes));
		}

		const osId = 'os_' + Date.now();

		const chkUsarPacoteEntrada = document.getElementById('chkUsarPacoteEntrada');
		const selectPacoteEntrada = document.getElementById('entradaSelectPacoteAtivo');
		const usarPacoteNaEntrada = Boolean(
			estagioInicial === 'aberto' &&
			chkUsarPacoteEntrada &&
			chkUsarPacoteEntrada.checked &&
			selectPacoteEntrada &&
			selectPacoteEntrada.value &&
			typeof PacotesService !== 'undefined'
		);

		let resPacoteEntrada = null;
		if (usarPacoteNaEntrada) {
			resPacoteEntrada = PacotesService.consumirCredito({
				assinaturaId: selectPacoteEntrada.value,
				pedidoId: osId,
				cliente: clienteNome,
				placa: placa || (isLavaJato ? 'SEM PLACA' : ''),
				modelo: modelo,
				itemDescricao: itemDescricao || modelo,
				servicos: servicosSelecionados.join(', '),
				operador: operadorNome
			});
			if (!resPacoteEntrada || !resPacoteEntrada.sucesso) {
				if (window.UI) window.UI.toast((resPacoteEntrada && resPacoteEntrada.erro) || 'Não foi possível utilizar o pacote selecionado.', 'warning');
				return;
			}
		}

		// Salva checklist de vistoria
		if (typeof VistoriaService !== 'undefined') {
			VistoriaService.salvarVistoria(osId, {
				pertences: vistoriaPertences ? vistoriaPertences.checked : true,
				avarias: vistoriaAvarias ? vistoriaAvarias.checked : false,
				vidros: vistoriaVidros ? vistoriaVidros.checked : true,
				estepe: vistoriaEstepe ? vistoriaEstepe.checked : true,
				observacoes: vistoriaObs ? vistoriaObs.value.trim() : ''
			});
		}

		// Coleta produtos comerciais selecionados na entrada
		const produtosEntradaSelecionados = [];
		const checksVenda = document.querySelectorAll('.check-produto-venda:checked');
		checksVenda.forEach(chk => {
			produtosEntradaSelecionados.push({
				id: chk.dataset.id,
				nome: chk.dataset.nome,
				quantidade: 1,
				precoUnitario: parseFloat(chk.dataset.preco || 0)
			});
		});

		const servicosDetalheEntrada = obterDetalheServicosSelecionadosEntrada();
		const agoraCriacaoISO = new Date().toISOString();

		const novoPedido = {
			id: osId,
			cliente: clienteNome,
			veiculoTipo: veiculoTipo,
			placa: placa || (isLavaJato ? 'SEM PLACA' : ''),
			cor: cor,
			modelo: modelo,
			itemDescricao: itemDescricao || modelo,
			foto: fotoOS,
			servicos: servicosSelecionados.join(', '),
			servicosDetalhe: servicosDetalheEntrada,
			produtosVendidos: produtosEntradaSelecionados,
			operadorId: operadorId,
			operadorNome: operadorNome,
			data: data,
			horaEntrada: obterHoraAtual(),
			valor: valor,
			status: estagioInicial,
			statusTV: estagioInicial === 'aberto' ? 'em_servico' : '',
			orcamentoStatus: estagioInicial === 'orcamento' ? 'pendente' : '',
			formaPagamento: '',
			dataEncerramento: '',
			horaEncerramento: '',
			criadoEm: agoraCriacaoISO
		};

		if (estagioInicial === 'orcamento') {
			const itensIniciais = [];
			if (novoPedido.servicos) itensIniciais.push(`Serviços: ${novoPedido.servicos}`);
			if (produtosEntradaSelecionados.length > 0) {
				itensIniciais.push(`Produtos: ${produtosEntradaSelecionados.map((pv) => `${pv.quantidade || 1}x ${pv.nome}`).join(', ')}`);
			}
			const obsVist = vistoriaObs ? vistoriaObs.value.trim() : '';
			if (obsVist) itensIniciais.push(`Obs./Vistoria: ${obsVist}`);

			registrarEventoHistoricoPedidoSeguro(novoPedido, {
				tipo: 'criado',
				dataHora: agoraCriacaoISO,
				autor: operadorNome || obterOperadorLogadoNome(),
				titulo: 'Orçamento criado no sistema',
				alteracoes: itensIniciais,
				valorNovo: Number(valor || 0)
			});
		}

		if (usarPacoteNaEntrada && resPacoteEntrada && resPacoteEntrada.assinatura) {
			novoPedido.pacoteAbatido = true;
			novoPedido.pacoteAbatidoNaEntrada = true;
			novoPedido.pacoteAssinaturaId = resPacoteEntrada.assinatura.id;
			novoPedido.pacoteNome = resPacoteEntrada.assinatura.planoNome;
			novoPedido.pacoteCreditosRestantes = resPacoteEntrada.creditosRestantes;
			novoPedido.pacoteServicosInclusos = obterServicosInclusosPacoteEntrada(resPacoteEntrada.assinatura);
		}

		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		pedidos.push(novoPedido);
		localStorage.setItem('pedidos', JSON.stringify(pedidos));

		// Limpa formulário
		pedidoForm.reset();
		if (estagioSelectEl) estagioSelectEl.value = 'aberto';
		clienteSelecionadoOS = null;
		veiculoSelecionadoId = null;
		atualizarPainelVeiculosClienteOS(null);
		atualizarPainelPacotesEntrada(null);
		if (pedidoVeiculoTipo) pedidoVeiculoTipo.value = 'carro';
		setOSFotoPreview('');
		if (pedidoData) {
			if (window.DateBR) window.DateBR.setInputISO(pedidoData, obterDataHojeISO());
			else pedidoData.value = obterDataHojeISO();
		}
		popularCoresVeiculo();
		popularSelectOperadores();
		carregarProdutosVendaEntrada();
		renderizarTabelas();
		if (estagioInicial === 'aberto') {
			sincronizarPainelTvSeguro(pedidos);
		}

		if (window.UI) {
			if (estagioInicial === 'orcamento') {
				window.UI.toast('Orçamento salvo! Clique em "Gerar Link" ou "WhatsApp" na aba Orçamentos.', 'success');
			} else {
				window.UI.toast(
					usarPacoteNaEntrada && resPacoteEntrada
						? `O.S. aberta com 1 crédito abatido do pacote! Restam ${resPacoteEntrada.creditosRestantes} crédito(s).`
						: 'Ordem de Serviço aberta com sucesso!',
					'success'
				);
			}
		}

		ativarAbaPedidos(estagioInicial === 'orcamento' ? 'orcamentos' : 'patio');
	});
}

// Configura campos do formulário de acordo com o segmento
function configurarCamposSegmento() {
	const isLavaJato = isSegmentoLavaJato();

	if (blocoCamposLavaJato) {
		blocoCamposLavaJato.style.display = isLavaJato ? 'contents' : 'none';
	}
	if (blocoCamposOutroSegmento) {
		blocoCamposOutroSegmento.style.display = isLavaJato ? 'none' : 'block';
	}

	// Ajusta obrigatoriedade da placa
	if (pedidoPlaca) {
		pedidoPlaca.required = isLavaJato;
	}
	if (pedidoCor) {
		pedidoCor.required = isLavaJato;
	}

	// Ajusta textos de botões e cartões
	const btnDarEntradaOS = document.getElementById('btnDarEntradaOS');
	if (btnDarEntradaOS) {
		btnDarEntradaOS.innerHTML = isLavaJato 
			? '🚗 Dar Entrada do Carro (Abrir O.S.)' 
			: '📋 Abrir Ordem de Serviço';
	}

	const contentCardTitleOS = document.querySelector('#pedidoForm')?.closest('.content-card')?.querySelector('.content-card-title span');
	if (contentCardTitleOS) {
		contentCardTitleOS.textContent = isLavaJato 
			? '🚗 Entrada de Veículo (Abrir O.S.)' 
			: '📋 Nova Ordem de Serviço & Atendimento';
	}

	const tabPatioEl = document.getElementById('tabPatioBtn');
	if (tabPatioEl) {
		const countSpan = document.getElementById('countPatio');
		const countVal = countSpan ? countSpan.textContent : '0';
		tabPatioEl.innerHTML = isLavaJato 
			? `🚗 Carros no Pátio / Em Andamento <span class="tab-count" id="countPatio">${countVal}</span>` 
			: `📋 Atendimentos em Andamento <span class="tab-count" id="countPatio">${countVal}</span>`;
	}

	const estagioOptAberto = document.querySelector('#pedidoEstagioInicial option[value="aberto"]');
	if (estagioOptAberto) {
		estagioOptAberto.textContent = isLavaJato
			? '🚗 Abrir direto no Pátio (Em Serviço)'
			: '📋 Abrir direto em Atendimento (Em Serviço)';
	}
}

// Integração Fase 3: Painel TV e Orçamentos Digitais Aprováveis
function atualizarLinksPainelTV() {
	const linkEl = document.getElementById('linkAbrirPainelTV');
	if (linkEl && window.PublicoService && typeof window.PublicoService.obterLinkPainelTv === 'function') {
		linkEl.href = window.PublicoService.obterLinkPainelTv();
	}
}

function sincronizarPainelTvSeguro(pedidosOverride = null) {
	if (window.PublicoService && typeof window.PublicoService.publicarPainelTv === 'function') {
		window.PublicoService.publicarPainelTv(pedidosOverride).catch((err) => {
			console.warn('Falha ao publicar Painel TV no Firestore:', err?.message || err);
		});
	}
}

function iniciarSincronizacaoOrcamentosSeguro() {
	if (window.PublicoService && typeof window.PublicoService.iniciarSincronizacaoOrcamentos === 'function') {
		window.PublicoService.iniciarSincronizacaoOrcamentos((pedidoSync, novoStatus) => {
			renderizarTabelas();
			if (novoStatus === 'aprovado') {
				sincronizarPainelTvSeguro();
				if (window.UI) {
					window.UI.toast(`✅ Orçamento de ${pedidoSync.cliente} aprovado pelo cliente e movido para o Pátio!`, 'success', 5000);
				}
			} else if (novoStatus === 'ajuste_solicitado') {
				if (window.UI) {
					window.UI.toast(`✏️ ${pedidoSync.cliente} solicitou ajuste no orçamento.`, 'warning', 5000);
				}
			}
		});
	}
}

window.alternarStatusTVPedido = function (osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const idx = pedidos.findIndex((p) => String(p.id) === String(osId));
	if (idx === -1) return;

	const novoStatusTV = pedidos[idx].statusTV === 'pronto' ? 'em_servico' : 'pronto';
	pedidos[idx].statusTV = novoStatusTV;
	localStorage.setItem('pedidos', JSON.stringify(pedidos));

	renderizarTabelas();
	sincronizarPainelTvSeguro(pedidos);

	if (window.UI) {
		window.UI.toast(
			novoStatusTV === 'pronto'
				? 'Painel TV atualizado: atendimento marcado como PRONTO.'
				: 'Painel TV atualizado: atendimento voltou para EM SERVIÇO.',
			'info'
		);
	}
};

window.gerarECopiarLinkOrcamento = async function (osId) {
	if (!window.PublicoService || typeof window.PublicoService.publicarOrcamentoPublico !== 'function') {
		if (window.UI) window.UI.toast('Serviço público de orçamento ainda carregando. Tente novamente em instantes.', 'warning');
		return null;
	}

	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const idx = pedidos.findIndex((p) => String(p.id) === String(osId));
	if (idx === -1) return null;

	try {
		garantirHistoricoInicialPedidoSeguro(pedidos[idx]);
		const jaTinhaLink = Boolean(pedidos[idx].orcamentoToken);

		const res = await window.PublicoService.publicarOrcamentoPublico(pedidos[idx]);
		pedidos[idx].orcamentoToken = res.token;
		pedidos[idx].orcamentoPublicoUrl = res.url;
		pedidos[idx].orcamentoStatus = 'pendente';
		pedidos[idx].orcamentoComentarioCliente = '';

		registrarEventoHistoricoPedidoSeguro(pedidos[idx], {
			tipo: 'link_gerado',
			dataHora: new Date().toISOString(),
			autor: obterOperadorLogadoNome(),
			titulo: jaTinhaLink ? 'Novo link de orçamento gerado (anterior substituído)' : 'Link público de aprovação gerado',
			token: res.token,
			valorNovo: Number(pedidos[idx].valor || 0) || 0
		});

		localStorage.setItem('pedidos', JSON.stringify(pedidos));

		renderizarTabelas();
		iniciarSincronizacaoOrcamentosSeguro();

		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(res.url).catch(() => {});
		}
		if (window.UI) {
			window.UI.toast('🔗 Link do orçamento gerado e copiado para a área de transferência!', 'success', 4500);
		}
		return res.url;
	} catch (err) {
		console.error('Erro ao publicar orçamento:', err);
		if (window.UI) window.UI.toast('Erro ao gerar link do orçamento. Verifique a conexão.', 'error');
		return null;
	}
};

window.enviarOrcamentoWhatsApp = async function (osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find((item) => String(item.id) === String(osId));
	if (!p) return;

	let url = p.orcamentoPublicoUrl;
	if (!url) {
		url = await window.gerarECopiarLinkOrcamento(osId);
		if (!url) return;
	}

	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	const cliObj = clientes.find((c) => c.nome && p.cliente && c.nome.trim().toLowerCase() === p.cliente.trim().toLowerCase());
	const telLimpo = cliObj && cliObj.tel1 ? cliObj.tel1 : '';
	const cfg = (typeof BrandService !== 'undefined' && typeof BrandService.getConfig === 'function')
		? BrandService.getConfig()
		: {};
	const nomeEmpresa = cfg.nomeEstabelecimento || 'nosso estabelecimento';
	const valorFmt = (parseFloat(p.valor || 0) || 0).toFixed(2).replace('.', ',');
	const itemDesc = isSegmentoLavaJato()
		? `${p.modelo || 'Veículo'}${p.placa ? ' (' + p.placa + ')' : ''}`
		: (p.itemDescricao || p.servicos || 'Atendimento');

	const msg = `Olá ${p.cliente || 'Cliente'}! Segue o orçamento digital de ${nomeEmpresa} para ${itemDesc}, no valor previsto de R$ ${valorFmt}.\n\nConfira os detalhes e aprove ou solicite ajustes pelo link:\n${url}`;

	if (typeof WhatsAppService !== 'undefined' && typeof WhatsAppService.abrirWhatsApp === 'function') {
		WhatsAppService.abrirWhatsApp(telLimpo, msg);
	} else {
		let fone = (telLimpo || '').replace(/\D/g, '').replace(/^0+/, '');
		if (fone && !fone.startsWith('55') && fone.length <= 11) fone = `55${fone}`;
		const baseUrl = 'https://api.whatsapp.com/send';
		const linkWpp = fone ? `${baseUrl}?phone=${fone}&text=${encodeURIComponent(msg)}` : `${baseUrl}?text=${encodeURIComponent(msg)}`;
		window.open(linkWpp, '_blank', 'noopener,noreferrer');
	}
};

window.aprovarManualOrcamento = function (osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const idx = pedidos.findIndex((p) => String(p.id) === String(osId));
	if (idx === -1) return;

	garantirHistoricoInicialPedidoSeguro(pedidos[idx]);
	const agoraISO = new Date().toISOString();

	pedidos[idx].status = 'aberto';
	pedidos[idx].statusTV = pedidos[idx].statusTV || 'em_servico';
	pedidos[idx].orcamentoStatus = 'aprovado';
	pedidos[idx].orcamentoRespondidoEm = agoraISO;
	pedidos[idx].orcamentoAprovadoEm = agoraISO;

	registrarEventoHistoricoPedidoSeguro(pedidos[idx], {
		tipo: 'aprovado_manual',
		dataHora: agoraISO,
		autor: obterOperadorLogadoNome(),
		titulo: 'Orçamento aprovado manualmente e movido para o Pátio',
		valorNovo: Number(pedidos[idx].valor || 0) || 0
	});

	localStorage.setItem('pedidos', JSON.stringify(pedidos));

	renderizarTabelas();
	sincronizarPainelTvSeguro(pedidos);
	ativarAbaPedidos('patio');

	if (window.UI) {
		window.UI.toast(`O.S. de ${pedidos[idx].cliente} movida para o Pátio!`, 'success');
	}
};

// ==========================================================================
// Modais: Edição de Orçamento & Histórico / Auditoria
// ==========================================================================
let editOrcamentoIdAtual = null;
let editOrcamentoProdutosAtuais = [];

function fecharModalEditarOrcamento() {
	const modal = document.getElementById('modalEditarOrcamento');
	if (modal) modal.classList.remove('open');
	editOrcamentoIdAtual = null;
	editOrcamentoProdutosAtuais = [];
}

function calcularSomaEditOrcamento() {
	const selServicos = document.getElementById('editOrcamentoServicos');
	const totalServicos = selServicos
		? Array.from(selServicos.selectedOptions).reduce((acc, opt) => acc + (parseFloat(opt.dataset.preco || 0) || 0), 0)
		: 0;
	const totalProdutos = editOrcamentoProdutosAtuais.reduce(
		(acc, p) => acc + (Math.max(1, Number(p.quantidade || 1)) * (Number(p.precoUnitario || 0) || 0)),
		0
	);
	return Math.max(0, Math.round((totalServicos + totalProdutos) * 100) / 100);
}

function atualizarValorEditOrcamentoSePermitido(forcar = false) {
	const inputValor = document.getElementById('editOrcamentoValor');
	if (!inputValor) return;
	if (!forcar && inputValor.dataset.manualOverride === 'true') return;
	inputValor.value = calcularSomaEditOrcamento().toFixed(2);
}

function renderizarProdutosEditOrcamento() {
	const listaEl = document.getElementById('editOrcamentoListaProdutos');
	const subEl = document.getElementById('editOrcamentoSubtotalProdutos');
	if (!listaEl) return;

	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
	const subtotal = editOrcamentoProdutosAtuais.reduce(
		(acc, p) => acc + (Math.max(1, Number(p.quantidade || 1)) * (Number(p.precoUnitario || 0) || 0)),
		0
	);
	if (subEl) {
		subEl.textContent = editOrcamentoProdutosAtuais.length > 0
			? `Subtotal: R$ ${subtotal.toFixed(2)}`
			: 'Nenhum produto incluído';
	}

	if (editOrcamentoProdutosAtuais.length === 0) {
		listaEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:4px 0;">Nenhum produto comercial adicionado a este orçamento.</div>';
		return;
	}

	listaEl.innerHTML = editOrcamentoProdutosAtuais.map((item, idx) => {
		const qtd = Math.max(1, Number(item.quantidade || 1));
		const unit = Number(item.precoUnitario || 0) || 0;
		return `
			<div class="orc-edit-produto-item">
				<div style="min-width:0; flex:1;">
					<strong style="color:var(--text-main);">${esc(item.nome)}</strong>
					<div style="font-size:0.75rem; color:var(--text-muted);">R$ ${unit.toFixed(2)} un. • Sub: R$ ${(qtd * unit).toFixed(2)}</div>
				</div>
				<div class="orc-edit-produto-qty">
					<button type="button" class="btn btn-secondary btn-sm" onclick="window.alterarQtdProdutoEditOrcamento(${idx}, -1)" style="padding:2px 8px;">-</button>
					<span style="min-width:20px; text-align:center; font-weight:700;">${qtd}</span>
					<button type="button" class="btn btn-secondary btn-sm" onclick="window.alterarQtdProdutoEditOrcamento(${idx}, 1)" style="padding:2px 8px;">+</button>
					<button type="button" class="btn btn-secondary btn-sm" onclick="window.removerProdutoEditOrcamento(${idx})" style="padding:2px 8px; color:var(--danger);" title="Remover produto">🗑️</button>
				</div>
			</div>
		`;
	}).join('');
}

window.alterarQtdProdutoEditOrcamento = function (idx, delta) {
	if (!editOrcamentoProdutosAtuais[idx]) return;
	const novaQtd = (Number(editOrcamentoProdutosAtuais[idx].quantidade || 1) || 1) + delta;
	if (novaQtd <= 0) {
		editOrcamentoProdutosAtuais.splice(idx, 1);
	} else {
		editOrcamentoProdutosAtuais[idx].quantidade = novaQtd;
	}
	renderizarProdutosEditOrcamento();
	atualizarValorEditOrcamentoSePermitido(false);
};

window.removerProdutoEditOrcamento = function (idx) {
	if (!editOrcamentoProdutosAtuais[idx]) return;
	editOrcamentoProdutosAtuais.splice(idx, 1);
	renderizarProdutosEditOrcamento();
	atualizarValorEditOrcamentoSePermitido(false);
};

window.abrirModalEditarOrcamento = function (osId) {
	if (window.SaasGuard && typeof window.SaasGuard.bloquearSeSuspenso === 'function') {
		if (!window.SaasGuard.bloquearSeSuspenso('editar orçamento')) return;
	}

	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find((item) => String(item.id) === String(osId));
	if (!p) return;

	if (p.status !== 'orcamento') {
		if (window.UI) window.UI.toast('Apenas propostas na aba Orçamentos podem ser editadas por este modal.', 'warning');
		return;
	}

	editOrcamentoIdAtual = p.id;
	editOrcamentoProdutosAtuais = Array.isArray(p.produtosVendidos)
		? p.produtosVendidos.map((pv) => ({ ...pv }))
		: [];

	const modal = document.getElementById('modalEditarOrcamento');
	const resumoTopo = document.getElementById('editOrcamentoResumoTopo');
	const grupoAuto = document.getElementById('editOrcamentoGrupoAuto');
	const grupoOutro = document.getElementById('editOrcamentoGrupoOutro');
	const inputPlaca = document.getElementById('editOrcamentoPlaca');
	const inputModelo = document.getElementById('editOrcamentoModelo');
	const inputItemDesc = document.getElementById('editOrcamentoItemDesc');
	const inputData = document.getElementById('editOrcamentoData');
	const selOperador = document.getElementById('editOrcamentoOperador');
	const selServicos = document.getElementById('editOrcamentoServicos');
	const selProduto = document.getElementById('editOrcamentoSelectProduto');
	const inputValor = document.getElementById('editOrcamentoValor');
	const inputVistoriaObs = document.getElementById('editOrcamentoVistoriaObs');
	const inputMotivo = document.getElementById('editOrcamentoMotivo');
	const chkRenovar = document.getElementById('editOrcamentoRenovarLink');

	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
	const isAuto = isSegmentoLavaJato();
	if (grupoAuto) grupoAuto.style.display = isAuto ? 'contents' : 'none';
	if (grupoOutro) grupoOutro.style.display = isAuto ? 'none' : 'block';

	if (resumoTopo) {
		resumoTopo.innerHTML = `
			<div><strong>Cliente:</strong> ${esc(p.cliente || 'Não identificado')}</div>
			<div style="font-size:0.8rem; color:var(--text-muted);">OS #${esc(p.id)}</div>
		`;
	}

	if (inputPlaca) inputPlaca.value = p.placa || '';
	if (inputModelo) inputModelo.value = p.modelo || '';
	if (inputItemDesc) inputItemDesc.value = p.itemDescricao || p.modelo || '';

	if (inputData) {
		if (window.DateBR && typeof window.DateBR.setInputISO === 'function') {
			window.DateBR.setInputISO(inputData, p.data || obterDataHojeISO());
		} else {
			inputData.value = p.data || obterDataHojeISO();
		}
	}

	if (selOperador) {
		selOperador.innerHTML = '<option value="">Sem responsável definido</option>';
		const membros = (typeof window.EquipeService !== 'undefined' && typeof window.EquipeService.getMembros === 'function')
			? window.EquipeService.getMembros()
			: [];
		membros.forEach((m) => {
			if (!m || m.ativo === false) return;
			const opt = document.createElement('option');
			opt.value = m.id;
			opt.textContent = m.nome;
			if (p.operadorId && String(p.operadorId) === String(m.id)) opt.selected = true;
			selOperador.appendChild(opt);
		});
	}

	if (selServicos) {
		const catalogo = JSON.parse(localStorage.getItem('servicos')) || [];
		const nomesAtuais = Array.isArray(p.servicosDetalhe) && p.servicosDetalhe.length > 0
			? p.servicosDetalhe.map((s) => String(s.nome || '').trim().toLowerCase()).filter(Boolean)
			: String(p.servicos || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

		selServicos.innerHTML = '';
		const nomesCatalogoSet = new Set();
		catalogo.forEach((s) => {
			if (!s || !s.nome) return;
			const opt = document.createElement('option');
			opt.value = s.nome;
			opt.dataset.preco = String(Number(s.preco || 0) || 0);
			opt.textContent = `${s.nome} (R$ ${(Number(s.preco || 0) || 0).toFixed(2)})`;
			const lower = s.nome.trim().toLowerCase();
			nomesCatalogoSet.add(lower);
			if (nomesAtuais.includes(lower)) opt.selected = true;
			selServicos.appendChild(opt);
		});

		if (Array.isArray(p.servicosDetalhe)) {
			p.servicosDetalhe.forEach((sd) => {
				if (!sd || !sd.nome) return;
				const lower = sd.nome.trim().toLowerCase();
				if (!nomesCatalogoSet.has(lower)) {
					const opt = document.createElement('option');
					opt.value = sd.nome;
					opt.dataset.preco = String(Number(sd.preco || 0) || 0);
					opt.textContent = `${sd.nome} (R$ ${(Number(sd.preco || 0) || 0).toFixed(2)})`;
					opt.selected = true;
					selServicos.appendChild(opt);
				}
			});
		}
	}

	if (selProduto) {
		selProduto.innerHTML = '<option value="">Adicionar produto comercial ao orçamento...</option>';
		const produtosVenda = (typeof window.EstoqueService !== 'undefined' && typeof window.EstoqueService.getProdutosParaVenda === 'function')
			? window.EstoqueService.getProdutosParaVenda()
			: [];
		produtosVenda.forEach((pv) => {
			const opt = document.createElement('option');
			opt.value = pv.id;
			opt.dataset.nome = pv.nome;
			opt.dataset.preco = String(parseFloat(pv.precoVenda || 0) || 0);
			opt.textContent = `${pv.nome} — R$ ${(parseFloat(pv.precoVenda || 0) || 0).toFixed(2)}`;
			selProduto.appendChild(opt);
		});
	}

	renderizarProdutosEditOrcamento();

	if (inputValor) {
		const valorAtualNum = Number(p.valor || 0) || 0;
		const somaCalculada = calcularSomaEditOrcamento();
		inputValor.value = valorAtualNum.toFixed(2);
		inputValor.dataset.manualOverride = Math.abs(valorAtualNum - somaCalculada) > 0.01 ? 'true' : 'false';
	}

	if (inputVistoriaObs) {
		const vAtual = (typeof window.VistoriaService !== 'undefined' && typeof window.VistoriaService.getVistoriaPorPedidoId === 'function')
			? window.VistoriaService.getVistoriaPorPedidoId(p.id)
			: null;
		inputVistoriaObs.value = (vAtual && vAtual.observacoes) ? vAtual.observacoes : '';
	}

	if (inputMotivo) {
		inputMotivo.value = '';
	}
	if (chkRenovar) {
		chkRenovar.checked = Boolean(p.orcamentoToken || p.orcamentoPublicoUrl);
	}

	if (modal) modal.classList.add('open');
};

function fecharModalHistoricoOrcamento() {
	const modal = document.getElementById('modalHistoricoOrcamento');
	if (modal) modal.classList.remove('open');
}

window.abrirHistoricoOrcamento = function (osId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find((item) => String(item.id) === String(osId));
	if (!p) return;

	const copia = JSON.parse(JSON.stringify(p));
	garantirHistoricoInicialPedidoSeguro(copia);

	const modal = document.getElementById('modalHistoricoOrcamento');
	const cabEl = document.getElementById('historicoOrcamentoCabecalho');
	const timeEl = document.getElementById('historicoOrcamentoTimeline');
	const btnEditar = document.getElementById('btnIrParaEditarDoHistorico');
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	const isAuto = isSegmentoLavaJato();
	const ident = isAuto
		? `${p.placa || 'SEM PLACA'}${p.modelo ? ' • ' + p.modelo : ''}`
		: (p.itemDescricao || p.modelo || 'Atendimento');

	const statusMap = {
		pendente: '⏳ Aguardando Cliente',
		ajuste_solicitado: '✏️ Ajuste Solicitado',
		aprovado: '✅ Aprovado'
	};
	const statusTxt = statusMap[p.orcamentoStatus] || (p.status === 'orcamento' ? '⏳ Aguardando Cliente' : '✅ Aprovado');
	const aprovIp = p.orcamentoAprovadoIp || '';
	const aprovDt = formatarDataHoraAuditoriaBR(p.orcamentoAprovadoEm || p.aprovadoViaLinkEm);
	const ultIp = p.orcamentoUltimoIp || '';
	const ultDt = formatarDataHoraAuditoriaBR(p.orcamentoRespondidoEm);

	if (cabEl) {
		cabEl.innerHTML = `
			<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
				<div>
					<strong style="font-size:0.96rem; color:var(--text-main);">${esc(p.cliente || 'Cliente')}</strong>
					<span style="color:var(--text-muted); font-size:0.84rem;"> • ${esc(ident)}</span>
				</div>
				<span class="badge-price">R$ ${(parseFloat(p.valor || 0) || 0).toFixed(2)}</span>
			</div>
			<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:0.8rem; color:var(--text-muted);">
				<span><strong>Status:</strong> ${esc(statusTxt)}</span>
				${aprovIp ? `<span class="orc-event-ip">✅ Aprovação • IP: ${esc(aprovIp)}${aprovDt ? ` • ${esc(aprovDt)}` : ''}</span>` : ''}
				${(!aprovIp && ultIp) ? `<span class="orc-event-ip">🌐 Último IP: ${esc(ultIp)}${ultDt ? ` • ${esc(ultDt)}` : ''}</span>` : ''}
			</div>
		`;
	}

	const eventos = Array.isArray(copia.orcamentoHistorico) ? [...copia.orcamentoHistorico].reverse() : [];
	if (timeEl) {
		if (eventos.length === 0) {
			timeEl.innerHTML = '<div style="font-size:0.88rem; color:var(--text-muted);">Nenhum evento registrado ainda neste orçamento.</div>';
		} else {
			const icones = {
				criado: '📝',
				link_gerado: '🔗',
				cliente_ajuste: '💬',
				cliente_aprovado: '✅',
				aprovado_manual: '🏁',
				editado: '✏️'
			};
			timeEl.innerHTML = eventos.map((ev) => {
				const tipo = ev.tipo || 'registro';
				const icone = icones[tipo] || '•';
				const dataFmt = formatarDataHoraAuditoriaBR(ev.dataHora);
				const diffsHtml = Array.isArray(ev.alteracoes) && ev.alteracoes.length > 0
					? `<ul class="orc-diff-list">${ev.alteracoes.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
					: '';
				const valorHtml = (ev.valorAnterior !== null && ev.valorAnterior !== undefined && ev.valorNovo !== null && ev.valorNovo !== undefined && Math.abs(ev.valorAnterior - ev.valorNovo) > 0.009)
					? `<div class="orc-event-valor-badge">💰 Valor: R$ ${Number(ev.valorAnterior).toFixed(2)} → R$ ${Number(ev.valorNovo).toFixed(2)}</div>`
					: ((ev.valorNovo !== null && ev.valorNovo !== undefined && (tipo === 'criado' || tipo === 'cliente_aprovado' || tipo === 'aprovado_manual'))
						? `<div class="orc-event-valor-badge">💰 Valor registrado: R$ ${Number(ev.valorNovo).toFixed(2)}</div>`
						: '');

				return `
					<div class="orc-timeline-item">
						<span class="orc-timeline-dot tipo-${esc(tipo)}"></span>
						<div class="orc-event-card">
							<div class="orc-event-header">
								<span class="orc-event-title">${icone} ${esc(ev.titulo || 'Evento')}</span>
								<span class="orc-event-date">${esc(dataFmt)}</span>
							</div>
							<div class="orc-event-meta">
								<span>👤 ${esc(ev.autor || 'Sistema')}</span>
								${ev.ip ? `<span class="orc-event-ip">🌐 IP: ${esc(ev.ip)}</span>` : ''}
								${ev.token ? `<span style="font-family:var(--font-mono); font-size:0.7rem;">🔑 ${esc(ev.token.slice(0, 10))}…</span>` : ''}
							</div>
							${ev.comentario ? `<div class="orc-event-comment">"${esc(ev.comentario)}"</div>` : ''}
							${diffsHtml}
							${valorHtml}
						</div>
					</div>
				`;
			}).join('');
		}
	}

	if (btnEditar) {
		btnEditar.style.display = p.status === 'orcamento' ? 'inline-flex' : 'none';
		btnEditar.onclick = () => {
			fecharModalHistoricoOrcamento();
			window.abrirModalEditarOrcamento(p.id);
		};
	}

	if (modal) modal.classList.add('open');
};

(function inicializarEventosModaisOrcamento() {
	const btnFecharEd = document.getElementById('btnFecharModalEditarOrcamento');
	const btnCancelarEd = document.getElementById('btnCancelarEditarOrcamento');
	const formEditar = document.getElementById('formEditarOrcamento');
	const selServicosEd = document.getElementById('editOrcamentoServicos');
	const inputValorEd = document.getElementById('editOrcamentoValor');
	const btnRecalc = document.getElementById('btnRecalcularValorEditOrcamento');
	const btnAddProd = document.getElementById('btnAddProdutoEditOrcamento');
	const selProdEd = document.getElementById('editOrcamentoSelectProduto');

	const btnFecharHist = document.getElementById('btnFecharModalHistoricoOrcamento');
	const btnFecharHistInf = document.getElementById('btnFecharInferiorHistorico');

	if (btnFecharEd) btnFecharEd.addEventListener('click', fecharModalEditarOrcamento);
	if (btnCancelarEd) btnCancelarEd.addEventListener('click', fecharModalEditarOrcamento);
	if (btnFecharHist) btnFecharHist.addEventListener('click', fecharModalHistoricoOrcamento);
	if (btnFecharHistInf) btnFecharHistInf.addEventListener('click', fecharModalHistoricoOrcamento);

	if (inputValorEd) {
		inputValorEd.addEventListener('input', () => {
			inputValorEd.dataset.manualOverride = 'true';
		});
	}
	if (selServicosEd) {
		selServicosEd.addEventListener('change', () => {
			atualizarValorEditOrcamentoSePermitido(false);
		});
	}
	if (btnRecalc) {
		btnRecalc.addEventListener('click', () => {
			if (inputValorEd) inputValorEd.dataset.manualOverride = 'false';
			atualizarValorEditOrcamentoSePermitido(true);
		});
	}
	if (btnAddProd && selProdEd) {
		btnAddProd.addEventListener('click', () => {
			const opt = selProdEd.selectedOptions[0];
			if (!opt || !opt.value) {
				if (window.UI) window.UI.toast('Selecione um produto para incluir no orçamento.', 'warning');
				return;
			}
			const id = opt.value;
			const nome = opt.dataset.nome || opt.textContent;
			const preco = parseFloat(opt.dataset.preco || 0) || 0;
			const existente = editOrcamentoProdutosAtuais.find((item) => String(item.id) === String(id));
			if (existente) {
				existente.quantidade = (Number(existente.quantidade || 1) || 1) + 1;
			} else {
				editOrcamentoProdutosAtuais.push({ id, nome, quantidade: 1, precoUnitario: preco });
			}
			selProdEd.value = '';
			renderizarProdutosEditOrcamento();
			atualizarValorEditOrcamentoSePermitido(false);
		});
	}

	if (formEditar) {
		formEditar.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (!editOrcamentoIdAtual) return;
			if (window.SaasGuard && typeof window.SaasGuard.bloquearSeSuspenso === 'function') {
				if (!window.SaasGuard.bloquearSeSuspenso('editar orçamento')) return;
			}

			const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
			const idx = pedidos.findIndex((item) => String(item.id) === String(editOrcamentoIdAtual));
			if (idx === -1) return;

			const p = pedidos[idx];
			garantirHistoricoInicialPedidoSeguro(p);

			const opcoesServicos = selServicosEd
				? Array.from(selServicosEd.selectedOptions).filter((o) => !o.disabled)
				: [];
			if (opcoesServicos.length === 0) {
				if (window.UI) window.UI.toast('Selecione ao menos um serviço no orçamento.', 'warning');
				return;
			}

			const inputData = document.getElementById('editOrcamentoData');
			const rawData = inputData ? inputData.value.trim() : '';
			const novaData = rawData
				? (window.DateBR ? window.DateBR.converterBRParaISO(rawData) : rawData)
				: (p.data || obterDataHojeISO());
			if (rawData && !novaData) {
				if (window.UI) window.UI.toast('Informe uma Data Prevista válida no formato dd/mm/aaaa.', 'warning');
				return;
			}

			const isAuto = isSegmentoLavaJato();
			const inputPlaca = document.getElementById('editOrcamentoPlaca');
			const inputModelo = document.getElementById('editOrcamentoModelo');
			const inputItemDesc = document.getElementById('editOrcamentoItemDesc');
			const selOperador = document.getElementById('editOrcamentoOperador');
			const inputVistoriaObs = document.getElementById('editOrcamentoVistoriaObs');
			const inputMotivo = document.getElementById('editOrcamentoMotivo');
			const chkRenovar = document.getElementById('editOrcamentoRenovarLink');

			const novoServicosDetalhe = opcoesServicos.map((opt) => ({
				nome: opt.value,
				preco: parseFloat(opt.dataset.preco || 0) || 0
			}));
			const novoServicosStr = novoServicosDetalhe.map((s) => s.nome).join(', ');
			const novosProdutos = editOrcamentoProdutosAtuais.map((pv) => ({ ...pv }));
			const novoValor = Math.max(0, Math.round((parseFloat(inputValorEd ? inputValorEd.value : 0) || 0) * 100) / 100);
			const novaPlaca = isAuto && inputPlaca ? (inputPlaca.value.trim().toUpperCase() || p.placa) : p.placa;
			const novoModelo = isAuto && inputModelo ? inputModelo.value.trim() : p.modelo;
			const novoItemDesc = !isAuto && inputItemDesc ? inputItemDesc.value.trim() : (isAuto ? novoModelo : p.itemDescricao);

			const novoOperadorId = selOperador ? selOperador.value : '';
			let novoOperadorNome = '';
			if (novoOperadorId && typeof window.EquipeService !== 'undefined') {
				const membro = window.EquipeService.getMembros().find((m) => String(m.id) === String(novoOperadorId));
				if (membro) novoOperadorNome = membro.nome;
			}

			const vistAnteriorObj = (typeof window.VistoriaService !== 'undefined' && typeof window.VistoriaService.getVistoriaPorPedidoId === 'function')
				? window.VistoriaService.getVistoriaPorPedidoId(p.id)
				: null;
			const obsVistAnt = vistAnteriorObj && vistAnteriorObj.observacoes ? String(vistAnteriorObj.observacoes).trim() : '';
			const obsVistNova = inputVistoriaObs ? inputVistoriaObs.value.trim() : '';

			const alteracoes = [];
			const servicosAnt = p.servicos || '-';
			if (servicosAnt !== novoServicosStr) {
				alteracoes.push(`Serviços: "${servicosAnt}" → "${novoServicosStr}"`);
			}

			const fmtProdutos = (arr) => (Array.isArray(arr) && arr.length > 0
				? arr.map((pv) => `${pv.quantidade || 1}x ${pv.nome}`).join(', ')
				: 'Nenhum');
			const prodAntStr = fmtProdutos(p.produtosVendidos);
			const prodNovoStr = fmtProdutos(novosProdutos);
			if (prodAntStr !== prodNovoStr) {
				alteracoes.push(`Produtos: "${prodAntStr}" → "${prodNovoStr}"`);
			}

			const valorAnt = Number(p.valor || 0) || 0;
			if (Math.abs(valorAnt - novoValor) > 0.009) {
				alteracoes.push(`Valor previsto: R$ ${valorAnt.toFixed(2)} → R$ ${novoValor.toFixed(2)}`);
			}

			if (isAuto) {
				if ((p.placa || '') !== (novaPlaca || '')) alteracoes.push(`Placa: ${p.placa || '-'} → ${novaPlaca || '-'}`);
				if ((p.modelo || '') !== (novoModelo || '')) alteracoes.push(`Modelo: ${p.modelo || '-'} → ${novoModelo || '-'}`);
			} else if ((p.itemDescricao || '') !== (novoItemDesc || '')) {
				alteracoes.push(`Item/Descrição: "${p.itemDescricao || '-'}" → "${novoItemDesc || '-'}"`);
			}

			if ((p.operadorNome || '') !== (novoOperadorNome || '')) {
				alteracoes.push(`Profissional: ${p.operadorNome || 'Não definido'} → ${novoOperadorNome || 'Não definido'}`);
			}

			if ((p.data || '') !== (novaData || '')) {
				const dAntFmt = window.DateBR ? (window.DateBR.formatarParaBR(p.data) || p.data) : p.data;
				const dNovFmt = window.DateBR ? (window.DateBR.formatarParaBR(novaData) || novaData) : novaData;
				alteracoes.push(`Data prevista: ${dAntFmt || '-'} → ${dNovFmt || '-'}`);
			}

			if (obsVistAnt !== obsVistNova) {
				alteracoes.push(`Observações/Vistoria: "${obsVistAnt || 'Vazio'}" → "${obsVistNova || 'Vazio'}"`);
			}

			if (typeof window.VistoriaService !== 'undefined' && (obsVistNova || vistAnteriorObj)) {
				window.VistoriaService.salvarVistoria(p.id, {
					...(vistAnteriorObj || { pertences: true, avarias: false, vidros: true, estepe: true }),
					observacoes: obsVistNova
				});
			}

			p.servicos = novoServicosStr;
			p.servicosDetalhe = novoServicosDetalhe;
			p.produtosVendidos = novosProdutos;
			p.valor = novoValor;
			p.placa = novaPlaca;
			p.modelo = novoModelo;
			p.itemDescricao = novoItemDesc;
			p.operadorId = novoOperadorId;
			p.operadorNome = novoOperadorNome;
			p.data = novaData;

			const motivoEdicao = inputMotivo ? inputMotivo.value.trim() : '';
			registrarEventoHistoricoPedidoSeguro(p, {
				tipo: 'editado',
				dataHora: new Date().toISOString(),
				autor: obterOperadorLogadoNome(),
				titulo: 'Orçamento editado pelo atendimento',
				comentario: motivoEdicao,
				alteracoes: alteracoes.length > 0 ? alteracoes : ['Proposta revisada e salva sem alterações de itens ou valores.'],
				valorAnterior: valorAnt,
				valorNovo: novoValor
			});

			localStorage.setItem('pedidos', JSON.stringify(pedidos));

			const idEditado = p.id;
			const renovarLink = Boolean(chkRenovar && chkRenovar.checked);
			fecharModalEditarOrcamento();
			renderizarTabelas();

			if (renovarLink) {
				await window.gerarECopiarLinkOrcamento(idEditado);
			} else if (window.UI) {
				window.UI.toast('✏️ Orçamento atualizado e registrado no histórico!', 'success');
			}
		});
	}
})();

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
	normalizarDadosPedidos();
	configurarCamposSegmento();
	popularCoresVeiculo();
	carregarSelectServicos();
	popularSelectOperadores();
	carregarProdutosVendaEntrada();
	renderizarTabelas();

	const btnCopiarTV = document.getElementById('btnCopiarLinkPainelTV');
	if (btnCopiarTV) {
		btnCopiarTV.addEventListener('click', () => {
			if (!window.PublicoService || typeof window.PublicoService.obterLinkPainelTv !== 'function') {
				if (window.UI) window.UI.toast('Serviço do Painel TV ainda carregando.', 'warning');
				return;
			}
			const urlTV = window.PublicoService.obterLinkPainelTv();
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(urlTV).then(() => {
					if (window.UI) {
						const emDev = typeof window !== 'undefined' && window.location && String(window.location.hostname || '').startsWith('ais-dev-');
						window.UI.toast(
							emDev
								? '🔗 Link copiado! Atenção: você está no link privado de desenvolvimento (ais-dev); para abrir em outra TV/aparelho, use a URL pública do sistema.'
								: '🔗 Link do Painel TV copiado! Abra na Smart TV ou monitor da sala de espera.',
							emDev ? 'info' : 'success',
							emDev ? 6500 : 4000
						);
					}
				}).catch(() => {});
			}
		});
	}

	atualizarLinksPainelTV();
	sincronizarPainelTvSeguro();
	iniciarSincronizacaoOrcamentosSeguro();

	// Re-sincroniza após carregamento assíncrono dos módulos ES e da nuvem
	setTimeout(() => {
		atualizarLinksPainelTV();
		sincronizarPainelTvSeguro();
		iniciarSincronizacaoOrcamentosSeguro();
	}, 900);
	setTimeout(() => {
		atualizarLinksPainelTV();
		sincronizarPainelTvSeguro();
	}, 2500);

	// Setup do seletor de fotos na O.S.
	if (btnEscolherFotoOS && osFotoInput) {
		btnEscolherFotoOS.addEventListener('click', () => {
			osFotoInput.click();
		});

		osFotoInput.addEventListener('change', async (e) => {
			const file = e.target.files && e.target.files[0];
			if (!file) return;

			try {
				const compressed = await compactarFotoOS(file);
				setOSFotoPreview(compressed);
				if (window.UI) window.UI.toast('Foto anexada à O.S.!', 'info');
			} catch (err) {
				console.error('Erro ao processar imagem:', err);
				if (window.UI) window.UI.toast('Erro ao processar foto.', 'danger');
			}
			osFotoInput.value = '';
		});
	}

	if (btnRemoverFotoOS) {
		btnRemoverFotoOS.addEventListener('click', () => {
			setOSFotoPreview('');
		});
	}
});

// Abertura do modal interativo de WhatsApp para Veículo Pronto
function abrirDisparoWhatsAppCarroPronto(pedidoId) {
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = pedidos.find(item => String(item.id) === String(pedidoId));
	if (!p) return;

	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	const cliObj = clientes.find(c => c.nome && c.nome.trim().toLowerCase() === (p.cliente || '').trim().toLowerCase());
	const telLimpo = cliObj && cliObj.tel1 ? cliObj.tel1 : '';

	const isLavaJato = isSegmentoLavaJato();
	const itemTexto = isLavaJato ? `veículo ${p.modelo || ''} (${p.placa})` : `atendimento do seu pedido (${p.itemDescricao || 'Serviço'})`;

	if (typeof WhatsAppService !== 'undefined') {
		WhatsAppService.abrirModalDisparo({
			tipo: 'pronto',
			dados: p,
			telefone: telLimpo,
			titulo: isLavaJato ? 'Avisar Conclusão & Veículo Pronto' : 'Avisar Conclusão do Serviço'
		});
	} else {
		const msgWhats = `Olá ${p.cliente}! O ${itemTexto} está pronto para retirada!`;
		let fone = (telLimpo || '').replace(/\D/g, '').replace(/^0+/, '');
		if (fone && !fone.startsWith('55') && fone.length <= 11) fone = `55${fone}`;
		const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
		const canalSalvo = localStorage.getItem('whatsapp_canal_preferido');
		const baseUrl = (isDesktop && canalSalvo === 'web') ? 'https://web.whatsapp.com/send' : 'https://api.whatsapp.com/send';
		const url = fone ? `${baseUrl}?phone=${fone}&text=${encodeURIComponent(msgWhats)}` : `${baseUrl}?text=${encodeURIComponent(msgWhats)}`;
		window.open(url, '_blank');
	}
}

window.abrirDisparoWhatsAppCarroPronto = abrirDisparoWhatsAppCarroPronto;
window.renderizarTabelaPedidos = renderizarTabelas;

window.addEventListener('cloudDataChanged', (e) => {
	const key = e.detail;
	if (key === 'config_negocio') {
		configurarCamposSegmento();
		renderizarTabelas();
		atualizarLinksPainelTV();
		sincronizarPainelTvSeguro();
	}
	if (key === 'pedidos') {
		renderizarTabelas();
		iniciarSincronizacaoOrcamentosSeguro();
		sincronizarPainelTvSeguro();
	}
	if (key === 'servicos') {
		const selecionadosAtuais = pedidoServico
			? Array.from(pedidoServico.selectedOptions).map((o) => o.value)
			: [];
		carregarSelectServicos();
		if (pedidoServico && selecionadosAtuais.length > 0) {
			Array.from(pedidoServico.options).forEach((opt) => {
				if (selecionadosAtuais.includes(opt.value)) opt.selected = true;
			});
		}
		atualizarPainelPacotesEntrada();
	}
	if (key === 'pacotes_clientes' || key === 'pacotes_planos') {
		atualizarPainelPacotesEntrada();
	}
	if (key === 'clientes' && clienteSelecionadoOS) {
		const atualizado = encontrarClientePorNome(clienteSelecionadoOS.nome);
		if (atualizado) {
			atualizarPainelVeiculosClienteOS(atualizado, false);
		}
		atualizarPainelPacotesEntrada(atualizado);
	}
});

