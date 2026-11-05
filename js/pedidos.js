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
const pedidoPlaca = document.getElementById('pedidoPlaca');
const pedidoCor = document.getElementById('pedidoCor');
const previewCorContainer = document.getElementById('previewCorContainer');
const pedidoModelo = document.getElementById('pedidoModelo');
const pedidoData = document.getElementById('pedidoData');
const pedidoOperador = document.getElementById('pedidoOperador');
const pedidoServico = document.getElementById('pedidoServico');
const pedidoValor = document.getElementById('pedidoValor');
const sugestoesDiv = document.getElementById('sugestoesClientes');

// Campos de Segmento (Lava Jato vs Outros)
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

// Verifica se o negócio atual é Lava Jato ou Outro Segmento
function isSegmentoLavaJato() {
	if (typeof BrandService !== 'undefined' && typeof BrandService.getConfig === 'function') {
		const config = BrandService.getConfig();
		return !config.tipoNegocio || config.tipoNegocio === 'lava_jato';
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
const tabEncerradosBtn = document.getElementById('tabEncerradosBtn');
const viewPatio = document.getElementById('viewPatio');
const viewEncerrados = document.getElementById('viewEncerrados');
const countPatio = document.getElementById('countPatio');
const countEncerrados = document.getElementById('countEncerrados');
const corpoTabelaPatio = document.getElementById('corpoTabelaPatio');
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
	});

	if (houveModificacao) {
		localStorage.setItem('pedidos', JSON.stringify(pedidos));
	}
}

// Popular seletor de cores do veículo
function popularCoresVeiculo() {
	if (!pedidoCor) return;
	pedidoCor.innerHTML = '';
	
	CORES_VEICULOS.forEach((c) => {
		const opt = document.createElement('option');
		opt.value = c.id;
		opt.textContent = `${c.nome}`;
		pedidoCor.appendChild(opt);
	});

	pedidoCor.addEventListener('change', atualizarPreviewCor);
	atualizarPreviewCor();
}

function atualizarPreviewCor() {
	if (!pedidoCor || !previewCorContainer) return;
	const corId = pedidoCor.value;
	const corObj = obterCorVeiculo(corId);
	previewCorContainer.innerHTML = `
		${renderizarIconeCarro(corObj, 24)}
		<small style="font-weight:600; color:var(--text-muted);">${corObj.nome}</small>
	`;
}

// Data atual padrão
if (pedidoData && !pedidoData.value) {
	pedidoData.value = obterDataHojeISO();
}

// Formatação automática da placa para maiúsculas
if (pedidoPlaca) {
	pedidoPlaca.addEventListener('input', (e) => {
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

// Cálculo automático de preço ao selecionar serviços ou produtos
function calcularValorTotalEntrada() {
	let totalServicos = 0;
	if (pedidoServico) {
		Array.from(pedidoServico.selectedOptions).forEach((opt) => {
			totalServicos += parseFloat(opt.dataset.preco) || 0;
		});
	}

	let totalProdutos = 0;
	const checks = document.querySelectorAll('.check-produto-venda:checked');
	checks.forEach(chk => {
		totalProdutos += parseFloat(chk.dataset.preco || 0);
	});

	const total = totalServicos + totalProdutos;
	if (total > 0 && pedidoValor) {
		pedidoValor.value = total.toFixed(2);
	}
}

if (pedidoServico) {
	pedidoServico.addEventListener('change', calcularValorTotalEntrada);
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
			background: #ffffff;
			padding: 8px 10px;
			border: 1px solid ${semEstoque ? '#e2e8f0' : '#bbf7d0'};
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
				<div style="font-size: 0.76rem; color: #15803d; font-weight: 700; margin-top: 2px;">
					R$ ${precoVenda.toFixed(2)} 
					<span style="color: #64748b; font-weight: normal; font-size: 0.72rem;">(Disp: ${saldo})</span>
				</div>
			</div>
		`;

		const chk = label.querySelector('.check-produto-venda');
		chk.addEventListener('change', () => {
			if (chk.checked) {
				label.style.borderColor = 'var(--primary)';
				label.style.background = '#f0fdf4';
			} else {
				label.style.borderColor = '#bbf7d0';
				label.style.background = '#ffffff';
			}
			calcularValorTotalEntrada();
		});

		gridProdutosVendaEntrada.appendChild(label);
	});
}

// Autocomplete de clientes (por Nome ou Telefone/Código)
if (pedidoCliente && sugestoesDiv) {
	pedidoCliente.addEventListener('input', () => {
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const termo = pedidoCliente.value.trim().toLowerCase();
		const termoApenasDigitos = termo.replace(/\D/g, '');
		sugestoesDiv.innerHTML = '';
		if (termo === '') return;

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
			div.innerHTML = `<strong>${c.nome}</strong>${telDestaque}`;
			div.classList.add('sugestaoItem');
			div.addEventListener('click', () => {
				pedidoCliente.value = c.nome;
				sugestoesDiv.innerHTML = '';
			});
			sugestoesDiv.appendChild(div);
		});
	});

	document.addEventListener('click', (e) => {
		if (!pedidoCliente.contains(e.target) && !sugestoesDiv.contains(e.target)) {
			sugestoesDiv.innerHTML = '';
		}
	});
}

// Alternar abas Pátio x Encerrados
if (tabPatioBtn && tabEncerradosBtn) {
	tabPatioBtn.addEventListener('click', () => {
		tabPatioBtn.classList.add('active');
		tabEncerradosBtn.classList.remove('active');
		viewPatio.style.display = 'block';
		viewEncerrados.style.display = 'none';
	});

	tabEncerradosBtn.addEventListener('click', () => {
		tabEncerradosBtn.classList.add('active');
		tabPatioBtn.classList.remove('active');
		viewPatio.style.display = 'none';
		viewEncerrados.style.display = 'block';
	});
}

// Função auxiliar para renderizar identificação da O.S. (Placa para Lava Jato OU Foto/Miniatura para outros segmentos)
function renderizarIdentificacaoOS(p, isLavaJato, tamanhoIcone = 32) {
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

	if (isLavaJato) {
		const corObj = obterCorVeiculo(p.cor);
		const modeloTexto = p.modelo ? ` • ${esc(p.modelo)}` : '';
		return `
			<div class="veiculo-info-cell">
				${renderizarIconeCarro(corObj, tamanhoIcone)}
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
	const thVeiculoEncerrados = document.getElementById('thVeiculoEncerrados');
	if (thVeiculoPatio) {
		thVeiculoPatio.textContent = isLavaJato ? 'Veículo & Placa' : 'Identificação & Foto';
	}
	if (thVeiculoEncerrados) {
		thVeiculoEncerrados.textContent = isLavaJato ? 'Veículo & Placa' : 'Identificação & Foto';
	}
	
	const pedidosPatio = pedidos.filter((p) => p.status === 'aberto');
	const pedidosEncerrados = pedidos.filter((p) => p.status === 'encerrado');

	if (countPatio) countPatio.textContent = pedidosPatio.length;
	if (countEncerrados) countEncerrados.textContent = pedidosEncerrados.length;

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

			const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
			const cliObj = clientes.find(c => c.nome && c.nome.toLowerCase() === (p.cliente || '').toLowerCase());
			const temTelefone = cliObj && cliObj.tel1;

			tr.innerHTML = `
				<td>
					${renderizarIdentificacaoOS(p, isLavaJato, 32)}
				</td>
				<td>
					<strong>${esc(p.cliente || 'Não identificado')}</strong>
					${p.operadorNome ? `<small style="display:block; color:var(--text-muted);">👤 Resp: ${esc(p.operadorNome)}</small>` : ''}
				</td>
				<td>
					<div>${esc(p.data || '-')}</div>
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
				</td>
				<td style="text-align: center;">
					<div class="btn-action-group" style="flex-wrap:wrap; justify-content:center;">
						${temTelefone ? `
							<button type="button" class="btn btn-sm" onclick="abrirDisparoWhatsAppCarroPronto('${p.id}')" style="background:#16a34a; color:#fff; display:inline-flex; align-items:center; gap:4px;" title="Avisar cliente no WhatsApp que o serviço está pronto">
								💬 ${isLavaJato ? 'Carro Pronto' : 'Avisar Pronto'}
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
			const dataSaida = p.dataEncerramento || p.data || '-';
			const horaSaida = p.horaEncerramento ? ` às ${esc(p.horaEncerramento)}` : '';

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
				</td>
				<td style="text-align: center;">
					<div style="display: inline-flex; align-items: center; gap: 6px;">
						<button type="button" class="btn btn-sm btn-recibo-os" data-id="${p.id}" onclick="abrirModalRecibo('${p.id}')" title="Ver e Imprimir Recibo Estilo Cupom Fiscal">
							🧾 Recibo
						</button>
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
				const atualizados = todosPedidos.filter((item) => String(item.id) !== String(osId));
				localStorage.setItem('pedidos', JSON.stringify(atualizados));
				if (window.UI) window.UI.toast('Ordem de serviço removida.', 'info');
				renderizarTabelas();
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
				${renderizarIconeCarro(corObj, 28)}
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
		modalDetalhesCliente.innerHTML = `👤 Cliente: <strong>${p.cliente}</strong> (Entrada: ${p.data} às ${p.horaEntrada || '--:--'})`;
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
		modalFormaPagamento.value = 'Pix';
	}

	if (modalEncerramento) {
		modalEncerramento.classList.add('open');
		modalEncerramento.style.display = 'flex';
	}
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
			<span style="color: #64748b; font-size: 0.8rem; font-style: italic;">
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
			background: #ffffff;
			padding: 6px 10px;
			border: 1px solid #cbd5e1;
			border-radius: 4px;
		`;

		div.innerHTML = `
			<div>
				<strong style="color: var(--text-main); font-size: 0.82rem;">🛍️ ${item.nome}</strong>
				<span style="color: #15803d; font-size: 0.78rem; margin-left: 6px;">
					${qtd}x R$ ${preco.toFixed(2)} = <strong>R$ ${subtotal.toFixed(2)}</strong>
				</span>
			</div>
			<button type="button" class="btn btn-sm" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 1px 6px; font-size: 0.75rem; cursor: pointer;" onclick="removerProdutoFechamento(${index})" title="Remover produto da O.S.">
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

			// Dá baixa automática no estoque para os produtos vendidos
			if (typeof EstoqueService !== 'undefined' && produtosFechamentoAtuais.length > 0) {
				EstoqueService.darBaixaEstoqueVenda(produtosFechamentoAtuais);
			}

			pedidoEncerradoFinal = pedidos[index];
			localStorage.setItem('pedidos', JSON.stringify(pedidos));
		}

		const deveImprimirRecibo = !modalCheckImprimirRecibo || modalCheckImprimirRecibo.checked;

		fecharModalEncerramento();
		renderizarTabelas();

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

// Formulário de Entrada do Veículo (Abrir O.S.)
if (pedidoForm) {
	pedidoForm.addEventListener('submit', (e) => {
		e.preventDefault();

		const isLavaJato = isSegmentoLavaJato();
		const clienteNome = pedidoCliente.value.trim();
		const placa = isLavaJato ? pedidoPlaca.value.trim().toUpperCase() : '';
		const cor = isLavaJato ? pedidoCor.value : 'prata';
		const modelo = isLavaJato ? pedidoModelo.value.trim() : '';
		const itemDescricao = !isLavaJato && pedidoItemDescricao ? pedidoItemDescricao.value.trim() : '';
		const fotoOS = fotoOSBase64Atual || '';
		const valor = parseFloat(pedidoValor.value) || 0;
		let data = pedidoData.value;
		if (!data) data = obterDataHojeISO();

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

		// Se o cliente ainda não estiver cadastrado na base de clientes, salvamos com a foto (se houver)
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const clienteIndex = clientes.findIndex((c) => c.nome.toLowerCase() === clienteNome.toLowerCase());
		if (clienteIndex === -1 && clienteNome) {
			clientes.push({
				nome: clienteNome,
				tel1: '',
				wpp1: '❌',
				tel2: '',
				wpp2: '❌',
				endereco: '',
				foto: fotoOS
			});
			localStorage.setItem('clientes', JSON.stringify(clientes));
		} else if (clienteIndex !== -1 && fotoOS && !clientes[clienteIndex].foto) {
			// Atualiza foto do cliente se não possuía
			clientes[clienteIndex].foto = fotoOS;
			localStorage.setItem('clientes', JSON.stringify(clientes));
		}

		const osId = 'os_' + Date.now();

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

		const novoPedido = {
			id: osId,
			cliente: clienteNome,
			placa: placa || (isLavaJato ? 'SEM PLACA' : ''),
			cor: cor,
			modelo: modelo,
			itemDescricao: itemDescricao || modelo,
			foto: fotoOS,
			servicos: servicosSelecionados.join(', '),
			produtosVendidos: produtosEntradaSelecionados,
			operadorId: operadorId,
			operadorNome: operadorNome,
			data: data,
			horaEntrada: obterHoraAtual(),
			valor: valor,
			status: 'aberto', // Entra no pátio com O.S. aberta
			formaPagamento: '',
			dataEncerramento: '',
			horaEncerramento: ''
		};

		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		pedidos.push(novoPedido);
		localStorage.setItem('pedidos', JSON.stringify(pedidos));

		// Limpa formulário
		pedidoForm.reset();
		setOSFotoPreview('');
		if (pedidoData) pedidoData.value = obterDataHojeISO();
		popularCoresVeiculo();
		popularSelectOperadores();
		carregarProdutosVendaEntrada();
		renderizarTabelas();

		if (window.UI) window.UI.toast('Ordem de Serviço aberta com sucesso!', 'success');

		// Rola até o pátio e garante a aba ativa
		if (tabPatioBtn) tabPatioBtn.click();
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

	const tabPatioBtn = document.getElementById('tabPatioBtn');
	if (tabPatioBtn) {
		const countSpan = document.getElementById('countPatio');
		const countVal = countSpan ? countSpan.textContent : '0';
		tabPatioBtn.innerHTML = isLavaJato 
			? `🚗 Carros no Pátio / Em Andamento <span class="tab-count" id="countPatio">${countVal}</span>` 
			: `📋 Atendimentos em Andamento <span class="tab-count" id="countPatio">${countVal}</span>`;
	}
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
	normalizarDadosPedidos();
	configurarCamposSegmento();
	popularCoresVeiculo();
	carregarSelectServicos();
	popularSelectOperadores();
	carregarProdutosVendaEntrada();
	renderizarTabelas();

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
	const cliObj = clientes.find(c => c.nome && c.nome.toLowerCase() === (p.cliente || '').toLowerCase());
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
		window.open(`https://wa.me/55${(telLimpo || '').replace(/\D/g, '')}?text=${encodeURIComponent(msgWhats)}`, '_blank');
	}
}

window.abrirDisparoWhatsAppCarroPronto = abrirDisparoWhatsAppCarroPronto;

