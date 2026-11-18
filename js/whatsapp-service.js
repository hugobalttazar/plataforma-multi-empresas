/**
 * whatsapp-service.js
 * Centraliza a gestão de modelos de mensagens personalizadas do WhatsApp,
 * substituição dinâmica de etiquetas ({nome_cliente}, {veiculo}, {valor_total}, etc.)
 * e interface modal de pré-visualização/edição rápida antes do envio.
 */

const WhatsAppService = {
	STORAGE_KEY: 'config_mensagens_whatsapp',

	// Modelos Padrão de Fábrica
	MODELOS_PADRAO: {
		agendamento: {
			id: 'agendamento',
			nome: '📅 Agendamento & Lembrete de Horário',
			descricao: 'Enviado ao cliente ao confirmar ou lembrar um agendamento futuro no sistema.',
			template: `Olá {nome_cliente}! Confirmamos o seu agendamento no {nome_empresa}.\n📅 Data: {data_hora}\n🚗 Veículo: {veiculo} ({placa})\n🛠️ Serviços: {servicos}\n💰 Valor previsto: {valor_total}\n\n📅 Salve na sua Agenda Google: {link_agenda}\n\nAguardamos você!`
		},
		pronto: {
			id: 'pronto',
			nome: '🚗 Conclusão de Serviço & Veículo Pronto',
			descricao: 'Enviado na tela de Pedidos/Pátio avisando o cliente que o veículo está pronto para retirada.',
			template: `Olá {nome_cliente}! 🚗✨\n\nSeu veículo {veiculo} ({placa}) já foi finalizado e está pronto para retirada no {nome_empresa}!\n\n🛠️ Serviços realizados: {servicos}\n💰 Valor total: {valor_total}\n\nAguardamos você!`
		},
		recibo: {
			id: 'recibo',
			nome: '🧾 Comprovante de Pagamento & Recibo',
			descricao: 'Enviado após o pagamento da O.S. no Caixa ou Histórico como comprovante digital.',
			template: `*🧾 COMPROVANTE DE PAGAMENTO / RECIBO*\n*{nome_empresa}*\n📞 Contato: {telefone_empresa}\n------------------------------------\n*O.S.:* #{numero_os}\n*Data/Hora:* {data_hora}\n*Cliente:* {nome_cliente}\n*Item/Veículo:* {veiculo} ({placa})\n*Serviços:* {servicos}\n------------------------------------\n*VALOR TOTAL:* {valor_total}\n*Forma de Pagamento:* {forma_pagamento}\n*Status:* QUITADO / PAGO ✅\n------------------------------------\n_Obrigado pela preferência! Volte sempre._`
		},
		fidelidade: {
			id: 'fidelidade',
			nome: '⭐ Reativação & Programa Fidelidade',
			descricao: 'Enviado na tela de Fidelidade para clientes ausentes ou para informar saldo de selos/pontos.',
			template: `Olá {nome_cliente}! Tudo bem? 😊\n\nNotamos que já faz {dias_sem_visita} dias desde a última visita do seu {veiculo} ({placa}) no {nome_empresa}.\n\nQue tal renovar os cuidados e a proteção esta semana?\n🎁 Seu saldo de fidelidade: {saldo_fidelidade}!\n\nPodemos reservar um horário para você?`
		}
	},

	// Dicionário de tags disponíveis para cada contexto
	TAGS_DISPONIVEIS: [
		{ tag: '{nome_cliente}', desc: 'Nome completo do cliente' },
		{ tag: '{primeiro_nome}', desc: 'Primeiro nome do cliente' },
		{ tag: '{veiculo}', desc: 'Modelo do veículo (ex: Civic)' },
		{ tag: '{placa}', desc: 'Placa do veículo' },
		{ tag: '{data_hora}', desc: 'Data e horário formatados' },
		{ tag: '{servicos}', desc: 'Serviços prestados/agendados' },
		{ tag: '{valor_total}', desc: 'Valor em reais (ex: R$ 80,00)' },
		{ tag: '{numero_os}', desc: 'Número da O.S. ou Recibo' },
		{ tag: '{forma_pagamento}', desc: 'Forma de pagamento (ex: Pix)' },
		{ tag: '{chave_pix}', desc: 'Chave PIX da empresa' },
		{ tag: '{nome_empresa}', desc: 'Nome do seu estabelecimento' },
		{ tag: '{telefone_empresa}', desc: 'Telefone comercial da empresa' },
		{ tag: '{link_agenda}', desc: 'Link direto do Google Calendar' },
		{ tag: '{dias_sem_visita}', desc: 'Dias ausente (Fidelidade)' },
		{ tag: '{saldo_fidelidade}', desc: 'Selos ou pontos acumulados' }
	],

	/**
	 * Obtém todos os templates personalizados salvos ou padrões
	 */
	getTemplates: function () {
		try {
			const salvo = localStorage.getItem(this.STORAGE_KEY);
			if (salvo) {
				const parsed = JSON.parse(salvo);
				return {
					agendamento: { ...this.MODELOS_PADRAO.agendamento, ...parsed.agendamento },
					pronto: { ...this.MODELOS_PADRAO.pronto, ...parsed.pronto },
					recibo: { ...this.MODELOS_PADRAO.recibo, ...parsed.recibo },
					fidelidade: { ...this.MODELOS_PADRAO.fidelidade, ...parsed.fidelidade }
				};
			}
		} catch (e) {
			console.error('Erro ao ler modelos de mensagens do WhatsApp:', e);
		}
		return JSON.parse(JSON.stringify(this.MODELOS_PADRAO));
	},

	/**
	 * Salva os templates personalizados no armazenamento local e nuvem
	 */
	saveTemplates: function (novosModelos) {
		const paraSalvar = {};
		Object.keys(this.MODELOS_PADRAO).forEach(tipo => {
			paraSalvar[tipo] = {
				id: tipo,
				nome: this.MODELOS_PADRAO[tipo].nome,
				descricao: this.MODELOS_PADRAO[tipo].descricao,
				template: (novosModelos[tipo] && typeof novosModelos[tipo].template === 'string')
					? novosModelos[tipo].template.trim()
					: this.MODELOS_PADRAO[tipo].template
			};
		});

		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(paraSalvar));
		if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
			try {
				window.dispatchEvent(new CustomEvent('cloudDataChanged', { detail: this.STORAGE_KEY }));
			} catch (e) {}
		}
		return paraSalvar;
	},

	/**
	 * Restaura o template padrão de um tipo específico
	 */
	resetTemplate: function (tipo) {
		const templates = this.getTemplates();
		if (this.MODELOS_PADRAO[tipo]) {
			templates[tipo] = JSON.parse(JSON.stringify(this.MODELOS_PADRAO[tipo]));
			this.saveTemplates(templates);
		}
		return templates[tipo];
	},

	/**
	 * Restaura todos os modelos para o padrão de fábrica
	 */
	resetAll: function () {
		const padroes = JSON.parse(JSON.stringify(this.MODELOS_PADRAO));
		this.saveTemplates(padroes);
		return padroes;
	},

	/**
	 * Gera o texto final renderizado a partir de um tipo de modelo e dados
	 */
	gerarMensagemFinal: function (tipo, dados, opcoes = {}) {
		const templates = this.getTemplates();
		const modelo = templates[tipo] || this.MODELOS_PADRAO[tipo];
		const templateStr = modelo ? modelo.template : '';
		return this.substituirVariaveis(templateStr, dados, opcoes);
	},

	/**
	 * Substitui dinamicamente as variáveis no texto informado
	 */
	substituirVariaveis: function (templateTexto, dados = {}, opcoes = {}) {
		if (!templateTexto) return '';
		let texto = templateTexto;

		// 1. Dados da Empresa
		let configEmpresa = {};
		if (typeof window.BrandService !== 'undefined' && window.BrandService.getConfig) {
			configEmpresa = window.BrandService.getConfig() || {};
		} else {
			try {
				configEmpresa = JSON.parse(localStorage.getItem('config_negocio')) || {};
			} catch (e) {
				configEmpresa = {};
			}
		}

		const nomeEmpresa = configEmpresa.nomeEstabelecimento || 'Danilo Detailer';
		const telEmpresa = configEmpresa.telefone || '';
		const chavePix = configEmpresa.chavePix || configEmpresa.pix || '';

		// 2. Tratamento do Cliente
		const nomeCompleto = dados.clienteNome || dados.cliente || (dados.cliente && dados.cliente.nome) || 'Cliente';
		const primeiroNome = (nomeCompleto || '').trim().split(' ')[0] || 'Cliente';

		// 3. Tratamento do Veículo
		const veiculo = dados.modelo || dados.veiculo || (dados.ultimoPedido && dados.ultimoPedido.modelo) || 'Veículo';
		const placa = dados.placa || (dados.ultimoPedido && dados.ultimoPedido.placa) || 'Sem placa';

		// 4. Data e Hora
		const fmtData = (d) => (window.DateBR ? window.DateBR.formatarParaBR(d) : d);
		let dataHoraFormatada = '';
		if (dados.data && dados.hora) {
			dataHoraFormatada = `${fmtData(dados.data)} às ${dados.hora}`;
		} else if (dados.data) {
			dataHoraFormatada = `${fmtData(dados.data)}`;
		} else if (dados.dataEncerramento) {
			dataHoraFormatada = `${fmtData(dados.dataEncerramento)}${dados.horaEncerramento ? ' às ' + dados.horaEncerramento : ''}`;
		} else {
			const agora = new Date();
			dataHoraFormatada = agora.toLocaleDateString('pt-BR');
		}

		// 5. Serviços e Valor
		const servicos = dados.servicos || 'Serviços Automotivos';
		const numValor = parseFloat(dados.valor || 0);
		const valorFormatado = `R$ ${numValor.toFixed(2).replace('.', ',')}`;

		// 6. Número da O.S.
		const numOS = (dados.id || dados.numeroOS || '').toString().replace(/^os_/, '').slice(-6) || '000001';

		// 7. Link Calendar
		let linkAgenda = dados.linkAgenda || '';
		if (!linkAgenda && typeof window.GoogleCalendarService !== 'undefined' && window.GoogleCalendarService.gerarLinkWebCalendar) {
			try {
				linkAgenda = window.GoogleCalendarService.gerarLinkWebCalendar(dados);
			} catch (e) {}
		}

		// 8. Fidelidade
		const diasSemVisita = dados.diasSemVisita || 'vários';
		let saldoFidelidade = '';
		if (dados.progressoFidelidade) {
			saldoFidelidade = `${dados.progressoFidelidade.selosAtuais}/${dados.progressoFidelidade.metaSelos} selos acumulados`;
		} else if (dados.saldoFidelidade) {
			saldoFidelidade = dados.saldoFidelidade;
		} else {
			saldoFidelidade = 'Pontos disponíveis';
		}

		// Opções de exclusão sob demanda (Ideia 2: switches no modal)
		if (opcoes.incluirValor === false) {
			// Remove a tag e limpa linhas que continham apenas informação de preço
			texto = texto.split('\n').filter(linha => !linha.includes('{valor_total}')).join('\n');
		}
		if (opcoes.incluirPix === false) {
			texto = texto.split('\n').filter(linha => !linha.includes('{chave_pix}')).join('\n');
		}
		if (opcoes.incluirAgenda === false) {
			texto = texto.split('\n').filter(linha => !linha.includes('{link_agenda}')).join('\n');
		}

		// Substituição das Tags
		const mapa = {
			'{nome_cliente}': nomeCompleto,
			'{primeiro_nome}': primeiroNome,
			'{veiculo}': veiculo,
			'{placa}': placa,
			'{data_hora}': dataHoraFormatada,
			'{data}': (dados.data || '').toString(),
			'{hora}': (dados.hora || '').toString(),
			'{servicos}': servicos,
			'{valor_total}': valorFormatado,
			'{numero_os}': numOS,
			'{forma_pagamento}': (dados.formaPagamento || 'Pix').toUpperCase(),
			'{chave_pix}': chavePix ? `Chave PIX: ${chavePix}` : '',
			'{nome_empresa}': nomeEmpresa,
			'{telefone_empresa}': telEmpresa,
			'{link_agenda}': linkAgenda || '',
			'{dias_sem_visita}': diasSemVisita,
			'{saldo_fidelidade}': saldoFidelidade
		};

		Object.keys(mapa).forEach(tag => {
			texto = texto.split(tag).join(mapa[tag]);
		});

		// Remove quebras duplas desnecessárias deixadas por linhas removidas
		texto = texto.replace(/\n{3,}/g, '\n\n').trim();

		return texto;
	},

	/**
	 * Gera a mensagem final pronta para envio a partir do tipo e dados
	 */
	gerarMensagem: function (tipo, dados = {}, opcoes = {}) {
		const templates = this.getTemplates();
		const modelo = templates[tipo] || this.MODELOS_PADRAO[tipo];
		if (!modelo) return '';
		return this.substituirVariaveis(modelo.template, dados, opcoes);
	},

	/**
	 * Sanitiza número de telefone para o padrão WhatsApp Brasil (55 + DDD + Número)
	 */
	limparTelefone: function (telBruto) {
		if (!telBruto) return '';
		let tel = telBruto.toString().replace(/\D/g, '');
		if (!tel) return '';
		if (tel.length >= 10 && tel.length <= 11 && !tel.startsWith('55')) {
			tel = '55' + tel;
		}
		return tel;
	},

	/**
	 * Gera o link URL para abertura no WhatsApp
	 */
	gerarLinkWhatsApp: function (telefone, textoMensagem) {
		const telLimpo = this.limparTelefone(telefone);
		const textoEncoded = encodeURIComponent(textoMensagem || '');
		if (telLimpo) {
			return `https://wa.me/${telLimpo}?text=${textoEncoded}`;
		}
		return `https://api.whatsapp.com/send?text=${textoEncoded}`;
	},

	/**
	 * Disparo direto para o WhatsApp (Web ou App)
	 */
	abrirWhatsApp: function (telefone, textoMensagem) {
		const url = this.gerarLinkWhatsApp(telefone, textoMensagem);
		if (typeof window !== 'undefined' && typeof window.open === 'function') {
			window.open(url, '_blank');
		}
		return url;
	},

	// =========================================================================
	// IDEIA 2: MODAL DE PRÉ-VISUALIZAÇÃO E EDIÇÃO RÁPIDA ANTES DO ENVIO
	// =========================================================================

	/**
	 * Abre o modal de disparo interativo. Permite ao usuário:
	 * - Ver o texto renderizado
	 * - Marcar/desmarcar checkboxes rápidos (ex: tirar o valor na hora)
	 * - Editar qualquer frase do texto antes de enviar
	 * - Copiar para área de transferência ou disparar direto no WhatsApp
	 */
	abrirModalDisparo: function ({ tipo = 'agendamento', dados = {}, telefone = '', titulo = '' }) {
		this._fecharModalDisparoExistente();

		const templates = this.getTemplates();
		const modelo = templates[tipo] || this.MODELOS_PADRAO[tipo] || { nome: 'Mensagem WhatsApp', template: '' };

		// Garante telefone limpo
		let telInicial = telefone || dados.clienteTelefone || dados.telefone || '';
		if (!telInicial && dados.cliente) {
			try {
				const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
				const cliEncontrado = clientes.find(c => c.nome && c.nome.trim().toLowerCase() === (dados.cliente || '').trim().toLowerCase());
				if (cliEncontrado && cliEncontrado.tel1) telInicial = cliEncontrado.tel1;
			} catch (e) {}
		}

		const clienteNome = dados.clienteNome || dados.cliente || (dados.cliente && dados.cliente.nome) || 'Cliente';

		// Estado inicial das opções
		const opcoes = {
			incluirValor: true,
			incluirPix: true,
			incluirAgenda: true
		};

		// Cria a estrutura DOM do modal
		const backdrop = document.createElement('div');
		backdrop.id = 'modalDisparoWhatsAppBackdrop';
		backdrop.className = 'modal-backdrop';
		backdrop.style.zIndex = '99999';

		backdrop.innerHTML = `
			<div class="modal-dialog modal-dialog-whatsapp" style="max-width: 620px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
				<div class="modal-header" style="background: #075e54; color: #ffffff; padding: 14px 20px; border-bottom: none;">
					<div style="display: flex; align-items: center; gap: 10px;">
						<span style="font-size: 1.4rem;">💬</span>
						<div>
							<h3 class="modal-title" style="color: #ffffff; font-size: 1.05rem; font-weight: 700; margin: 0;">
								${titulo || 'Enviar Mensagem via WhatsApp'}
							</h3>
							<small style="color: #a7f3d0; font-size: 0.78rem;">${modelo.nome}</small>
						</div>
					</div>
					<button type="button" class="btn-close-modal" id="btnFecharModalWhatsApp" style="color: #ffffff; opacity: 0.9;">✕</button>
				</div>

				<div class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; background: #f8fafc;">
					
					<!-- Destinatário e Telefone -->
					<div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: #ffffff; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
						<div style="flex: 1; min-width: 180px;">
							<label style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Destinatário</label>
							<div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">👤 ${clienteNome}</div>
						</div>
						<div style="flex: 1; min-width: 180px;">
							<label for="inputWppTelefone" style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">WhatsApp do Cliente</label>
							<div style="display: flex; align-items: center; gap: 6px;">
								<span style="font-size: 0.85rem; font-weight: 700; color: #059669;">+55</span>
								<input type="tel" id="inputWppTelefone" value="${telInicial.replace(/\D/g, '').replace(/^55/, '')}" placeholder="DDD + Número (ex: 11988887777)" style="flex: 1; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.88rem; font-weight: 600;" />
							</div>
						</div>
					</div>

					<!-- Filtros / Switches Rápidos -->
					<div style="background: #ffffff; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
						<span style="font-size: 0.8rem; font-weight: 700; color: #475569;">Filtros de Envio:</span>
						
						<label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; color: #334155; font-weight: 600;">
							<input type="checkbox" id="chkIncluirValor" ${opcoes.incluirValor ? 'checked' : ''} style="accent-color: #16a34a; width: 16px; height: 16px;" />
							<span>💰 Incluir Preço / Valor</span>
						</label>

						${tipo === 'agendamento' ? `
							<label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; color: #334155; font-weight: 600;">
								<input type="checkbox" id="chkIncluirAgenda" ${opcoes.incluirAgenda ? 'checked' : ''} style="accent-color: #16a34a; width: 16px; height: 16px;" />
								<span>📅 Link Google Calendar</span>
							</label>
						` : ''}

						<label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; color: #334155; font-weight: 600;">
							<input type="checkbox" id="chkIncluirPix" ${opcoes.incluirPix ? 'checked' : ''} style="accent-color: #16a34a; width: 16px; height: 16px;" />
							<span>🔑 Incluir Chave PIX</span>
						</label>
					</div>

					<!-- Edição do Texto -->
					<div>
						<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
							<label for="textareaWppMensagem" style="font-size: 0.82rem; font-weight: 700; color: #334155;">
								✏️ Conteúdo da Mensagem (Você pode editar antes de enviar):
							</label>
							<span id="contadorCaracteresWpp" style="font-size: 0.75rem; color: #64748b;">0 caracteres</span>
						</div>
						<textarea id="textareaWppMensagem" rows="7" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.88rem; line-height: 1.45; resize: vertical; box-sizing: border-box; background: #ffffff;"></textarea>
					</div>

					<!-- Prévia Balão WhatsApp -->
					<div>
						<div style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
							👁️ Como o cliente verá no celular:
						</div>
						<div style="background: #e5ddd5; background-image: radial-gradient(#d1c7bc 1px, transparent 1px); background-size: 16px 16px; padding: 14px; border-radius: 8px; display: flex; justify-content: flex-end;">
							<div style="background: #dcf8c6; color: #111827; padding: 10px 12px; border-radius: 8px 0px 8px 8px; max-width: 88%; box-shadow: 0 1px 2px rgba(0,0,0,0.15); font-size: 0.85rem; line-height: 1.4; word-break: break-word; position: relative;">
								<div id="previewBalaoWpp" style="white-space: pre-wrap;"></div>
								<div style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-top: 4px; font-size: 0.7rem; color: #667781;">
									<span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									<span style="color: #34b7f1; font-weight: bold;">✓✓</span>
								</div>
							</div>
						</div>
					</div>

				</div>

				<div class="modal-footer" style="background: #ffffff; padding: 12px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
					<div style="display: flex; gap: 8px;">
						<button type="button" class="btn btn-secondary" id="btnCopiarTextoWpp" style="font-size: 0.85rem; padding: 8px 12px; display: inline-flex; align-items: center; gap: 6px;">
							<span>📋</span>
							<span id="labelCopiarWpp">Copiar Texto</span>
						</button>
						<a href="configuracoes.html?aba=mensagens" class="btn btn-secondary" style="font-size: 0.85rem; padding: 8px 12px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;" title="Editar modelos permanentes em Configurações">
							<span>⚙️</span>
							<span>Ajustar Padrão</span>
						</a>
					</div>

					<div style="display: flex; gap: 8px;">
						<button type="button" class="btn btn-secondary" id="btnCancelarWpp" style="font-size: 0.85rem; padding: 8px 14px;">
							Cancelar
						</button>
						<button type="button" class="btn btn-primary" id="btnDispararWpp" style="background: #25d366; border-color: #16a34a; font-weight: 700; font-size: 0.9rem; padding: 8px 18px; display: inline-flex; align-items: center; gap: 8px; color: #ffffff;">
							<span>🚀</span>
							<span>Enviar para o WhatsApp</span>
						</button>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(backdrop);

		const txtArea = backdrop.querySelector('#textareaWppMensagem');
		const balao = backdrop.querySelector('#previewBalaoWpp');
		const contador = backdrop.querySelector('#contadorCaracteresWpp');
		const inputTel = backdrop.querySelector('#inputWppTelefone');
		const chkValor = backdrop.querySelector('#chkIncluirValor');
		const chkPix = backdrop.querySelector('#chkIncluirPix');
		const chkAgenda = backdrop.querySelector('#chkIncluirAgenda');

		// Função para atualizar o texto base a partir das opções marcadas
		const recalcularTexto = () => {
			opcoes.incluirValor = chkValor ? chkValor.checked : true;
			opcoes.incluirPix = chkPix ? chkPix.checked : true;
			opcoes.incluirAgenda = chkAgenda ? chkAgenda.checked : true;

			const textoRenderizado = this.substituirVariaveis(modelo.template, dados, opcoes);
			txtArea.value = textoRenderizado;
			atualizarPreviewBalao();
		};

		// Função para atualizar a bolha de pré-visualização ao digitar
		const atualizarPreviewBalao = () => {
			const texto = txtArea.value || '';
			contador.textContent = `${texto.length} caracteres`;
			
			// Converte formatação básica do WhatsApp (*negrito*, _itálico_) para HTML seguro na prévia
			let html = this._escaparHtml(texto)
				.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
				.replace(/_(.*?)_/g, '<em>$1</em>');
			balao.innerHTML = html;
		};

		// Eventos dos checkboxes
		if (chkValor) chkValor.addEventListener('change', recalcularTexto);
		if (chkPix) chkPix.addEventListener('change', recalcularTexto);
		if (chkAgenda) chkAgenda.addEventListener('change', recalcularTexto);

		// Evento de digitação na caixa de texto
		txtArea.addEventListener('input', atualizarPreviewBalao);

		// Inicializa o conteúdo
		recalcularTexto();

		// Ações dos botões
		const fechar = () => this._fecharModalDisparoExistente();
		backdrop.querySelector('#btnFecharModalWhatsApp').addEventListener('click', fechar);
		backdrop.querySelector('#btnCancelarWpp').addEventListener('click', fechar);
		
		backdrop.addEventListener('click', (e) => {
			if (e.target === backdrop) fechar();
		});

		// Copiar Texto
		const btnCopiar = backdrop.querySelector('#btnCopiarTextoWpp');
		const labelCopiar = backdrop.querySelector('#labelCopiarWpp');
		btnCopiar.addEventListener('click', () => {
			const texto = txtArea.value;
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(texto).then(() => {
					labelCopiar.textContent = 'Copiado!';
					setTimeout(() => { labelCopiar.textContent = 'Copiar Texto'; }, 2000);
				}).catch(() => {});
			} else {
				txtArea.select();
				document.execCommand('copy');
				labelCopiar.textContent = 'Copiado!';
				setTimeout(() => { labelCopiar.textContent = 'Copiar Texto'; }, 2000);
			}
		});

		// Enviar para o WhatsApp
		backdrop.querySelector('#btnDispararWpp').addEventListener('click', () => {
			const textoFinal = txtArea.value;
			const telFinal = inputTel.value.trim();
			this.abrirWhatsApp(telFinal, textoFinal);
			fechar();
		});

		// Tecla ESC fecha modal
		const escListener = (e) => {
			if (e.key === 'Escape') {
				fechar();
				window.removeEventListener('keydown', escListener);
			}
		};
		window.addEventListener('keydown', escListener);
	},

	_fecharModalDisparoExistente: function () {
		const modalAntigo = document.getElementById('modalDisparoWhatsAppBackdrop');
		if (modalAntigo && modalAntigo.parentNode) {
			modalAntigo.parentNode.removeChild(modalAntigo);
		}
	},

	_escaparHtml: function (str) {
		if (!str) return '';
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}
};

window.WhatsAppService = WhatsAppService;
