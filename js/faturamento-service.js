// ==========================================================================
// FaturamentoService: Faturamento Agrupado para Frotas / Empresas Corporativas
// ==========================================================================

const FaturamentoService = {
	LOTES_KEY: 'faturamentos_lotes',

	getDataHojeISO: function () {
		if (typeof obterDataHojeISO === 'function') return obterDataHojeISO();
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	},

	formatarDataBR: function (dataISO) {
		if (!dataISO) return '-';
		const partes = String(dataISO).split('-');
		if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
		return dataISO;
	},

	escaparHTML: function (str) {
		if (typeof window !== 'undefined' && typeof window.escapeHTML === 'function') {
			return window.escapeHTML(str);
		}
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	},

	getLotes: function () {
		try {
			const lista = JSON.parse(localStorage.getItem(this.LOTES_KEY)) || [];
			return Array.isArray(lista) ? lista : [];
		} catch (e) {
			return [];
		}
	},

	salvarLotes: function (lista) {
		localStorage.setItem(this.LOTES_KEY, JSON.stringify(lista || []));
	},

	isPedidoFaturado: function (pedido) {
		if (!pedido || pedido.status !== 'encerrado') return false;
		const forma = (pedido.formaPagamento || '').toLowerCase();
		return forma.includes('faturado') || Boolean(pedido.statusFaturamento);
	},

	getStatusFaturamentoPedido: function (pedido) {
		if (!this.isPedidoFaturado(pedido)) return null;
		return pedido.statusFaturamento === 'pago' ? 'pago' : 'pendente';
	},

	getPedidosFaturados: function ({ clienteNome = '', dataInicio = '', dataFim = '', status = 'pendente', placa = '' } = {}) {
		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const clienteFiltro = (clienteNome || '').trim().toLowerCase();
		const placaFiltro = (placa || '').trim().toUpperCase();

		return pedidos.filter(p => {
			if (!this.isPedidoFaturado(p)) return false;
			const statusPedido = this.getStatusFaturamentoPedido(p);
			if (status && status !== 'todos' && statusPedido !== status) return false;

			if (clienteFiltro) {
				const nomeP = (p.cliente || '').trim().toLowerCase();
				if (nomeP !== clienteFiltro) return false;
			}

			if (placaFiltro) {
				const placaP = (p.placa || '').trim().toUpperCase();
				if (!placaP.includes(placaFiltro)) return false;
			}

			const dataRef = p.dataEncerramento || p.data || '';
			if (dataInicio && dataRef && dataRef < dataInicio) return false;
			if (dataFim && dataRef && dataRef > dataFim) return false;

			return true;
		}).sort((a, b) => {
			const da = a.dataEncerramento || a.data || '';
			const db = b.dataEncerramento || b.data || '';
			return da > db ? -1 : (da < db ? 1 : 0);
		});
	},

	getClientesComFaturamento: function () {
		const pedidos = this.getPedidosFaturados({ status: 'todos' });
		const mapa = new Map();

		pedidos.forEach(p => {
			const nomeOriginal = (p.cliente || 'Cliente não identificado').trim();
			const chave = nomeOriginal.toLowerCase();
			if (!mapa.has(chave)) {
				mapa.set(chave, {
					clienteNome: nomeOriginal,
					qtdPendente: 0,
					valorPendente: 0,
					qtdPago: 0,
					valorPago: 0,
					placas: new Set()
				});
			}
			const item = mapa.get(chave);
			const valor = parseFloat(p.valor || 0) || 0;
			if (p.placa) item.placas.add(p.placa);

			if (this.getStatusFaturamentoPedido(p) === 'pago') {
				item.qtdPago += 1;
				item.valorPago += valor;
			} else {
				item.qtdPendente += 1;
				item.valorPendente += valor;
			}
		});

		return Array.from(mapa.values()).map(item => ({
			...item,
			valorPendente: Number(item.valorPendente.toFixed(2)),
			valorPago: Number(item.valorPago.toFixed(2)),
			placasLista: Array.from(item.placas)
		})).sort((a, b) => b.valorPendente - a.valorPendente);
	},

	getResumoPorPlaca: function (pedidosLista) {
		const mapa = new Map();
		(pedidosLista || []).forEach(p => {
			const placa = (p.placa || 'SEM PLACA').toUpperCase();
			if (!mapa.has(placa)) {
				mapa.set(placa, {
					placa,
					modelo: p.modelo || '-',
					qtdOrdens: 0,
					valorTotal: 0
				});
			}
			const grp = mapa.get(placa);
			grp.qtdOrdens += 1;
			grp.valorTotal += parseFloat(p.valor || 0) || 0;
		});
		return Array.from(mapa.values()).map(g => ({
			...g,
			valorTotal: Number(g.valorTotal.toFixed(2))
		})).sort((a, b) => b.valorTotal - a.valorTotal);
	},

	darBaixaUnificada: function ({ clienteNome = '', pedidoIds = [], formaPagamento = 'Pix', observacao = '' }) {
		const idsSet = new Set((Array.isArray(pedidoIds) ? pedidoIds : []).map(String));
		if (idsSet.size === 0) {
			return { sucesso: false, erro: 'Selecione pelo menos uma O.S. faturada para dar baixa.' };
		}

		const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
		const hoje = this.getDataHojeISO();
		const loteId = 'fat_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
		let valorTotal = 0;
		const pedidosBaixados = [];

		pedidos.forEach(p => {
			if (idsSet.has(String(p.id)) && this.isPedidoFaturado(p) && this.getStatusFaturamentoPedido(p) === 'pendente') {
				p.statusFaturamento = 'pago';
				p.faturaId = loteId;
				p.dataPagamentoFatura = hoje;
				p.formaPagamentoRecebimento = formaPagamento || 'Pix';
				valorTotal += parseFloat(p.valor || 0) || 0;
				pedidosBaixados.push(p);
			}
		});

		if (pedidosBaixados.length === 0) {
			return { sucesso: false, erro: 'Nenhuma O.S. pendente elegível encontrada para baixa.' };
		}

		const valorFinal = Number(valorTotal.toFixed(2));
		const clienteFinal = (clienteNome || pedidosBaixados[0].cliente || 'Cliente Corporativo').trim();

		let entradaCaixa = null;
		if (valorFinal > 0 && typeof CaixaService !== 'undefined' && typeof CaixaService.registrarEntrada === 'function') {
			entradaCaixa = CaixaService.registrarEntrada({
				valor: valorFinal,
				formaPagamento: formaPagamento || 'Pix',
				categoria: 'Faturamento Frota',
				origem: 'faturamento',
				referenciaId: loteId,
				cliente: clienteFinal,
				descricao: `Baixa Fatura ${clienteFinal} (${pedidosBaixados.length} O.S.)${observacao ? ' - ' + observacao : ''}`
			});
		}

		localStorage.setItem('pedidos', JSON.stringify(pedidos));

		const lotes = this.getLotes();
		const novoLote = {
			id: loteId,
			clienteNome: clienteFinal,
			pedidoIds: pedidosBaixados.map(p => String(p.id)),
			qtdOrdens: pedidosBaixados.length,
			valorTotal: valorFinal,
			formaPagamento: formaPagamento || 'Pix',
			dataBaixa: hoje,
			observacao: (observacao || '').trim(),
			entradaCaixaId: entradaCaixa ? entradaCaixa.id : null,
			criadoEm: new Date().toISOString()
		};
		lotes.unshift(novoLote);
		this.salvarLotes(lotes);

		return { sucesso: true, lote: novoLote, entradaCaixa, qtdBaixada: pedidosBaixados.length, valorTotal: valorFinal };
	},

	gerarExtratoHTML: function (clienteNome, pedidosLista, periodoTexto = '') {
		const config = (typeof BrandService !== 'undefined' && BrandService.getConfig)
			? BrandService.getConfig()
			: (JSON.parse(localStorage.getItem('config_negocio')) || {});

		const nomeEmpresa = this.escaparHTML(config.nomeEstabelecimento || 'SEU NEGÓCIO');
		const cnpjEmpresa = this.escaparHTML(config.cnpj || '');
		const telEmpresa = this.escaparHTML(config.telefone || '');
		const clienteEsc = this.escaparHTML(clienteNome || 'Todos os Clientes Faturados');
		const periodoEsc = this.escaparHTML(periodoTexto || 'Todo o período filtrado');

		const totalGeral = (pedidosLista || []).reduce((acc, p) => acc + (parseFloat(p.valor || 0) || 0), 0);
		const resumoPlacas = this.getResumoPorPlaca(pedidosLista);

		const linhasOrdens = (pedidosLista || []).map(p => {
			const numOS = this.escaparHTML((p.id || '').replace(/^os_/, '').slice(-6) || '000001');
			const dataFmt = this.escaparHTML(this.formatarDataBR(p.dataEncerramento || p.data));
			const placa = this.escaparHTML(p.placa || 'SEM PLACA');
			const modelo = this.escaparHTML(p.modelo || '-');
			const servicos = this.escaparHTML(p.servicos || '-');
			const valor = (parseFloat(p.valor || 0) || 0).toFixed(2).replace('.', ',');
			const statusFat = this.getStatusFaturamentoPedido(p) === 'pago' ? 'Quitado' : 'A Receber';
			return `
				<tr>
					<td>#${numOS}</td>
					<td>${dataFmt}</td>
					<td><strong>${placa}</strong><br><small>${modelo}</small></td>
					<td>${servicos}</td>
					<td>${statusFat}</td>
					<td style="text-align:right; font-weight:700;">R$ ${valor}</td>
				</tr>
			`;
		}).join('');

		const linhasPlacas = resumoPlacas.map(r => `
			<tr>
				<td><strong>${this.escaparHTML(r.placa)}</strong> (${this.escaparHTML(r.modelo)})</td>
				<td style="text-align:center;">${r.qtdOrdens}</td>
				<td style="text-align:right; font-weight:700;">R$ ${r.valorTotal.toFixed(2).replace('.', ',')}</td>
			</tr>
		`).join('');

		return `
			<!DOCTYPE html>
			<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<title>Extrato de Faturamento - ${clienteEsc}</title>
				<style>
					body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; font-size: 12px; }
					.header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
					h1 { font-size: 18px; margin: 0 0 4px 0; }
					h2 { font-size: 14px; margin: 18px 0 8px 0; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
					table { width: 100%; border-collapse: collapse; margin-top: 8px; }
					th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
					th { background: #f1f5f9; font-weight: 700; }
					.total-box { margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #94a3b8; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
					@media print { body { margin: 10mm; } }
				</style>
			</head>
			<body>
				<div class="header">
					<div>
						<h1>${nomeEmpresa}</h1>
						${cnpjEmpresa ? `<div>CNPJ: ${cnpjEmpresa}</div>` : ''}
						${telEmpresa ? `<div>Contato: ${telEmpresa}</div>` : ''}
					</div>
					<div style="text-align:right;">
						<strong>EXTRATO CONSOLIDADO DE FATURAMENTO</strong>
						<div>Cliente / Frota: <strong>${clienteEsc}</strong></div>
						<div>Período: ${periodoEsc}</div>
						<div>Emissão: ${this.formatarDataBR(this.getDataHojeISO())}</div>
					</div>
				</div>

				<h2>Resumo por Veículo / Placa</h2>
				<table>
					<thead>
						<tr>
							<th>Placa / Veículo</th>
							<th style="text-align:center;">Qtd. O.S.</th>
							<th style="text-align:right;">Subtotal</th>
						</tr>
					</thead>
					<tbody>${linhasPlacas || '<tr><td colspan="3">Sem itens</td></tr>'}</tbody>
				</table>

				<h2>Detalhamento das Ordens de Serviço</h2>
				<table>
					<thead>
						<tr>
							<th>O.S.</th>
							<th>Data</th>
							<th>Veículo / Placa</th>
							<th>Serviços Realizados</th>
							<th>Status</th>
							<th style="text-align:right;">Valor</th>
						</tr>
					</thead>
					<tbody>${linhasOrdens || '<tr><td colspan="6">Nenhuma O.S. selecionada</td></tr>'}</tbody>
				</table>

				<div class="total-box">
					<span>Total de Atendimentos: <strong>${(pedidosLista || []).length}</strong></span>
					<span>VALOR TOTAL CONSOLIDADO: <strong>R$ ${totalGeral.toFixed(2).replace('.', ',')}</strong></span>
				</div>
			</body>
			</html>
		`;
	},

	imprimirExtrato: function (clienteNome, pedidosLista, periodoTexto = '') {
		const html = this.gerarExtratoHTML(clienteNome, pedidosLista, periodoTexto);
		const frame = document.createElement('iframe');
		frame.style.position = 'fixed';
		frame.style.right = '0';
		frame.style.bottom = '0';
		frame.style.width = '0';
		frame.style.height = '0';
		frame.style.border = '0';
		document.body.appendChild(frame);

		const doc = frame.contentWindow ? frame.contentWindow.document : frame.contentDocument;
		doc.open();
		doc.write(html);
		doc.close();

		setTimeout(() => {
			try {
				frame.contentWindow.focus();
				frame.contentWindow.print();
			} finally {
				setTimeout(() => {
					if (frame.parentNode) frame.parentNode.removeChild(frame);
				}, 1500);
			}
		}, 250);
	},

	enviarResumoWhatsApp: function (clienteNome, telefone, pedidosLista) {
		const lista = pedidosLista || [];
		if (lista.length === 0) return;

		const config = (typeof BrandService !== 'undefined' && BrandService.getConfig)
			? BrandService.getConfig()
			: (JSON.parse(localStorage.getItem('config_negocio')) || {});
		const nomeEmpresa = config.nomeEstabelecimento || 'SEU NEGÓCIO';
		const chavePix = config.chavePix || config.pix || '';
		const total = lista.reduce((acc, p) => acc + (parseFloat(p.valor || 0) || 0), 0);

		const resumoPlacas = this.getResumoPorPlaca(lista)
			.slice(0, 12)
			.map(r => `- ${r.placa} (${r.qtdOrdens}x): R$ ${r.valorTotal.toFixed(2).replace('.', ',')}`)
			.join('\n');

		let msg = `*📄 EXTRATO DE FATURAMENTO - ${nomeEmpresa.toUpperCase()}*\n`;
		msg += `Cliente/Frota: *${clienteNome || 'Empresa'}*\n`;
		msg += `Qtd. O.S.: ${lista.length}\n`;
		msg += `------------------------------------\n`;
		msg += `${resumoPlacas}\n`;
		msg += `------------------------------------\n`;
		msg += `*TOTAL CONSOLIDADO: R$ ${total.toFixed(2).replace('.', ',')}*\n`;
		if (chavePix) {
			msg += `Chave PIX: ${chavePix}\n`;
		}
		msg += `Qualquer dúvida, estamos à disposição!`;

		if (typeof WhatsAppService !== 'undefined' && typeof WhatsAppService.abrirWhatsApp === 'function') {
			WhatsAppService.abrirWhatsApp(telefone || '', msg);
		} else {
			const fone = String(telefone || '').replace(/\D/g, '').replace(/^0+/, '');
			const telFmt = fone && fone.length <= 11 && !fone.startsWith('55') ? `55${fone}` : fone;
			const url = telFmt
				? `https://api.whatsapp.com/send?phone=${telFmt}&text=${encodeURIComponent(msg)}`
				: `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
			window.open(url, '_blank');
		}
	}
};

if (typeof window !== 'undefined') {
	window.FaturamentoService = FaturamentoService;
}
