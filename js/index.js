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

	// --------------------------------------------------------------------------
	// Controle de Permissão & Mostrador Velocímetro Bento de Metas
	// --------------------------------------------------------------------------
	const cardSpeedometer = document.getElementById('cardSpeedometerMetas');
	const bentoGridPrincipal = document.querySelector('.bento-grid');

	// Verifica se o usuário autenticado possui a permissão 'metas' liberada
	const userAtual = window.AuthService ? window.AuthService.getCurrentUser() : null;
	const podeVisualizarMetas = !userAtual || userAtual.isMaster || userAtual.username === 'admin' || (userAtual.permissoes && userAtual.permissoes.includes('metas'));

	if (!podeVisualizarMetas) {
		if (cardSpeedometer) {
			cardSpeedometer.style.display = 'none';
		}
		if (bentoGridPrincipal) {
			bentoGridPrincipal.style.gridTemplateColumns = '1fr';
		}
	} else {
		if (cardSpeedometer) {
			cardSpeedometer.style.display = 'flex';
		}

		// Calcula a meta diária proporcional ao mês atual e aos dias úteis configurados
		let metaDiaria = 2000;
		let infoCalculo = null;
		if (typeof BrandService !== 'undefined' && typeof BrandService.calcularMetaDiaria === 'function') {
			infoCalculo = BrandService.calcularMetaDiaria();
			metaDiaria = infoCalculo.metaDiaria || 2000;
		}

		const metaTextoEl = document.getElementById('speedometerMetaText');
		if (metaTextoEl) {
			if (infoCalculo && infoCalculo.personalizada) {
				metaTextoEl.innerHTML = `Meta Diária: <strong>R$ ${metaDiaria.toFixed(2)}</strong> <span style="display:block; font-size:0.7rem; font-weight:normal; color:var(--text-muted);">(Meta: R$ ${infoCalculo.metaMensal.toFixed(2)} / ${infoCalculo.diasTrabalhoNoMes} dias)</span>`;
			} else {
				metaTextoEl.innerHTML = `Meta Diária: <strong>R$ ${metaDiaria.toFixed(2)}</strong>`;
			}
		}

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

	const isLavaJato = !BrandService.getConfig || !BrandService.getConfig().tipoNegocio || BrandService.getConfig().tipoNegocio === 'lava_jato';

	// Helper de renderização de identificação (Placa x Foto)
	function renderIdentificacaoDashboard(p, isLavaJato, tamanho) {
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		if (isLavaJato) {
			const corObj = obterCorVeiculo(p.cor);
			const modeloTexto = p.modelo ? ` • ${esc(p.modelo)}` : '';
			return `
				<div class="veiculo-info-cell">
					${renderizarIconeCarro(corObj, tamanho)}
					<div class="veiculo-meta">
						<span class="badge-placa">${esc(p.placa || 'SEM PLACA')}</span>
						<span class="veiculo-cor-nome">${esc(corObj.nome)}${modeloTexto}</span>
					</div>
				</div>
			`;
		}

		// Outro segmento: foto
		const cliObj = clientes.find(c => c.nome && c.nome.toLowerCase() === (p.cliente || '').toLowerCase());
		const fotoFinal = p.foto || (cliObj && cliObj.foto ? cliObj.foto : '');
		const itemTexto = p.itemDescricao || p.modelo || 'Atendimento';

		if (fotoFinal) {
			return `
				<div class="os-foto-cell">
					<div class="os-foto-thumbnail" style="background-image: url('${fotoFinal}'); width:${tamanho + 8}px; height:${tamanho + 8}px;" title="${esc(itemTexto)}"></div>
					<div class="os-foto-meta">
						<span class="os-foto-badge-tag">📸 ${esc(itemTexto)}</span>
						<span class="os-foto-item-nome">${esc(p.cliente || 'Cliente')}</span>
					</div>
				</div>
			`;
		}

		const iniciais = (p.cliente || 'CL').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
		return `
			<div class="os-foto-cell">
				<div class="os-foto-thumbnail sem-foto" style="width:${tamanho + 8}px; height:${tamanho + 8}px;">${iniciais}</div>
				<div class="os-foto-meta">
					<span class="os-foto-badge-tag" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">📋 ${esc(itemTexto)}</span>
					<span class="os-foto-item-nome">${esc(p.cliente || 'Cliente')}</span>
				</div>
			</div>
		`;
	}

	// Tabela: Carros no Pátio / Atendimentos Agora
	const corpoPatioDashboard = document.getElementById('corpoPatioDashboard');
	if (corpoPatioDashboard) {
		corpoPatioDashboard.innerHTML = '';
		if (carrosPatio.length === 0) {
			const msgLivre = isLavaJato 
				? '🅿️ O pátio está livre no momento. Nenhum carro aguardando ou em lavagem.'
				: '📋 Nenhum atendimento em andamento no momento.';
			corpoPatioDashboard.innerHTML = `
				<tr>
					<td colspan="6" class="empty-table-message">
						${msgLivre}
					</td>
				</tr>
			`;
		} else {
			[...carrosPatio].reverse().slice(0, 5).forEach((p) => {
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>
						${renderIdentificacaoDashboard(p, isLavaJato, 28)}
					</td>
					<td><strong>${p.cliente || 'Não identificado'}</strong></td>
					<td>${p.data || '-'} <small style="color:var(--text-muted);">${p.horaEntrada ? 'às ' + p.horaEntrada : ''}</small></td>
					<td>${p.servicos || '-'}</td>
					<td><span class="badge-price">R$ ${parseFloat(p.valor || 0).toFixed(2)}</span></td>
					<td style="text-align: center;">
						<a href="pedidos.html" class="btn btn-sm" style="background-color: var(--success); color:#fff; padding: 4px 10px; font-size: 0.8rem; font-weight:700;">
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
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td>
						${renderIdentificacaoDashboard(p, isLavaJato, 26)}
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
