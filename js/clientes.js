const inputNome = document.querySelector('#clienteNome');
const inputTelefone1 = document.querySelector('#telefone1');
const inputTelefone2 = document.querySelector('#telefone2');
const inputWhatsApp1 = document.querySelector('#whatsapp1');
const inputWhatsApp2 = document.querySelector('#whatsapp2');
const inputEndereco = document.querySelector('#endereco');
const formCardTitle = document.querySelector('#formCardTitle');
const btnCancelarEdicao = document.querySelector('#btnCancelarEdicao');
const btnSalvar = document.querySelector('#btnSalvarCliente');

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

	function resetFormState() {
		editIndex = null;
		form.reset();
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

		const nome = inputNome.value.trim();
		const tel1 = inputTelefone1.value.trim();
		const wpp1 = inputWhatsApp1.checked ? '✅' : '❌';
		const tel2 = inputTelefone2.value.trim();
		const wpp2 = inputWhatsApp2.checked ? '✅' : '❌';
		const endereco = inputEndereco.value.trim();

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
						salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco);
					});
					return;
				}
			}
		}

		salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco);
	});

	function salvarClienteFinal(clientes, nome, tel1, wpp1, tel2, wpp2, endereco) {
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
				endereco
			};
			editIndex = null;
			if (window.UI) window.UI.toast('Cliente atualizado com sucesso!', 'success');
		} else {
			// Adicionando novo cliente
			clientes.push({ nome, tel1, wpp1, tel2, wpp2, endereco });
			if (window.UI) window.UI.toast('Cliente cadastrado com sucesso!', 'success');
		}

		localStorage.setItem('clientes', JSON.stringify(clientes));
		atualizarTabela();
		resetFormState();
	}

	function atualizarTabela() {
		const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
		tabela.innerHTML = '';

		if (clientes.length === 0) {
			tabela.innerHTML = `
				<tr>
					<td colspan="6" class="empty-table-message">
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

			tr.innerHTML = `
				<td id="nomeSalvo"><strong>${esc(c.nome || '-')}</strong></td>
				<td id="telefonesSalvos">${tel1Html}</td>
				<td id="telefone2Salvo">${tel2Html}</td>
				<td id="enderecoSalvo">${c.endereco ? esc(c.endereco) : '<span style="color:var(--text-muted);">-</span>'}</td>
				<td style="text-align: center;">
					<a class="btn btn-secondary btn-sm" href="historico.html?cliente=${encodeURIComponent(c.nome || '')}">
						📜 Histórico
					</a>
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
				const index = e.currentTarget.getAttribute('data-index');
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
				const index = e.currentTarget.getAttribute('data-index');
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
					}
					if (window.UI) window.UI.toast('Cliente excluído com sucesso.', 'info');
					atualizarTabela();
				}
			});
		});
	}

	atualizarTabela();
});

// apenas comentaário para ver as modifvicações 
