// ==========================================================================
// Dashboard Principal do Lava Jato
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
	// Carrega dados do localStorage
	const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
	const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
	
	// Utiliza o CaixaService para obter o faturamento de hoje
	const statusHoje = CaixaService.getStatusHoje();
	const faturamentoHoje = statusHoje.totalValor || 0;

	// Carros em aberto no pátio
	const carrosPatio = pedidos.filter((p) => p.status === 'aberto');
	const pedidosEncerrados = pedidos.filter((p) => p.status === 'encerrado');

	// Atualiza KPIs
	const elCarrosPatio = document.getElementById('statCarrosPatio');
	const elFaturamentoHoje = document.getElementById('statFaturamentoHoje');
	const elTotalClientes = document.getElementById('statTotalClientes');
	const elTicketMedio = document.getElementById('statTicketMedio');

	if (elCarrosPatio) elCarrosPatio.textContent = carrosPatio.length;
	if (elFaturamentoHoje) elFaturamentoHoje.textContent = `R$ ${faturamentoHoje.toFixed(2)}`;
	if (elTotalClientes) elTotalClientes.textContent = clientes.length;

	// Ticket Médio
	const concluidosHoje = pedidosEncerrados.filter(p => (p.dataEncerramento || p.data) === statusHoje.dataAtual);
	const qtdConcluidos = concluidosHoje.length;
	const ticketMedio = qtdConcluidos > 0 ? (faturamentoHoje / qtdConcluidos) : (faturamentoHoje > 0 ? faturamentoHoje : 0);
	if (elTicketMedio) elTicketMedio.textContent = `R$ ${ticketMedio.toFixed(2)}`;

	// Atualiza Mostrador Velocímetro Bento de Metas
	const metaDiaria = 2000;
	const percMeta = Math.min(100, Math.round((faturamentoHoje / metaDiaria) * 100));
	const needleAngle = -90 + (percMeta / 100) * 180; // de -90deg a +90deg
	const needleEl = document.getElementById('speedometerNeedle');
	const arcEl = document.getElementById('speedometerArc');
	const gaugePercentEl = document.getElementById('gaugePercentText');

	if (gaugePercentEl) gaugePercentEl.textContent = `${percMeta}%`;
	if (needleEl) {
		setTimeout(() => {
			needleEl.style.transform = `rotate(${needleAngle}deg)`;
		}, 150);
	}
	if (arcEl) {
		const arcTotalLength = 251.2;
		const offset = arcTotalLength - (percMeta / 100) * arcTotalLength;
		setTimeout(() => {
			arcEl.style.strokeDashoffset = String(offset);
		}, 150);
	}

	// Adapta rótulos e subtítulos do Dashboard ao segmento configurado
	if (typeof BrandService !== 'undefined') {
		const visual = BrandService.getInfoVisual();
		const subtitleEl = document.querySelector('.page-subtitle');
		if (subtitleEl && visual.subtitulo) {
			subtitleEl.textContent = `Acompanhe atendimentos em andamento, faturamento diário e movimentação em ${visual.subtitulo}`;
		}

		// Atualiza ícone do card de atendimentos em aberto se não for lava jato
		const statIconAtendimento = document.querySelector('.stat-card .stat-icon.blue');
		if (statIconAtendimento) {
			statIconAtendimento.textContent = visual.icone;
		}

		const statLabelAtendimento = document.querySelector('.stat-card .stat-info .stat-label');
		if (statLabelAtendimento && visual.infoTipo) {
			statLabelAtendimento.textContent = `${visual.infoTipo.termoItem}s em Aberto`;
		}

		const acaoNovaOSIcon = document.querySelector('#acaoNovaOS .action-btn-icon');
		if (acaoNovaOSIcon) {
			acaoNovaOSIcon.textContent = visual.icone;
		}
	}

	// Tabela: Carros no Pátio Agora
	const corpoPatioDashboard = document.getElementById('corpoPatioDashboard');
	if (corpoPatioDashboard) {
		corpoPatioDashboard.innerHTML = '';
		if (carrosPatio.length === 0) {
			corpoPatioDashboard.innerHTML = `
				<tr>
					<td colspan="6" class="empty-table-message">
						🅿️ O pátio está livre no momento. Nenhum carro aguardando ou em lavagem.
					</td>
				</tr>
			`;
		} else {
			[...carrosPatio].reverse().slice(0, 5).forEach((p) => {
				const corObj = obterCorVeiculo(p.cor);
				const modeloTexto = p.modelo ? ` • ${p.modelo}` : '';
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>
						<div class="veiculo-info-cell">
							${renderizarIconeCarro(corObj, 28)}
							<div class="veiculo-meta">
								<span class="badge-placa">${p.placa || 'SEM PLACA'}</span>
								<span class="veiculo-cor-nome">${corObj.nome}${modeloTexto}</span>
							</div>
						</div>
					</td>
					<td><strong>${p.cliente || 'Não identificado'}</strong></td>
					<td>${p.data || '-'} <small style="color:var(--text-muted);">${p.horaEntrada ? 'às ' + p.horaEntrada : ''}</small></td>
					<td>${p.servicos || '-'}</td>
					<td><span class="badge-price">R$ ${parseFloat(p.valor || 0).toFixed(2)}</span></td>
					<td style="text-align: center;">
						<a href="pedidos.html" class="btn btn-sm" style="background-color: var(--success); color:#fff; padding: 4px 10px; font-size: 0.8rem;">
							💰 Encerrar
						</a>
					</td>
				`;
				corpoPatioDashboard.appendChild(tr);
			});
		}
	}

	// Tabela: Últimos Pagamentos e Entregas
	const corpoDashboardPedidos = document.getElementById('corpoDashboardPedidos');
	if (corpoDashboardPedidos) {
		corpoDashboardPedidos.innerHTML = '';
		if (pedidosEncerrados.length === 0) {
			corpoDashboardPedidos.innerHTML = `
				<tr>
					<td colspan="5" class="empty-table-message">
						Nenhuma entrega finalizada ainda.
					</td>
				</tr>
			`;
		} else {
			[...pedidosEncerrados].reverse().slice(0, 5).forEach((p) => {
				const corObj = obterCorVeiculo(p.cor);
				const modeloTexto = p.modelo ? ` • ${p.modelo}` : '';
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>
						<div class="veiculo-info-cell">
							${renderizarIconeCarro(corObj, 26)}
							<div class="veiculo-meta">
								<span class="badge-placa">${p.placa || 'SEM PLACA'}</span>
								<span class="veiculo-cor-nome">${corObj.nome}${modeloTexto}</span>
							</div>
						</div>
					</td>
					<td><strong>${p.cliente || 'Não identificado'}</strong></td>
					<td>${p.dataEncerramento || p.data || '-'}</td>
					<td><span class="badge-price">R$ ${parseFloat(p.valor || 0).toFixed(2)}</span></td>
					<td><span class="badge badge-payment">${p.formaPagamento || 'Outro'}</span></td>
				`;
				corpoDashboardPedidos.appendChild(tr);
			});
		}
	}
});
