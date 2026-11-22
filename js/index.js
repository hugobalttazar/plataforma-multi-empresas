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
	const podeVisualizarMetas = !userAtual || userAtual.isMaster || userAtual.username === 'admin' || (userAtual.permissoes && (userAtual.permissoes.includes('metas') || userAtual.permissoes.includes('configuracoes')));

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

	// Alerta de Contas a Pagar / Receber vencidas ou vencendo em breve
	const alertaContasEl = document.getElementById('alertaContasDashboard');
	const podeVerFinanceiro = !userAtual || userAtual.isMaster || userAtual.username === 'admin' ||
		(userAtual.permissoes && (userAtual.permissoes.includes('caixa') || userAtual.permissoes.includes('metas') || userAtual.permissoes.includes('configuracoes')));
	if (alertaContasEl && podeVerFinanceiro && typeof CaixaService !== 'undefined' && typeof CaixaService.getAlertasVencimento === 'function') {
		const infoAlertas = CaixaService.getAlertasVencimento(3);
		if (infoAlertas.qtdAlerta > 0) {
			const qtdVencidas = infoAlertas.vencidas.length;
			const qtdHoje = infoAlertas.vencendoHoje.length;
			const qtdProx = infoAlertas.proximosDias.length;
			const partesTexto = [];
			if (qtdVencidas > 0) partesTexto.push(`${qtdVencidas} vencida(s)`);
			if (qtdHoje > 0) partesTexto.push(`${qtdHoje} vence(m) hoje`);
			if (qtdProx > 0) partesTexto.push(`${qtdProx} nos próximos 3 dias`);

			const temVencida = qtdVencidas > 0;
			alertaContasEl.style.display = 'block';
			alertaContasEl.innerHTML = `
				<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-radius:var(--radius-sm); border:1px solid ${temVencida ? '#fecaca' : '#fde68a'}; background:${temVencida ? '#fef2f2' : '#fffbeb'}; color:${temVencida ? '#991b1b' : '#92400e'};">
					<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
						<span style="font-size:1.25rem;">${temVencida ? '🚨' : '⏰'}</span>
						<div>
							<strong style="display:block; font-size:0.92rem;">Alertas de Contas (${partesTexto.join(' • ')})</strong>
							<span style="font-size:0.84rem;">
								${infoAlertas.totalPagarAlerta > 0 ? `A pagar: <strong>R$ ${infoAlertas.totalPagarAlerta.toFixed(2)}</strong>` : ''}
								${infoAlertas.totalPagarAlerta > 0 && infoAlertas.totalReceberAlerta > 0 ? ' | ' : ''}
								${infoAlertas.totalReceberAlerta > 0 ? `A receber: <strong>R$ ${infoAlertas.totalReceberAlerta.toFixed(2)}</strong>` : ''}
							</span>
						</div>
					</div>
					<a href="caixa.html?aba=contas" class="btn btn-sm" style="background:${temVencida ? '#dc2626' : '#d97706'}; color:#ffffff; text-decoration:none; white-space:nowrap;">
						📅 Gerenciar Contas
					</a>
				</div>
			`;
		} else {
			alertaContasEl.style.display = 'none';
		}
	}

	// Onboarding Checklist (Primeiros Passos da Empresa)
	function renderOnboardingDashboard() {
		const containerOnboarding = document.getElementById('onboardingChecklistDashboard');
		if (!containerOnboarding || !window.SaasGuard) return;

		const empAtiva = window.EmpresaService?.getEmpresaAtiva?.();
		const empId = empAtiva?.id || userAtual?.empresaId || 'default';
		if (window.SaasGuard.isOnboardingDispensado(empId)) {
			containerOnboarding.style.display = 'none';
			return;
		}

		const configAtual = typeof BrandService !== 'undefined' ? BrandService.getConfig() : (JSON.parse(localStorage.getItem('config_negocio') || '{}'));
		const servicosAtuais = JSON.parse(localStorage.getItem('servicos')) || [];
		const clientesAtuais = JSON.parse(localStorage.getItem('clientes')) || [];
		const pedidosAtuais = JSON.parse(localStorage.getItem('pedidos')) || [];
		const agendamentosAtuais = JSON.parse(localStorage.getItem('agendamentos')) || [];

		const prog = window.SaasGuard.calcularProgressoOnboarding({
			config: configAtual,
			servicos: servicosAtuais,
			clientes: clientesAtuais,
			pedidos: pedidosAtuais,
			agendamentos: agendamentosAtuais
		});

		if (prog.completo) {
			containerOnboarding.style.display = 'none';
			return;
		}

		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		containerOnboarding.style.display = 'block';
		containerOnboarding.innerHTML = `
			<div class="content-card" style="margin-bottom: 0; border-left: 4px solid var(--primary);">
				<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
					<div>
						<strong style="font-size:1rem; color:var(--text-main);">🚀 Primeiros Passos no Sistema (${prog.concluidas}/${prog.total} concluídos)</strong>
						<p style="margin:2px 0 0; font-size:0.84rem; color:var(--text-muted);">Complete os itens abaixo para deixar seu estabelecimento pronto para operar.</p>
					</div>
					<button type="button" id="btnDispensarOnboarding" class="btn btn-secondary btn-sm" style="white-space:nowrap;">Ocultar guia</button>
				</div>
				<div style="height:8px; background:var(--border-color); border-radius:999px; overflow:hidden; margin-bottom:14px;">
					<div style="height:100%; width:${prog.percentual}%; background:var(--primary); transition:width 0.3s ease;"></div>
				</div>
				<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
					${prog.etapas.map((et) => `
						<div style="padding:10px 12px; border-radius:var(--radius-sm); border:1px solid ${et.concluida ? 'var(--success-border)' : 'var(--border-color)'}; background:${et.concluida ? 'var(--success-light)' : 'var(--bg-surface)'}; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
							<div>
								<div style="font-weight:700; font-size:0.88rem; color:${et.concluida ? 'var(--success)' : 'var(--text-main)'};">
									${et.concluida ? '✅' : '⬜'} ${esc(et.titulo)}
								</div>
								<small style="display:block; margin-top:3px; color:var(--text-muted); font-size:0.78rem;">${esc(et.descricao)}</small>
							</div>
							${et.concluida ? '' : `<a href="${esc(et.href)}" class="btn btn-secondary btn-sm" style="align-self:flex-start; text-decoration:none;">${esc(et.acaoTexto)} →</a>`}
						</div>
					`).join('')}
				</div>
			</div>
		`;

		const btnDisp = document.getElementById('btnDispensarOnboarding');
		if (btnDisp) {
			btnDisp.addEventListener('click', () => {
				window.SaasGuard.dispensarOnboarding(empId);
				containerOnboarding.style.display = 'none';
			});
		}
	}

	renderOnboardingDashboard();
	window.addEventListener('cloudDataChanged', (e) => {
		if (['config_negocio', 'servicos', 'clientes', 'pedidos', 'agendamentos'].includes(e?.detail)) {
			renderOnboardingDashboard();
		}
	});

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

	const isLavaJato = (typeof BrandService.isSegmentoAutomotivo === 'function')
		? BrandService.isSegmentoAutomotivo()
		: (!BrandService.getConfig || !BrandService.getConfig().tipoNegocio || BrandService.getConfig().tipoNegocio === 'lava_jato' || BrandService.getConfig().tipoNegocio === 'mecanica');

	// Helper de renderização de identificação (Placa x Foto)
	function renderIdentificacaoDashboard(p, isLavaJato, tamanho) {
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
		if (isLavaJato) {
			const corObj = obterCorVeiculo(p.cor);
			const modeloTexto = p.modelo ? ` • ${esc(p.modelo)}` : '';
			return `
				<div class="veiculo-info-cell">
					${renderizarIconeCarro(corObj, tamanho, p.veiculoTipo)}
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
					<td>${window.DateBR ? (window.DateBR.formatarParaBR(p.data) || '-') : (p.data || '-')} <small style="color:var(--text-muted);">${p.horaEntrada ? 'às ' + p.horaEntrada : ''}</small></td>
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
					<td>${window.DateBR ? (window.DateBR.formatarParaBR(p.dataEncerramento || p.data) || '-') : (p.dataEncerramento || p.data || '-')}</td>
					<td><span class="badge-price">R$ ${parseFloat(p.valor || 0).toFixed(2)}</span></td>
					<td><span class="badge badge-payment">${p.formaPagamento || 'Outro'}</span></td>
				`;
				corpoDashboardPedidos.appendChild(tr);
			});
		}
	}
});
