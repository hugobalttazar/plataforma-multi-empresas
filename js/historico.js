// ==========================================================================
// Histórico de Atendimentos por Cliente
// ==========================================================================

const params = new URLSearchParams(window.location.search);
const clienteNome = params.get('cliente') || '';

const elClienteNome = document.getElementById('clienteNome');
const elTotalVisitas = document.getElementById('clienteTotalVisitas');
const elTotalGasto = document.getElementById('clienteTotalGasto');
const tabelaCorpo = document.querySelector('#historicoTable tbody');

if (clienteNome) {
	elClienteNome.textContent = `Cliente: ${clienteNome}`;
} else {
	elClienteNome.textContent = 'Nenhum cliente selecionado';
}

// Pegar pedidos do localStorage
const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];

// Filtrar pedidos do cliente
const historico = clienteNome
	? pedidos.filter(
			(p) =>
				p.cliente &&
				p.cliente.trim().toLowerCase() === clienteNome.trim().toLowerCase()
	  )
	: [];

// Métricas do cliente
let totalGasto = 0;
historico.forEach((p) => {
	// Apenas pedidos encerrados contam para o total efetivamente pago
	if (!p.status || p.status === 'encerrado') {
		totalGasto += parseFloat(p.valor || 0);
	}
});

if (elTotalVisitas) {
	elTotalVisitas.textContent = historico.length;
}

if (elTotalGasto) {
	elTotalGasto.textContent = `R$ ${totalGasto.toFixed(2)}`;
}

// Preencher tabela
tabelaCorpo.innerHTML = '';

if (historico.length === 0) {
	tabelaCorpo.innerHTML = `
		<tr>
			<td colspan="6" class="empty-table-message">
				Nenhum atendimento registrado para este cliente ainda.
			</td>
		</tr>
	`;
} else {
	const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
	// Exibir mais recentes primeiro
	[...historico].reverse().forEach((p) => {
		const corObj = obterCorVeiculo(p.cor);
		const modeloTexto = p.modelo ? ` • ${esc(p.modelo)}` : '';
		const tr = document.createElement('tr');
		const valorFormatado = parseFloat(p.valor || 0).toFixed(2);
		const estaAberto = p.status === 'aberto';

		const statusBadge = estaAberto
			? '<span class="badge badge-status badge-status-aberto">No Pátio</span>'
			: '<span class="badge badge-status badge-status-encerrado">Encerrado</span>';

		const dataTexto = estaAberto
			? `${esc(p.data || '-')} <small style="color:var(--text-muted);">${p.horaEntrada ? 'às ' + esc(p.horaEntrada) : ''}</small>`
			: `${esc(p.dataEncerramento || p.data || '-')} <small style="color:var(--text-muted);">${p.horaEncerramento ? 'às ' + esc(p.horaEncerramento) : ''}</small>`;

		const pagamentoTexto = estaAberto
			? '<span style="color:var(--text-muted); font-size:0.85rem;">Aguardando saída</span>'
			: `<span class="badge badge-payment">${esc(p.formaPagamento || 'Outro')}</span>`;

		const acaoRecibo = estaAberto
			? '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>'
			: `<button type="button" class="btn btn-sm btn-recibo-os" data-id="${p.id}" title="Ver e Imprimir Recibo Estilo Cupom Fiscal">🧾 Recibo</button>`;

		tr.innerHTML = `
			<td>
				<div class="veiculo-info-cell">
					${renderizarIconeCarro(corObj, 28)}
					<div class="veiculo-meta">
						<span class="badge-placa">${esc(p.placa || 'SEM PLACA')}</span>
						<span class="veiculo-cor-nome">${esc(corObj.nome)}${modeloTexto}</span>
					</div>
				</div>
			</td>
			<td>${dataTexto}</td>
			<td>${esc(p.servicos || '-')}</td>
			<td><span class="badge-price">R$ ${valorFormatado}</span></td>
			<td>${statusBadge}</td>
			<td>${pagamentoTexto}</td>
			<td style="text-align: center;">${acaoRecibo}</td>
		`;
		tabelaCorpo.appendChild(tr);
	});

	// Vincular eventos de Visualizar/Imprimir Recibo
	document.querySelectorAll('.btn-recibo-os').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const osId = e.currentTarget.getAttribute('data-id');
			abrirModalRecibo(osId);
		});
	});
}

// Modal de Recibo Cupom Fiscal no Histórico
const modalRecibo = document.getElementById('modalRecibo');
const modalReciboConteudo = document.getElementById('modalReciboConteudo');
const modalReciboTitulo = document.getElementById('modalReciboTitulo');
const modalReciboFecharBtn = document.getElementById('modalReciboFecharBtn');
const modalReciboFecharInferiorBtn = document.getElementById('modalReciboFecharInferiorBtn');
const modalReciboImprimirBtn = document.getElementById('modalReciboImprimirBtn');
const modalReciboBaixarBtn = document.getElementById('modalReciboBaixarBtn');

let pedidoSelecionadoParaRecibo = null;

function abrirModalRecibo(osId) {
	const todosPedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	const p = todosPedidos.find((item) => item.id === osId);
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
