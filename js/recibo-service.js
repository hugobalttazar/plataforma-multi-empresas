// ==========================================================================
// ReciboService: Gerador e Emissor de Recibo Estilo Cupom Fiscal Térmico
// ==========================================================================

const ReciboService = {
	/**
	 * Formata um número como moeda brasileira (R$)
	 */
	formatarMoeda: function (valor) {
		const num = parseFloat(valor) || 0;
		return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
	},

	/**
	 * Formata data ISO (AAAA-MM-DD) para DD/MM/AAAA
	 */
	formatarData: function (dataISO) {
		if (!dataISO) return '--/--/----';
		if (dataISO.includes('/')) return dataISO;
		const partes = dataISO.split('-');
		if (partes.length === 3) {
			return `${partes[2]}/${partes[1]}/${partes[0]}`;
		}
		return dataISO;
	},

	/**
	 * Monta o HTML completo do cupom fiscal / comprovante
	 */
	gerarCupomHTML: function (pedido) {
		if (!pedido) return '';

		const config = (typeof BrandService !== 'undefined' && BrandService.getConfig)
			? BrandService.getConfig()
			: (JSON.parse(localStorage.getItem('config_negocio')) || {});

		const visual = (typeof BrandService !== 'undefined' && BrandService.getInfoVisual)
			? BrandService.getInfoVisual(config)
			: {
				titulo: config.tipoNegocioCustom || 'SERVIÇOS',
				subtitulo: config.nomeEstabelecimento || 'SEU NEGÓCIO',
				icone: config.iconeCustom || '🧾'
			};

		const nomeFantasia = (config.nomeEstabelecimento && config.nomeEstabelecimento.trim()) 
			? config.nomeEstabelecimento.trim().toUpperCase() 
			: 'SEU NEGÓCIO';
		const razaoSocial = (config.razaoSocial && config.razaoSocial.trim()) 
			? config.razaoSocial.trim() 
			: '';
		const cnpj = config.cnpj || '';
		const telefone = config.telefone || '';
		const endereco = config.endereco || '';

		const dataEmissao = this.formatarData(pedido.dataEncerramento || pedido.data || '');
		const horaEmissao = pedido.horaEncerramento || pedido.horaEntrada || '';
		const dataEntrada = this.formatarData(pedido.data || '');
		const horaEntrada = pedido.horaEntrada || '--:--';

		const numOS = (pedido.id || '').replace(/^os_/, '').slice(-6) || '000001';
		const valorFinal = parseFloat(pedido.valor || 0);

		// Lista de serviços discriminados
		const servicosLista = (pedido.servicos || '')
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);

		// Recupera preços cadastrados se houver para exibir por item
		const servicosCadastrados = JSON.parse(localStorage.getItem('servicos')) || [];
		let linhasItensHTML = '';
		let contadorItem = 1;

		if (servicosLista.length > 0) {
			servicosLista.forEach((itemNome) => {
				const itemCadastrado = servicosCadastrados.find(
					sc => sc.nome && sc.nome.trim().toLowerCase() === itemNome.toLowerCase()
				);
				const precoUnit = itemCadastrado ? parseFloat(itemCadastrado.preco || 0) : null;
				const precoTexto = precoUnit !== null ? this.formatarMoeda(precoUnit) : '';

				linhasItensHTML += `
					<div class="cupom-item-row">
						<span class="cupom-item-num">${String(contadorItem++).padStart(2, '0')}</span>
						<span class="cupom-item-desc">${this.escaparHTML(itemNome)}</span>
						<span class="cupom-item-val">${precoTexto}</span>
					</div>
				`;
			});
		} else {
			linhasItensHTML = `
				<div class="cupom-item-row">
					<span class="cupom-item-num">01</span>
					<span class="cupom-item-desc">Serviços Prestados</span>
					<span class="cupom-item-val">${this.formatarMoeda(valorFinal)}</span>
				</div>
			`;
			contadorItem = 2;
		}

		// Produtos vendidos discriminados
		if (pedido.produtosVendidos && Array.isArray(pedido.produtosVendidos) && pedido.produtosVendidos.length > 0) {
			pedido.produtosVendidos.forEach((prod) => {
				const qtd = parseFloat(prod.quantidade || 1);
				const unit = parseFloat(prod.precoUnitario || prod.preco || 0);
				const totalProd = qtd * unit;
				linhasItensHTML += `
					<div class="cupom-item-row" style="color:#1e3a8a;">
						<span class="cupom-item-num">${String(contadorItem++).padStart(2, '0')}</span>
						<span class="cupom-item-desc">🛍️ ${this.escaparHTML(prod.nome)} (${qtd}x ${this.formatarMoeda(unit)})</span>
						<span class="cupom-item-val">${this.formatarMoeda(totalProd)}</span>
					</div>
				`;
			});
		}

		// Detalhes do item/veículo atendido
		const placa = pedido.placa || 'SEM IDENTIFICAÇÃO';
		const cor = pedido.cor ? pedido.cor.toUpperCase() : '';
		const modelo = pedido.modelo ? pedido.modelo.toUpperCase() : '';
		let linhaVeiculo = placa;
		if (cor || modelo) {
			linhaVeiculo += ` (${[modelo, cor].filter(Boolean).join(' - ')})`;
		}

		const clienteNome = (pedido.cliente || 'CONSUMIDOR NÃO IDENTIFICADO').toUpperCase();

		let blocoPixHTML = '';
		const formaPgtoLower = (pedido.formaPagamento || '').toLowerCase();
		const deveExibirQrPix = valorFinal > 0 && (formaPgtoLower.includes('pix') || formaPgtoLower.includes('prazo') || formaPgtoLower.includes('fiado'));
		if (deveExibirQrPix && typeof window !== 'undefined' && window.PixService) {
			const resPix = window.PixService.gerarCobrancaPixOS(pedido, valorFinal);
			if (resPix && resPix.valido) {
				const qrSvg = window.PixService.gerarSVG(resPix.payload, { size: 126, margin: 2 });
				if (qrSvg) {
					const payloadEsc = this.escaparHTML(resPix.payload);
					blocoPixHTML = `
						<div class="cupom-divider-dashed"></div>
						<div class="cupom-pix-box" style="text-align:center; padding: 6px 0;">
							<div style="font-weight:800; font-size:11px; color:#0f172a; margin-bottom:4px;">PAGAMENTO VIA PIX</div>
							<div style="display:inline-block; background:#fff; padding:4px; border:1px solid #cbd5e1; border-radius:4px;">${qrSvg}</div>
							<div style="font-size:9px; color:#475569; margin-top:4px;">Chave: ${this.escaparHTML(resPix.chaveNormalizada)}</div>
							<button type="button" class="cupom-pix-copy-btn" data-pix="${payloadEsc}" onclick="navigator.clipboard && navigator.clipboard.writeText(this.getAttribute('data-pix')).then(() => { const orig = this.textContent; this.textContent = '✅ PIX Copiado!'; setTimeout(() => { this.textContent = orig; }, 1800); })" style="margin-top:6px; padding:4px 10px; font-size:10px; font-weight:700; border:1px solid #0284c7; background:#e0f2fe; color:#0369a1; border-radius:4px; cursor:pointer; font-family:inherit;">
								📋 Copiar PIX Copia e Cola
							</button>
						</div>
					`;
				}
			}
		}

		return `
			<div class="cupom-fiscal-container" id="cupomImpressaoArea">
				<!-- Cabeçalho da Empresa -->
				<div class="cupom-header">
					<div class="cupom-logo-icone">${visual.icone}</div>
					<h1 class="cupom-empresa-nome">${this.escaparHTML(nomeFantasia)}</h1>
					${razaoSocial ? `<div class="cupom-empresa-sub">${this.escaparHTML(razaoSocial)}</div>` : ''}
					${cnpj ? `<div class="cupom-empresa-info">CNPJ/CPF: ${this.escaparHTML(cnpj)}</div>` : ''}
					${endereco ? `<div class="cupom-empresa-info">${this.escaparHTML(endereco)}</div>` : ''}
					${telefone ? `<div class="cupom-empresa-info">TEL: ${this.escaparHTML(telefone)}</div>` : ''}
				</div>

				<div class="cupom-divider-dashed"></div>

				<!-- Título do Documento -->
				<div class="cupom-doc-title">
					<strong>COMPROVANTE DE PAGAMENTO / RECIBO</strong>
					<span>DOCUMENTO NÃO FISCAL</span>
				</div>

				<div class="cupom-divider-dashed"></div>

				<!-- Metadados da O.S. -->
				<div class="cupom-section">
					<div class="cupom-row">
						<span>ORDEM DE SERVIÇO:</span>
						<strong>#${numOS}</strong>
					</div>
					<div class="cupom-row">
						<span>EMISSÃO / SAÍDA:</span>
						<span>${dataEmissao} às ${horaEmissao || '--:--'}</span>
					</div>
					<div class="cupom-row">
						<span>ENTRADA:</span>
						<span>${dataEntrada} às ${horaEntrada}</span>
					</div>
					<div class="cupom-row">
						<span>ITEM / PLACA:</span>
						<strong>${this.escaparHTML(linhaVeiculo)}</strong>
					</div>
					<div class="cupom-row">
						<span>CLIENTE:</span>
						<span>${this.escaparHTML(clienteNome)}</span>
					</div>
				</div>

				<div class="cupom-divider-solid"></div>

				<!-- Tabela de Itens / Serviços -->
				<div class="cupom-itens-header">
					<span>ITEM</span>
					<span style="flex:1; padding-left:6px;">DESCRIÇÃO</span>
					<span style="text-align:right;">VALOR</span>
				</div>
				<div class="cupom-divider-dotted"></div>

				<div class="cupom-itens-list">
					${linhasItensHTML}
				</div>

				<div class="cupom-divider-solid"></div>

				<!-- Totais e Pagamento -->
				<div class="cupom-totais">
					<div class="cupom-row cupom-total-destaque">
						<span>VALOR TOTAL:</span>
						<strong>${this.formatarMoeda(valorFinal)}</strong>
					</div>
					<div class="cupom-row" style="margin-top: 4px;">
						<span>FORMA DE PAGAMENTO:</span>
						<strong>${this.escaparHTML((pedido.formaPagamento || 'Pix').toUpperCase())}</strong>
					</div>
					<div class="cupom-row">
						<span>VALOR RECEBIDO:</span>
						<span>${this.formatarMoeda(valorFinal)}</span>
					</div>
					<div class="cupom-row">
						<span>SITUAÇÃO:</span>
						${(() => {
							if (pedido.pacoteAbatido) {
								const rest = typeof pedido.pacoteCreditosRestantes === 'number' ? ` (${pedido.pacoteCreditosRestantes} rest.)` : '';
								return `<strong style="color: #0369a1;">PACOTE ATIVO${this.escaparHTML(rest)} ✅</strong>`;
							}
							if (pedido.formaPagamento === 'Faturado / A Receber' && pedido.statusFaturamento !== 'pago') {
								return `<strong style="color: #b45309;">FATURADO (A RECEBER)</strong>`;
							}
							return `<strong style="color: #047857;">QUITADO / PAGO ✅</strong>`;
						})()}
					</div>
				</div>

				${blocoPixHTML}

				<div class="cupom-divider-dashed"></div>

				<!-- Rodapé com Mensagem de Agradecimento e Assinatura -->
				<div class="cupom-footer">
					<p class="cupom-msg-agradecimento">OBRIGADO PELA PREFERÊNCIA!</p>
					<p class="cupom-volte-sempre">Volte Sempre!</p>
					
					<div class="cupom-assinatura-box">
						<div class="cupom-linha-assinatura"></div>
						<span>Assinatura do Responsável</span>
					</div>

					<div class="cupom-timestamp">
						Impresso em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
					</div>
				</div>
			</div>
		`;
	},

	/**
	 * Dispara a impressão limpa do cupom na impressora (inclusive térmicas de 80mm/58mm)
	 */
	imprimirCupom: function (pedido) {
		if (!pedido) return;

		// Cria um container invisível ou janela dedicada para impressão
		const htmlCupom = this.gerarCupomHTML(pedido);

		// Cria iframe invisível isolado para garantir estilos de impressão perfeitos
		let printFrame = document.getElementById('iframeImpressaoRecibo');
		if (!printFrame) {
			printFrame = document.createElement('iframe');
			printFrame.id = 'iframeImpressaoRecibo';
			printFrame.style.position = 'fixed';
			printFrame.style.right = '0';
			printFrame.style.bottom = '0';
			printFrame.style.width = '0';
			printFrame.style.height = '0';
			printFrame.style.border = '0';
			document.body.appendChild(printFrame);
		}

		const doc = printFrame.contentWindow.document;
		doc.open();
		doc.write(`
			<!DOCTYPE html>
			<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<title>Recibo - O.S. #${(pedido.id || '').replace(/^os_/, '').slice(-6)}</title>
				<style>
					@page {
						size: auto;
						margin: 0;
					}
					* {
						box-sizing: border-box;
						margin: 0;
						padding: 0;
						-webkit-print-color-adjust: exact;
						print-color-adjust: exact;
					}
					body {
						font-family: 'Courier New', Courier, monospace, 'Lucida Console', Monaco;
						font-size: 11px;
						line-height: 1.35;
						color: #000;
						background: #fff;
						padding: 8px 6px;
						width: 100%;
						max-width: 320px; /* Padrão internacional de bobina térmica 80mm / 3 polegadas */
						margin: 0 auto;
					}
					.cupom-fiscal-container {
						width: 100%;
						padding: 4px;
					}
					.cupom-header {
						text-align: center;
						margin-bottom: 6px;
					}
					.cupom-logo-icone {
						font-size: 22px;
						margin-bottom: 2px;
					}
					.cupom-empresa-nome {
						font-size: 14px;
						font-weight: 800;
						text-transform: uppercase;
						letter-spacing: 0.5px;
						margin-bottom: 2px;
					}
					.cupom-empresa-sub {
						font-size: 10px;
						font-weight: 600;
						margin-bottom: 2px;
					}
					.cupom-empresa-info {
						font-size: 9px;
						line-height: 1.25;
					}
					.cupom-divider-dashed {
						border-top: 1px dashed #000;
						margin: 6px 0;
					}
					.cupom-divider-solid {
						border-top: 1px solid #000;
						margin: 6px 0;
					}
					.cupom-divider-dotted {
						border-top: 1px dotted #000;
						margin: 4px 0;
					}
					.cupom-pix-copy-btn {
						display: none !important;
					}
					.cupom-doc-title {
						text-align: center;
						margin: 4px 0;
					}
					.cupom-doc-title strong {
						display: block;
						font-size: 11px;
						font-weight: 800;
						letter-spacing: 0.5px;
					}
					.cupom-doc-title span {
						font-size: 9px;
						font-weight: normal;
					}
					.cupom-section {
						margin: 4px 0;
						font-size: 10px;
					}
					.cupom-row {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
						margin-bottom: 2px;
					}
					.cupom-row span:first-child {
						font-weight: 600;
					}
					.cupom-itens-header {
						display: flex;
						justify-content: space-between;
						font-size: 10px;
						font-weight: 800;
						margin-bottom: 2px;
					}
					.cupom-itens-list {
						margin: 4px 0;
					}
					.cupom-item-row {
						display: flex;
						justify-content: space-between;
						font-size: 10px;
						margin-bottom: 3px;
					}
					.cupom-item-num {
						width: 18px;
						font-weight: 700;
					}
					.cupom-item-desc {
						flex: 1;
						padding: 0 4px;
						word-break: break-word;
					}
					.cupom-item-val {
						text-align: right;
						white-space: nowrap;
						font-weight: 700;
					}
					.cupom-totais {
						margin: 6px 0;
						font-size: 10px;
					}
					.cupom-total-destaque {
						font-size: 13px;
						font-weight: 800;
						margin-bottom: 4px;
					}
					.cupom-footer {
						text-align: center;
						margin-top: 8px;
						font-size: 9px;
					}
					.cupom-msg-agradecimento {
						font-weight: 800;
						font-size: 10px;
						letter-spacing: 0.5px;
					}
					.cupom-volte-sempre {
						font-size: 9px;
						margin-top: 2px;
					}
					.cupom-assinatura-box {
						margin: 22px auto 6px auto;
						width: 75%;
						text-align: center;
					}
					.cupom-linha-assinatura {
						border-top: 1px solid #000;
						margin-bottom: 2px;
					}
					.cupom-timestamp {
						font-size: 8px;
						color: #333;
						margin-top: 6px;
					}
				</style>
			</head>
			<body>
				${htmlCupom}
			</body>
			</html>
		`);
		doc.close();

		setTimeout(() => {
			printFrame.contentWindow.focus();
			printFrame.contentWindow.print();
		}, 300);
	},

	/**
	 * Gera imagem PNG nítida do cupom fiscal via Canvas sem dependências externas
	 */
	gerarImagemCupomAsync: function (pedido) {
		return new Promise((resolve, reject) => {
			try {
				const config = (typeof BrandService !== 'undefined' && BrandService.getConfig)
					? BrandService.getConfig()
					: (JSON.parse(localStorage.getItem('config_negocio')) || {});

				const nomeFantasia = (config.nomeEstabelecimento && config.nomeEstabelecimento.trim())
					? config.nomeEstabelecimento.trim().toUpperCase()
					: 'SEU NEGÓCIO';
				const razaoSocial = (config.razaoSocial && config.razaoSocial.trim())
					? config.razaoSocial.trim()
					: '';
				const cnpj = config.cnpj || '';
				const telefone = config.telefone || '';
				const endereco = config.endereco || '';

				const dataEmissao = this.formatarData(pedido.dataEncerramento || pedido.data || '');
				const horaEmissao = pedido.horaEncerramento || pedido.horaEntrada || '--:--';
				const dataEntrada = this.formatarData(pedido.data || '');
				const horaEntrada = pedido.horaEntrada || '--:--';

				const numOS = (pedido.id || '').replace(/^os_/, '').slice(-6) || '000001';
				const valorFinal = parseFloat(pedido.valor || 0);

				const servicosLista = (pedido.servicos || '')
					.split(',')
					.map(s => s.trim())
					.filter(Boolean);

				const servicosCadastrados = JSON.parse(localStorage.getItem('servicos')) || [];

				const placa = pedido.placa || 'SEM IDENTIFICAÇÃO';
				const cor = pedido.cor ? pedido.cor.toUpperCase() : '';
				const modelo = pedido.modelo ? pedido.modelo.toUpperCase() : '';
				let linhaVeiculo = placa;
				if (cor || modelo) {
					linhaVeiculo += ` (${[modelo, cor].filter(Boolean).join(' - ')})`;
				}

				const clienteNome = (pedido.cliente || 'CONSUMIDOR NÃO IDENTIFICADO').toUpperCase();
				const formaPgto = (pedido.formaPagamento || 'Pix').toUpperCase();

				// Dimensões térmicas padrão em alta resolução (escala 2x para nitidez)
				const larguraBase = 380;
				const paddingX = 20;
				const larguraUtil = larguraBase - (paddingX * 2);

				// Criação do canvas
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');

				// Primeira passada para calcular altura exata
				let y = 24;

				function adicionarEspaco(px) {
					y += px;
				}

				// Topo
				y += 30; // Nome
				if (razaoSocial) y += 18;
				if (cnpj) y += 16;
				if (endereco) y += 16;
				if (telefone) y += 16;
				y += 18; // divisor

				// Documento
				y += 20; // COMPROVANTE
				y += 16; // NÃO FISCAL
				y += 18; // divisor

				// Metadados
				y += 18; // O.S.
				y += 18; // Emissão
				y += 18; // Entrada
				y += 18; // Placa
				y += 18; // Cliente
				y += 18; // divisor

				// Itens Cabeçalho
				y += 20;
				y += 14; // dotted
				const totalItens = Math.max(servicosLista.length, 1);
				y += (totalItens * 22);
				y += 18; // divisor

				// Totais
				y += 26; // TOTAL
				y += 18; // Forma Pagamento
				y += 18; // Valor Recebido
				y += 18; // Situação

				let pixCanvasInfo = null;
				const formaLowerCanvas = (pedido.formaPagamento || '').toLowerCase();
				if (valorFinal > 0 && (formaLowerCanvas.includes('pix') || formaLowerCanvas.includes('prazo') || formaLowerCanvas.includes('fiado')) && typeof window !== 'undefined' && window.PixService) {
					const resPixCanvas = window.PixService.gerarCobrancaPixOS(pedido, valorFinal);
					if (resPixCanvas && resPixCanvas.valido) {
						pixCanvasInfo = resPixCanvas;
						y += 165;
					}
				}

				y += 20; // divisor

				// Rodapé
				y += 22; // Agradecimento
				y += 18; // Volte sempre
				y += 45; // Assinatura
				y += 20; // Timestamp
				y += 25; // margem final

				const alturaTotal = Math.max(y, 450);

				// Configurar tamanho real e DPI alto (scale 2x)
				const escala = 2;
				canvas.width = larguraBase * escala;
				canvas.height = alturaTotal * escala;
				ctx.scale(escala, escala);

				// Fundo branco papel cupom
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, larguraBase, alturaTotal);

				// Borda sutil de papel
				ctx.strokeStyle = '#e2e8f0';
				ctx.lineWidth = 1;
				ctx.strokeRect(1, 1, larguraBase - 2, alturaTotal - 2);

				// Cores e Fontes
				ctx.fillStyle = '#0f172a';
				ctx.textAlign = 'center';

				// 1. Cabeçalho
				let cursorY = 28;
				ctx.font = 'bold 16px "Courier New", Courier, monospace';
				ctx.fillText(nomeFantasia, larguraBase / 2, cursorY);
				cursorY += 18;

				if (razaoSocial) {
					ctx.font = '600 11px "Courier New", Courier, monospace';
					ctx.fillStyle = '#334155';
					ctx.fillText(razaoSocial, larguraBase / 2, cursorY);
					cursorY += 16;
				}

				ctx.font = '10px "Courier New", Courier, monospace';
				ctx.fillStyle = '#475569';
				if (cnpj) {
					ctx.fillText(`CNPJ/CPF: ${cnpj}`, larguraBase / 2, cursorY);
					cursorY += 15;
				}
				if (endereco) {
					ctx.fillText(endereco, larguraBase / 2, cursorY);
					cursorY += 15;
				}
				if (telefone) {
					ctx.fillText(`TEL: ${telefone}`, larguraBase / 2, cursorY);
					cursorY += 15;
				}

				cursorY += 6;

				// Linha tracejada
				function desenharLinhaTracejada(yPos) {
					ctx.beginPath();
					ctx.strokeStyle = '#0f172a';
					ctx.lineWidth = 1;
					ctx.setLineDash([4, 3]);
					ctx.moveTo(paddingX, yPos);
					ctx.lineTo(larguraBase - paddingX, yPos);
					ctx.stroke();
					ctx.setLineDash([]);
				}

				function desenharLinhaSolida(yPos) {
					ctx.beginPath();
					ctx.strokeStyle = '#0f172a';
					ctx.lineWidth = 1.2;
					ctx.moveTo(paddingX, yPos);
					ctx.lineTo(larguraBase - paddingX, yPos);
					ctx.stroke();
				}

				function desenharLinhaPontilhada(yPos) {
					ctx.beginPath();
					ctx.strokeStyle = '#64748b';
					ctx.lineWidth = 1;
					ctx.setLineDash([2, 2]);
					ctx.moveTo(paddingX, yPos);
					ctx.lineTo(larguraBase - paddingX, yPos);
					ctx.stroke();
					ctx.setLineDash([]);
				}

				desenharLinhaTracejada(cursorY);
				cursorY += 16;

				// Título do Documento
				ctx.fillStyle = '#000000';
				ctx.font = 'bold 12px "Courier New", Courier, monospace';
				ctx.textAlign = 'center';
				ctx.fillText('COMPROVANTE DE PAGAMENTO / RECIBO', larguraBase / 2, cursorY);
				cursorY += 14;
				ctx.font = '10px "Courier New", Courier, monospace';
				ctx.fillStyle = '#64748b';
				ctx.fillText('DOCUMENTO NÃO FISCAL', larguraBase / 2, cursorY);
				cursorY += 12;

				desenharLinhaTracejada(cursorY);
				cursorY += 18;

				// Metadados O.S. (alinhamento esquerda/direita)
				function desenharLinhaDupla(rotulo, valor, destaque = false, corValor = '#0f172a') {
					ctx.font = destaque ? 'bold 11px "Courier New", monospace' : '600 11px "Courier New", monospace';
					ctx.fillStyle = '#334155';
					ctx.textAlign = 'left';
					ctx.fillText(rotulo, paddingX, cursorY);

					ctx.font = destaque ? 'bold 11px "Courier New", monospace' : '11px "Courier New", monospace';
					ctx.fillStyle = corValor;
					ctx.textAlign = 'right';
					ctx.fillText(valor, larguraBase - paddingX, cursorY);
					cursorY += 18;
				}

				desenharLinhaDupla('ORDEM DE SERVIÇO:', `#${numOS}`, true);
				desenharLinhaDupla('EMISSÃO / SAÍDA:', `${dataEmissao} às ${horaEmissao}`);
				desenharLinhaDupla('ENTRADA:', `${dataEntrada} às ${horaEntrada}`);
				desenharLinhaDupla('ITEM / PLACA:', linhaVeiculo, true);
				desenharLinhaDupla('CLIENTE:', clienteNome);

				cursorY += 4;
				desenharLinhaSolida(cursorY);
				cursorY += 16;

				// Cabeçalho de Itens
				ctx.font = 'bold 11px "Courier New", monospace';
				ctx.fillStyle = '#000000';
				ctx.textAlign = 'left';
				ctx.fillText('ITEM  DESCRIÇÃO', paddingX, cursorY);
				ctx.textAlign = 'right';
				ctx.fillText('VALOR', larguraBase - paddingX, cursorY);
				cursorY += 8;

				desenharLinhaPontilhada(cursorY);
				cursorY += 16;

				// Linhas de Itens
				if (servicosLista.length > 0) {
					servicosLista.forEach((itemNome, idx) => {
						const numFmt = String(idx + 1).padStart(2, '0');
						const itemCadastrado = servicosCadastrados.find(
							sc => sc.nome && sc.nome.trim().toLowerCase() === itemNome.toLowerCase()
						);
						const precoUnit = itemCadastrado ? parseFloat(itemCadastrado.preco || 0) : null;
						const precoTexto = precoUnit !== null ? `R$ ${precoUnit.toFixed(2)}` : '';

						ctx.font = '11px "Courier New", monospace';
						ctx.fillStyle = '#0f172a';
						ctx.textAlign = 'left';
						
						// Trunca texto se for muito longo
						let nomeExibicao = itemNome;
						if (nomeExibicao.length > 24) {
							nomeExibicao = nomeExibicao.substring(0, 22) + '..';
						}
						ctx.fillText(`${numFmt}  ${nomeExibicao}`, paddingX, cursorY);

						ctx.textAlign = 'right';
						ctx.font = 'bold 11px "Courier New", monospace';
						ctx.fillText(precoTexto, larguraBase - paddingX, cursorY);

						cursorY += 20;
					});
				} else {
					ctx.font = '11px "Courier New", monospace';
					ctx.fillStyle = '#0f172a';
					ctx.textAlign = 'left';
					ctx.fillText('01  Serviços Prestados', paddingX, cursorY);
					ctx.textAlign = 'right';
					ctx.font = 'bold 11px "Courier New", monospace';
					ctx.fillText(`R$ ${valorFinal.toFixed(2)}`, larguraBase - paddingX, cursorY);
					cursorY += 20;
				}

				cursorY += 4;
				desenharLinhaSolida(cursorY);
				cursorY += 18;

				// Totais
				ctx.font = 'bold 14px "Courier New", monospace';
				ctx.fillStyle = '#000000';
				ctx.textAlign = 'left';
				ctx.fillText('VALOR TOTAL:', paddingX, cursorY);
				ctx.textAlign = 'right';
				ctx.fillText(`R$ ${valorFinal.toFixed(2)}`, larguraBase - paddingX, cursorY);
				cursorY += 20;

				desenharLinhaDupla('FORMA DE PAGAMENTO:', formaPgto, true);
				desenharLinhaDupla('VALOR RECEBIDO:', `R$ ${valorFinal.toFixed(2)}`);
				if (pedido.pacoteAbatido) {
					const restTxt = typeof pedido.pacoteCreditosRestantes === 'number' ? ` (${pedido.pacoteCreditosRestantes} rest.)` : '';
					desenharLinhaDupla('SITUAÇÃO:', `ABATIDO DE PACOTE${restTxt}`, true, '#0369a1');
				} else if (pedido.formaPagamento === 'Faturado / A Receber' && pedido.statusFaturamento !== 'pago') {
					desenharLinhaDupla('SITUAÇÃO:', 'FATURADO (A RECEBER)', true, '#b45309');
				} else {
					desenharLinhaDupla('SITUAÇÃO:', 'QUITADO / PAGO ✅', true, '#047857');
				}

				if (pixCanvasInfo && typeof window !== 'undefined' && window.PixService) {
					cursorY += 4;
					desenharLinhaTracejada(cursorY);
					cursorY += 16;
					ctx.textAlign = 'center';
					ctx.font = 'bold 11px "Courier New", monospace';
					ctx.fillStyle = '#0f172a';
					ctx.fillText('PAGAMENTO VIA PIX', larguraBase / 2, cursorY);
					cursorY += 8;
					const qrSizeCanvas = 118;
					window.PixService.desenharNoCanvas(ctx, pixCanvasInfo.payload, (larguraBase - qrSizeCanvas) / 2, cursorY, qrSizeCanvas);
					cursorY += qrSizeCanvas + 12;
					ctx.font = '9px "Courier New", monospace';
					ctx.fillStyle = '#475569';
					ctx.fillText(`Chave: ${pixCanvasInfo.chaveNormalizada}`, larguraBase / 2, cursorY);
					cursorY += 6;
				}

				cursorY += 4;
				desenharLinhaTracejada(cursorY);
				cursorY += 18;

				// Rodapé
				ctx.textAlign = 'center';
				ctx.font = 'bold 11px "Courier New", monospace';
				ctx.fillStyle = '#000000';
				ctx.fillText('OBRIGADO PELA PREFERÊNCIA!', larguraBase / 2, cursorY);
				cursorY += 14;

				ctx.font = '10px "Courier New", monospace';
				ctx.fillStyle = '#475569';
				ctx.fillText('Volte Sempre!', larguraBase / 2, cursorY);
				cursorY += 36;

				// Assinatura
				ctx.beginPath();
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = 1;
				const larguraAssinatura = 220;
				const xAssinaturaInicio = (larguraBase - larguraAssinatura) / 2;
				ctx.moveTo(xAssinaturaInicio, cursorY);
				ctx.lineTo(xAssinaturaInicio + larguraAssinatura, cursorY);
				ctx.stroke();
				cursorY += 12;

				ctx.font = '9px "Courier New", monospace';
				ctx.fillStyle = '#334155';
				ctx.fillText('Assinatura do Responsável', larguraBase / 2, cursorY);
				cursorY += 16;

				ctx.font = '8px "Courier New", monospace';
				ctx.fillStyle = '#94a3b8';
				ctx.fillText(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, larguraBase / 2, cursorY);

				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Falha ao gerar blob da imagem do cupom.'));
					}
				}, 'image/png');
			} catch (err) {
				reject(err);
			}
		});
	},

	/**
	 * Baixa a imagem PNG do cupom pronta para enviar via WhatsApp, Telegram ou E-mail
	 */
	baixarImagemRecibo: async function (pedido) {
		if (!pedido) return;
		try {
			const blob = await this.gerarImagemCupomAsync(pedido);
			const numOS = (pedido.id || '').replace(/^os_/, '').slice(-6) || 'recibo';
			const nomeArquivo = `Recibo_OS_${numOS}_${(pedido.placa || 'comprovante').replace(/[^A-Za-z0-9]/g, '')}.png`;

			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = nomeArquivo;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);
		} catch (e) {
			console.error('Erro ao baixar imagem do recibo:', e);
			// Fallback: baixa como HTML formatado
			this.baixarHTMLRecibo(pedido);
		}
	},

	/**
	 * Fallback de download direto em formato HTML auto-contido
	 */
	baixarHTMLRecibo: function (pedido) {
		if (!pedido) return;
		const html = `
			<!DOCTYPE html>
			<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<title>Recibo - O.S. #${(pedido.id || '').replace(/^os_/, '').slice(-6)}</title>
				<style>
					body { font-family: 'Courier New', Courier, monospace; background: #f8fafc; padding: 20px; display: flex; justify-content: center; }
					.cupom-fiscal-container { background: #fff; width: 320px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
					.cupom-header { text-align: center; }
					.cupom-logo-icone { font-size: 24px; }
					.cupom-empresa-nome { font-size: 14px; font-weight: bold; }
					.cupom-divider-dashed { border-top: 1px dashed #000; margin: 8px 0; }
					.cupom-divider-solid { border-top: 1px solid #000; margin: 8px 0; }
					.cupom-divider-dotted { border-top: 1px dotted #000; margin: 4px 0; }
					.cupom-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px; }
					.cupom-item-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
					.cupom-itens-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; }
					.cupom-total-destaque { font-size: 13px; font-weight: bold; }
					.cupom-footer { text-align: center; margin-top: 12px; font-size: 10px; }
					.cupom-linha-assinatura { border-top: 1px solid #000; margin: 20px auto 4px auto; width: 80%; }
				</style>
			</head>
			<body>
				${this.gerarCupomHTML(pedido)}
			</body>
			</html>
		`;
		const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
		const numOS = (pedido.id || '').replace(/^os_/, '').slice(-6) || 'recibo';
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `Recibo_OS_${numOS}.html`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(link.href);
	},

	/**
	 * Prepara mensagem formatada com os dados do cupom e abre o WhatsApp com 1 clique
	 */
	enviarWhatsApp: function (pedido) {
		if (!pedido) return;

		// Busca telefone do cliente se houver na lista de clientes
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		const clienteCadastrado = clientes.find(
			c => c.nome && pedido.cliente && c.nome.trim().toLowerCase() === pedido.cliente.trim().toLowerCase()
		);
		let telLimpo = '';
		if (clienteCadastrado && clienteCadastrado.tel1) {
			telLimpo = clienteCadastrado.tel1.replace(/\D/g, '').replace(/^0+/, '');
			if (telLimpo.length >= 10 && telLimpo.length <= 11 && !telLimpo.startsWith('55')) {
				telLimpo = '55' + telLimpo;
			}
		}

		if (typeof WhatsAppService !== 'undefined') {
			WhatsAppService.abrirModalDisparo({
				tipo: 'recibo',
				dados: pedido,
				telefone: telLimpo,
				titulo: 'Enviar Recibo de Pagamento'
			});
			return;
		}

		const config = (typeof BrandService !== 'undefined' && BrandService.getConfig)
			? BrandService.getConfig()
			: (JSON.parse(localStorage.getItem('config_negocio')) || {});

		const nomeEmpresa = config.nomeEstabelecimento || 'SEU NEGÓCIO';
		const numOS = (pedido.id || '').replace(/^os_/, '').slice(-6) || '000001';
		const valorFinal = parseFloat(pedido.valor || 0).toFixed(2);
		const servicos = pedido.servicos || 'Serviços Prestados';
		const formaPgto = (pedido.formaPagamento || 'Pix').toUpperCase();
		const dataEmissao = this.formatarData(pedido.dataEncerramento || pedido.data || '');
		const horaEmissao = pedido.horaEncerramento || pedido.horaEntrada || '';

		let msg = `*📄 COMPROVANTE DE PAGAMENTO / RECIBO*\n`;
		msg += `*${nomeEmpresa.toUpperCase()}*\n`;
		if (config.telefone) msg += `📞 Contato: ${config.telefone}\n`;
		msg += `------------------------------------\n`;
		msg += `*O.S.:* #${numOS}\n`;
		msg += `*Data/Hora:* ${dataEmissao} às ${horaEmissao}\n`;
		msg += `*Cliente:* ${pedido.cliente || 'Consumidor'}\n`;
		msg += `*Item/Veículo:* ${pedido.placa || ''} ${pedido.modelo ? `(${pedido.modelo})` : ''}\n`;
		msg += `*Serviços:* ${servicos}\n`;
		msg += `------------------------------------\n`;
		const statusMsg = pedido.pacoteAbatido
			? `PACOTE ATIVO (${typeof pedido.pacoteCreditosRestantes === 'number' ? pedido.pacoteCreditosRestantes + ' créditos rest.' : 'Abatido'}) ✅`
			: (pedido.formaPagamento === 'Faturado / A Receber' && pedido.statusFaturamento !== 'pago'
				? 'FATURADO (A RECEBER)'
				: 'QUITADO / PAGO ✅');
		msg += `*VALOR TOTAL:* R$ ${valorFinal}\n`;
		msg += `*Forma de Pagamento:* ${formaPgto}\n`;
		msg += `*Status:* ${statusMsg}\n`;
		msg += `------------------------------------\n`;
		msg += `_Obrigado pela preferência! Volte sempre._`;

		const textoEncoded = encodeURIComponent(msg);
		const isDesktop = typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
		const canalSalvo = localStorage.getItem('whatsapp_canal_preferido');
		const baseUrl = (isDesktop && canalSalvo === 'web')
			? 'https://web.whatsapp.com/send'
			: 'https://api.whatsapp.com/send';
		let urlWhatsApp = `${baseUrl}?text=${textoEncoded}`;
		if (telLimpo) {
			urlWhatsApp = `${baseUrl}?phone=${telLimpo}&text=${textoEncoded}`;
		}

		window.open(urlWhatsApp, '_blank');
	},

	/**
	 * Utilitário de escape de strings para HTML seguro
	 */
	escaparHTML: function (str) {
		if (!str) return '';
		return str
			.toString()
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}
};

if (typeof window !== 'undefined') {
	window.ReciboService = ReciboService;
}
