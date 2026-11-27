const inputNome = document.querySelector('#clienteNome');
const inputTelefone1 = document.querySelector('#telefone1');
const inputTelefone2 = document.querySelector('#telefone2');
const inputWhatsApp1 = document.querySelector('#whatsapp1');
const inputWhatsApp2 = document.querySelector('#whatsapp2');
const inputEndereco = document.querySelector('#endereco');
const formCardTitle = document.querySelector('#formCardTitle');
const btnCancelarEdicao = document.querySelector('#btnCancelarEdicao');
const btnSalvar = document.querySelector('#btnSalvarCliente');

// Elementos de Foto do Cliente
const clienteFotoInput = document.querySelector('#clienteFotoInput');
const btnEscolherFotoCliente = document.querySelector('#btnEscolherFotoCliente');
const btnRemoverFotoCliente = document.querySelector('#btnRemoverFotoCliente');
const clienteFotoPreviewImg = document.querySelector('#clienteFotoPreviewImg');
const clienteFotoPlaceholderIcon = document.querySelector('#clienteFotoPlaceholderIcon');

let fotoBase64Atual = ''; // Armazena a foto compactada em base64
let veiculosEmEdicao = []; // Lista de veículos do cliente no formulário atual
let veiculoEditIndex = null;

function isAutomotivoAtivo() {
	if (typeof BrandService !== 'undefined' && typeof BrandService.isSegmentoAutomotivo === 'function') {
		return BrandService.isSegmentoAutomotivo();
	}
	return true;
}

function normalizarPlacaCliente(placa) {
	if (typeof normalizarPlaca === 'function') return normalizarPlaca(placa);
	return (placa || '').toString().toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
}

// Função de compressão de imagem via HTML5 Canvas (max 260x260, JPEG 82%)
function compactarImagemParaBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const maxDim = 260;
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

				// Converte para JPEG 0.82 (geralmente ~15kb a 25kb)
				const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
				resolve(dataUrl);
			};
			img.onerror = reject;
			img.src = e.target.result;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function setFotoPreview(dataUrl) {
	fotoBase64Atual = dataUrl || '';
	if (fotoBase64Atual) {
		if (clienteFotoPreviewImg) {
			clienteFotoPreviewImg.src = fotoBase64Atual;
			clienteFotoPreviewImg.style.display = 'block';
		}
		if (clienteFotoPlaceholderIcon) clienteFotoPlaceholderIcon.style.display = 'none';
		if (btnRemoverFotoCliente) btnRemoverFotoCliente.style.display = 'inline-flex';
	} else {
		if (clienteFotoPreviewImg) {
			clienteFotoPreviewImg.src = '';
			clienteFotoPreviewImg.style.display = 'none';
		}
		if (clienteFotoPlaceholderIcon) clienteFotoPlaceholderIcon.style.display = 'block';
		if (btnRemoverFotoCliente) btnRemoverFotoCliente.style.display = 'none';
	}
}

// Função utilitária para aplicar máscara de telefone (00) 00000-0000 ou (00) 0000-0000
function mascararTelefone(input) {
	if (!input) return;
	input.addEventListener('input', (e) => {
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

document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('clienteForm');
	const tabela = document.querySelector('#clientesTable tbody');
	let editIndex = null; // Índice do cliente a ser editado

	mascararTelefone(inputTelefone1);
	mascararTelefone(inputTelefone2);

	// Setup do uploader de foto
	if (btnEscolherFotoCliente && clienteFotoInput) {
		btnEscolherFotoCliente.addEventListener('click', () => {
			clienteFotoInput.click();
		});

		clienteFotoInput.addEventListener('change', async (e) => {
			const file = e.target.files && e.target.files[0];
			if (!file) return;

			try {
				const compressed = await compactarImagemParaBase64(file);
				setFotoPreview(compressed);
				if (window.UI) window.UI.toast('Foto carregada com sucesso!', 'info');
			} catch (err) {
				console.error('Erro ao processar imagem:', err);
				if (window.UI) window.UI.toast('Erro ao processar imagem. Tente outra foto.', 'danger');
			}
			clienteFotoInput.value = '';
		});
	}

	if (btnRemoverFotoCliente) {
		btnRemoverFotoCliente.addEventListener('click', () => {
			setFotoPreview('');
		});
	}

	// Elementos da subtabela de veículos do cliente
	const secaoVeiculosCliente = document.getElementById('secaoVeiculosCliente');
	const thClientesVeiculos = document.getElementById('thClientesVeiculos');
	const contadorVeiculosForm = document.getElementById('contadorVeiculosForm');
	const veiculoTipoInput = document.getElementById('veiculoTipoInput');
	const veiculoPlacaInput = document.getElementById('veiculoPlacaInput');
	const veiculoModeloInput = document.getElementById('veiculoModeloInput');
	const veiculoCorInput = document.getElementById('veiculoCorInput');
	const btnAdicionarVeiculoCliente = document.getElementById('btnAdicionarVeiculoCliente');
	const btnCancelarEdicaoVeiculo = document.getElementById('btnCancelarEdicaoVeiculo');
	const tbodyVeiculosCliente = document.getElementById('tbodyVeiculosCliente');

	const segmentoAuto = isAutomotivoAtivo();
	if (secaoVeiculosCliente) secaoVeiculosCliente.style.display = segmentoAuto ? 'block' : 'none';
	if (thClientesVeiculos) thClientesVeiculos.style.display = segmentoAuto ? '' : 'none';

	function popularCoresSubtabela() {
		if (!veiculoCorInput || typeof CORES_VEICULOS === 'undefined') return;
		veiculoCorInput.innerHTML = '';
		CORES_VEICULOS.forEach((c) => {
			const opt = document.createElement('option');
			opt.value = c.id;
			opt.textContent = c.nome;
			veiculoCorInput.appendChild(opt);
		});
		veiculoCorInput.value = 'prata';
	}

	function resetVeiculoInputs() {
		veiculoEditIndex = null;
		if (veiculoTipoInput) veiculoTipoInput.value = 'carro';
		if (veiculoPlacaInput) veiculoPlacaInput.value = '';
		if (veiculoModeloInput) veiculoModeloInput.value = '';
		if (veiculoCorInput) veiculoCorInput.value = 'prata';
		if (btnAdicionarVeiculoCliente) btnAdicionarVeiculoCliente.textContent = '+ Adicionar Veículo';
		if (btnCancelarEdicaoVeiculo) btnCancelarEdicaoVeiculo.style.display = 'none';
	}

	function renderizarSubtabelaVeiculos() {
		if (!tbodyVeiculosCliente) return;
		const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));

		if (contadorVeiculosForm) {
			const qtd = veiculosEmEdicao.length;
			contadorVeiculosForm.textContent = qtd === 1 ? '1 veículo' : `${qtd} veículos`;
		}

		tbodyVeiculosCliente.innerHTML = '';
		if (veiculosEmEdicao.length === 0) {
			tbodyVeiculosCliente.innerHTML = `
				<tr>
					<td colspan="5" class="empty-table-message" style="padding: 16px;">
						Nenhum veículo vinculado ainda. Informe tipo, placa, modelo e cor acima para adicionar um carro ou moto.
					</td>
				</tr>
			`;
			return;
		}

		veiculosEmEdicao.forEach((v, idx) => {
			const tr = document.createElement('tr');
			const corObj = typeof obterCorVeiculo === 'function' ? obterCorVeiculo(v.cor) : { nome: v.cor || 'Prata' };
			const iconeHtml = typeof renderizarIconeCarro === 'function' ? renderizarIconeCarro(corObj, 22, v.tipo) : '';
			const tipoLabel = typeof obterLabelTipoVeiculo === 'function'
				? obterLabelTipoVeiculo(v.tipo, true)
				: (v.tipo === 'moto' ? '🏍️ Moto' : (v.tipo === 'caminhao' ? '🚛 Caminhão' : '🚗 Carro'));

			tr.innerHTML = `
				<td>${tipoLabel}</td>
				<td><span class="veiculo-placa-mono">${esc(v.placa)}</span></td>
				<td>${esc(v.modelo || '-')}</td>
				<td>
					<div style="display: inline-flex; align-items: center; gap: 6px;">
						${iconeHtml}
						<span>${esc(corObj.nome)}</span>
					</div>
				</td>
				<td style="text-align: center;">
					<div class="btn-action-group" style="justify-content: center;">
						<button type="button" class="btn btn-sm btn-secondary btn-edit-veiculo" data-vidx="${idx}" title="Editar veículo">
							✏️
						</button>
						<button type="button" class="btn btn-sm btn-secondary btn-del-veiculo" data-vidx="${idx}" style="color: var(--danger);" title="Remover veículo">
							🗑️
						</button>
					</div>
				</td>
			`;
			tbodyVeiculosCliente.appendChild(tr);
		});

		tbodyVeiculosCliente.querySelectorAll('.btn-edit-veiculo').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const idx = parseInt(e.currentTarget.getAttribute('data-vidx'), 10);
				const v = veiculosEmEdicao[idx];
				if (!v) return;
				veiculoEditIndex = idx;
				if (veiculoTipoInput) veiculoTipoInput.value = v.tipo || 'carro';
				if (veiculoPlacaInput) veiculoPlacaInput.value = v.placa || '';
				if (veiculoModeloInput) veiculoModeloInput.value = v.modelo || '';
				if (veiculoCorInput) veiculoCorInput.value = v.cor || 'prata';
				if (btnAdicionarVeiculoCliente) btnAdicionarVeiculoCliente.textContent = '💾 Atualizar Veículo';
				if (btnCancelarEdicaoVeiculo) btnCancelarEdicaoVeiculo.style.display = 'inline-flex';
				if (veiculoPlacaInput) veiculoPlacaInput.focus();
			});
		});

		tbodyVeiculosCliente.querySelectorAll('.btn-del-veiculo').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const idx = parseInt(e.currentTarget.getAttribute('data-vidx'), 10);
				veiculosEmEdicao.splice(idx, 1);
				if (veiculoEditIndex === idx) {
					resetVeiculoInputs();
				} else if (veiculoEditIndex !== null && veiculoEditIndex > idx) {
					veiculoEditIndex -= 1;
				}
				renderizarSubtabelaVeiculos();
			});
		});
	}

	function adicionarOuAtualizarVeiculoNaLista() {
		const tipo = veiculoTipoInput ? veiculoTipoInput.value : 'carro';
		const placa = normalizarPlacaCliente(veiculoPlacaInput ? veiculoPlacaInput.value : '');
		const modelo = veiculoModeloInput ? veiculoModeloInput.value.trim() : '';
		const cor = veiculoCorInput ? veiculoCorInput.value : 'prata';

		if (!placa || placa.length < 3) {
			if (window.UI) window.UI.toast('Informe uma placa válida para o veículo.', 'warning');
			if (veiculoPlacaInput) veiculoPlacaInput.focus();
			return false;
		}

		if (!modelo) {
			if (window.UI) window.UI.toast('Informe o modelo do veículo (ex: Honda Civic, CG 160).', 'warning');
			if (veiculoModeloInput) veiculoModeloInput.focus();
			return false;
		}

		const placaLimpa = placa.replace(/-/g, '');
		const duplicado = veiculosEmEdicao.some((v, idx) => {
			if (veiculoEditIndex !== null && idx === veiculoEditIndex) return false;
			return (v.placa || '').replace(/-/g, '').toUpperCase() === placaLimpa;
		});

		if (duplicado) {
			if (window.UI) window.UI.toast(`A placa ${placa} já está na lista deste cliente.`, 'warning');
			if (veiculoPlacaInput) veiculoPlacaInput.focus();
			return false;
		}

		const tipoNorm = typeof normalizarTipoVeiculo === 'function'
			? normalizarTipoVeiculo(tipo)
			: (tipo === 'moto' ? 'moto' : (tipo === 'caminhao' ? 'caminhao' : 'carro'));

		const veiculoObj = {
			id: veiculoEditIndex !== null && veiculosEmEdicao[veiculoEditIndex]?.id
				? veiculosEmEdicao[veiculoEditIndex].id
				: `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			tipo: tipoNorm,
			placa,
			modelo,
			cor: cor || 'prata'
		};

		if (veiculoEditIndex !== null) {
			veiculosEmEdicao[veiculoEditIndex] = veiculoObj;
		} else {
			veiculosEmEdicao.push(veiculoObj);
		}

		resetVeiculoInputs();
		renderizarSubtabelaVeiculos();
		return true;
	}

	popularCoresSubtabela();
	renderizarSubtabelaVeiculos();

	if (veiculoPlacaInput) {
		veiculoPlacaInput.addEventListener('input', (e) => {
			e.target.value = normalizarPlacaCliente(e.target.value);
		});
		veiculoPlacaInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				adicionarOuAtualizarVeiculoNaLista();
			}
		});
	}

	if (veiculoModeloInput) {
		veiculoModeloInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				adicionarOuAtualizarVeiculoNaLista();
			}
		});
	}

	if (btnAdicionarVeiculoCliente) {
		btnAdicionarVeiculoCliente.addEventListener('click', () => {
			adicionarOuAtualizarVeiculoNaLista();
		});
	}

	if (btnCancelarEdicaoVeiculo) {
		btnCancelarEdicaoVeiculo.addEventListener('click', () => {
			resetVeiculoInputs();
		});
	}

	function resetFormState() {
		editIndex = null;
		veiculosEmEdicao = [];
		form.reset();
		setFotoPreview('');
		resetVeiculoInputs();
		renderizarSubtabelaVeiculos();
		if (inputWhatsApp1) inputWhatsApp1.checked = true;
		if (formCardTitle) formCardTitle.textContent = 'Novo Cliente';
		if (btnSalvar) btnSalvar.textContent = '💾 Salvar Cliente';
		if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'none';
	}

	if (btnCancelarEdicao) {
		btnCancelarEdicao.addEventListener('click', () => {
			resetFormState();
		});
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();

		if (editIndex === null && window.SaasGuard && !window.SaasGuard.bloquearSeSuspenso('cadastrar cliente')) {
			return;
		}

		// Se o usuário preencheu um veículo nos campos mas esqueceu de clicar "+ Adicionar Veículo", incorpora automaticamente
		if (segmentoAuto && ((veiculoPlacaInput && veiculoPlacaInput.value.trim()) || (veiculoModeloInput && veiculoModeloInput.value.trim()))) {
			const ok = adicionarOuAtualizarVeiculoNaLista();
			if (!ok) return;
		}

		const nome = inputNome.value.trim();
		const tel1 = inputTelefone1.value.trim();
		const wpp1 = inputWhatsApp1.checked ? '✅' : '❌';
		const tel2 = inputTelefone2.value.trim();
		const wpp2 = inputWhatsApp2.checked ? '✅' : '❌';
		const endereco = inputEndereco.value.trim();
		const foto = fotoBase64Atual;
		const veiculos = JSON.parse(JSON.stringify(veiculosEmEdicao));

		if (!tel1) {
			if (window.UI) {
				window.UI.toast('Por favor, informe o telefone principal do cliente.', 'warning');
			} else {
				alert('Por favor, informe o telefone principal do cliente. Ele é utilizado como código único de identificação.');
			}
			inputTelefone1.focus();
			return;
		}

		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];

		// Verificar duplicidade de código/telefone em novos cadastros
		if (editIndex === null) {
			const telLimpoNovo = tel1.replace(/\D/g, '');
			const clienteExistente = clientes.find(c => (c.tel1 || '').replace(/\D/g, '') === telLimpoNovo);
			if (clienteExistente) {
				if (window.UI) {
					window.UI.confirm({
						title: 'Telefone Já Cadastrado',
						message: `Já existe um cliente cadastrado com este telefone: <strong>${clienteExistente.nome}</strong>. Deseja cadastrar mesmo assim?`,
						confirmText: 'Cadastrar Mesmo Assim',
						cancelText: 'Voltar'
					}).then((prosseguir) => {
						if (!prosseguir) {
							inputTelefone1.focus();
							return;
						}
						salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco, foto, veiculos);
					});
					return;
				}
			}
		}

		salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco, foto, veiculos);
	});

	function salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco, foto, veiculos) {
		if (editIndex !== null) {
			// Editando cliente existente (preserva outros campos se existirem)
			const clienteAtual = clientes[editIndex] || {};
			clientes[editIndex] = {
				...clienteAtual,
				nome,
				tel1,
				wpp1,
				tel2,
				wpp2,
				endereco,
				foto: foto || clienteAtual.foto || '',
				veiculos: Array.isArray(veiculos) ? veiculos : (clienteAtual.veiculos || [])
			};
			editIndex = null;
			if (window.UI) window.UI.toast('Cliente atualizado com sucesso!', 'success');
		} else {
			// Adicionando novo cliente
			clientes.push({
				nome,
				tel1,
				wpp1,
				tel2,
				wpp2,
				endereco,
				foto,
				veiculos: Array.isArray(veiculos) ? veiculos : []
			});
			if (window.UI) window.UI.toast('Cliente cadastrado com sucesso!', 'success');
		}

		localStorage.setItem('clientes', JSON.stringify(clientes));
		atualizarTabela();
		resetFormState();
	}

	function gerarIniciais(nome) {
		if (!nome) return 'CL';
		const partes = nome.trim().split(/\s+/);
		if (partes.length >= 2) {
			return (partes[0][0] + partes[1][0]).toUpperCase();
		}
		return partes[0].substring(0, 2).toUpperCase();
	}

	function atualizarTabela() {
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		tabela.innerHTML = '';

		if (clientes.length === 0) {
			tabela.innerHTML = `
				<tr>
					<td colspan="${segmentoAuto ? 7 : 6}" class="empty-table-message">
						Nenhum cliente cadastrado ainda. Use o formulário acima para cadastrar o primeiro cliente.
					</td>
				</tr>
			`;
			return;
		}

		clientes.forEach((c, index) => {
			const tr = document.createElement('tr');
			const esc = (s) => (typeof window.escapeHTML === 'function' ? window.escapeHTML(s) : String(s || ''));
			
			const tel1Html = c.tel1 
				? `<strong>${esc(c.tel1)}</strong> ${c.wpp1 === '✅' ? '<span class="badge badge-whatsapp">WhatsApp</span>' : ''}` 
				: '<span style="color:var(--text-muted);">-</span>';
			const tel2Html = c.tel2 
				? `${esc(c.tel2)} ${c.wpp2 === '✅' ? '<span class="badge badge-whatsapp">WhatsApp</span>' : ''}` 
				: '<span style="color:var(--text-muted);">-</span>';

			// Avatar / Miniatura da Foto
			const avatarHtml = c.foto
				? `<div class="cliente-avatar-thumb" style="background-image: url('${c.foto}');" title="Foto de ${esc(c.nome)}"></div>`
				: `<div class="cliente-avatar-thumb avatar-initials" title="${esc(c.nome)}">${gerarIniciais(c.nome)}</div>`;

			const veiculosList = Array.isArray(c.veiculos) ? c.veiculos : [];
			let veiculosCellHtml = '';
			if (segmentoAuto) {
				if (veiculosList.length > 0) {
					const placasTexto = veiculosList.slice(0, 3).map(v => esc(v.placa)).join(', ');
					const extras = veiculosList.length > 3 ? ` +${veiculosList.length - 3}` : '';
					const labelQtd = veiculosList.length === 1 ? '1 veículo' : `${veiculosList.length} veículos`;
					veiculosCellHtml = `
						<td>
							<div class="clientes-veiculos-summary">
								<span class="clientes-veiculos-count">${labelQtd}</span>
								<span class="clientes-veiculos-placas">${placasTexto}${extras}</span>
							</div>
						</td>
					`;
				} else {
					veiculosCellHtml = `<td><span style="color:var(--text-muted); font-size:0.82rem;">Nenhum</span></td>`;
				}
			}

			const podeVerHistorico = !window.AuthService || typeof window.AuthService.hasPermission !== 'function' || window.AuthService.hasPermission('historico');
			const historicoCellHtml = podeVerHistorico
				? `<a class="btn btn-secondary btn-sm" href="historico.html?cliente=${encodeURIComponent(c.nome || '')}">📜 Histórico</a>`
				: `<span style="color: var(--text-muted); font-size: 0.78rem;">Restrito</span>`;

			tr.innerHTML = `
				<td id="nomeSalvo">
					<div class="cliente-nome-avatar-cell">
						${avatarHtml}
						<div class="cliente-nome-info">
							<strong>${esc(c.nome || '-')}</strong>
						</div>
					</div>
				</td>
				<td id="telefonesSalvos">${tel1Html}</td>
				<td id="telefone2Salvo">${tel2Html}</td>
				<td id="enderecoSalvo">${c.endereco ? esc(c.endereco) : '<span style="color:var(--text-muted);">-</span>'}</td>
				${veiculosCellHtml}
				<td style="text-align: center;">
					${historicoCellHtml}
				</td>
				<td style="text-align: center;">
					<div class="btn-action-group">
						<button type="button" class="edit__btn btn btn-sm" data-index="${index}">
							✏️ Editar
						</button>
						<button type="button" class="delete__btn btn btn-sm btn-secondary" data-index="${index}" style="color: var(--danger);">
							🗑️
						</button>
					</div>
				</td>
			`;
			tabela.appendChild(tr);
		});

		// Adiciona evento de edição
		const editButtons = document.querySelectorAll('.edit__btn');
		editButtons.forEach((button) => {
			button.addEventListener('click', (e) => {
				const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
				const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
				const cliente = clientes[index];
				if (!cliente) return;

				// Preenche o formulário com os dados do cliente
				inputNome.value = cliente.nome || '';
				inputTelefone1.value = cliente.tel1 || '';
				inputWhatsApp1.checked = cliente.wpp1 === '✅' || cliente.wpp1 === true;
				inputTelefone2.value = cliente.tel2 || '';
				inputWhatsApp2.checked = cliente.wpp2 === '✅' || cliente.wpp2 === true;
				inputEndereco.value = cliente.endereco || '';

				// Carrega veículos do cliente na subtabela
				veiculosEmEdicao = Array.isArray(cliente.veiculos)
					? JSON.parse(JSON.stringify(cliente.veiculos))
					: [];
				resetVeiculoInputs();
				renderizarSubtabelaVeiculos();

				// Carrega a foto no preview se houver
				setFotoPreview(cliente.foto || '');

				editIndex = index;
				if (formCardTitle) formCardTitle.textContent = `Editando: ${cliente.nome}`;
				if (btnSalvar) btnSalvar.textContent = '💾 Atualizar Cliente';
				if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'inline-flex';

				// Rola suavemente até o formulário no mobile
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});
		});

		// Adiciona evento de exclusão
		const deleteButtons = document.querySelectorAll('.delete__btn');
		deleteButtons.forEach((button) => {
			button.addEventListener('click', async (e) => {
				const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
				const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
				const cliente = clientes[index];
				if (!cliente) return;

				let confirmado = false;
				if (window.UI) {
					confirmado = await window.UI.confirm({
						title: 'Excluir Cliente',
						message: `Deseja realmente remover o cliente <strong>"${cliente.nome}"</strong> (${cliente.tel1 || 'Sem telefone'})?`,
						confirmText: 'Sim, Excluir',
						danger: true,
						icon: '🗑️'
					});
				} else {
					confirmado = confirm(`Deseja realmente remover o cliente "${cliente.nome}" (${cliente.tel1 || 'Sem telefone'})?`);
				}

				if (confirmado) {
					clientes.splice(index, 1);
					localStorage.setItem('clientes', JSON.stringify(clientes));
					if (editIndex === index) {
						resetFormState();
					} else if (editIndex !== null && editIndex > index) {
						editIndex -= 1;
					}
					if (window.UI) window.UI.toast('Cliente excluído com sucesso.', 'info');
					atualizarTabela();
				}
			});
		});
	}

	window.renderizarTabelaClientes = atualizarTabela;
	atualizarTabela();
});
