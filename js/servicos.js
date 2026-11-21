// Inicialização com serviços padrão caso esteja vazio pela primeira vez
if (!localStorage.getItem('servicos_initialized')) {
	const defaultServicos = [
		{ nome: 'Lavagem Simples', preco: 40.00, descricao: 'Lavagem externa com xampu neutro e secagem' },
		{ nome: 'Lavagem Completa', preco: 70.00, descricao: 'Lavagem externa, aspiração interna e pneus' },
		{ nome: 'Lavagem Completa + Cera', preco: 90.00, descricao: 'Lavagem completa com proteção de cera' },
		{ nome: 'Higienização Interna', preco: 180.00, descricao: 'Limpeza e desinfecção de estofados e carpetes' },
		{ nome: 'Polimento Comercial', preco: 250.00, descricao: 'Realce de brilho e remoção de marcas leves' }
	];
	if (!localStorage.getItem('servicos')) {
		localStorage.setItem('servicos', JSON.stringify(defaultServicos));
	}
	localStorage.setItem('servicos_initialized', 'true');
}

let servicos = JSON.parse(localStorage.getItem('servicos')) || [];
const servicoForm = document.getElementById('servicoForm');
const servicosTable = document.querySelector('#servicosTable tbody');
const inputNome = document.getElementById('servicoNome');
const inputPreco = document.getElementById('servicoPreco');
const inputDiasRetorno = document.getElementById('servicoDiasRetorno');
const inputDescricao = document.getElementById('servicoDescricao');
const formServicoTitulo = document.getElementById('formServicoTitulo');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicaoServico');
const btnSalvar = document.getElementById('btnSalvarServico');

let editIndex = null;

function resetForm() {
	editIndex = null;
	servicoForm.reset();
	if (formServicoTitulo) formServicoTitulo.textContent = 'Novo Serviço';
	if (btnSalvar) btnSalvar.textContent = '💾 Salvar Serviço';
	if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'none';
}

if (btnCancelarEdicao) {
	btnCancelarEdicao.addEventListener('click', resetForm);
}

function atualizarServicos() {
	servicosTable.innerHTML = '';

	if (servicos.length === 0) {
		servicosTable.innerHTML = `
			<tr>
				<td colspan="5" class="empty-table-message">
					Nenhum serviço cadastrado ainda. Adicione serviços no formulário acima para usá-los nas ordens de serviço.
				</td>
			</tr>
		`;
		return;
	}

	servicos.forEach((s, index) => {
		const tr = document.createElement('tr');
		const precoFormatado = parseFloat(s.preco || 0).toFixed(2);
		const diasRetorno = parseInt(s.diasRetorno, 10) || 0;
		const badgeRetorno = diasRetorno > 0
			? `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700;">🔁 ${diasRetorno} dias</span>`
			: `<span style="color:var(--text-muted); font-size:0.82rem;">Padrão</span>`;

		tr.innerHTML = `
			<td><strong>${s.nome}</strong></td>
			<td><span class="badge-price">R$ ${precoFormatado}</span></td>
			<td>${badgeRetorno}</td>
			<td>${s.descricao ? s.descricao : '<span style="color:var(--text-muted);">-</span>'}</td>
			<td style="text-align: center;">
				<div class="btn-action-group">
					<button type="button" class="btn btn-sm btn-secondary edit-servico-btn" data-index="${index}">
						✏️ Editar
					</button>
					<button type="button" class="btn btn-sm btn-secondary delete-servico-btn" data-index="${index}" style="color: var(--danger);">
						🗑️
					</button>
				</div>
			</td>
		`;
		servicosTable.appendChild(tr);
	});

	// Ações de editar
	document.querySelectorAll('.edit-servico-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const index = e.currentTarget.getAttribute('data-index');
			const s = servicos[index];
			if (!s) return;

			inputNome.value = s.nome;
			inputPreco.value = s.preco;
			if (inputDiasRetorno) inputDiasRetorno.value = parseInt(s.diasRetorno, 10) > 0 ? s.diasRetorno : '';
			inputDescricao.value = s.descricao || '';
			editIndex = index;

			if (formServicoTitulo) formServicoTitulo.textContent = `Editando: ${s.nome}`;
			if (btnSalvar) btnSalvar.textContent = '💾 Atualizar Serviço';
			if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'inline-flex';

			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	});

	// Ações de remover
	document.querySelectorAll('.delete-servico-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const index = e.currentTarget.getAttribute('data-index');
			const s = servicos[index];
			if (!s) return;

			let confirmado = false;
			if (window.UI) {
				confirmado = await window.UI.confirm({
					title: 'Excluir Serviço',
					message: `Deseja realmente remover o serviço <strong>"${s.nome}"</strong>?`,
					confirmText: 'Sim, Excluir',
					danger: true,
					icon: '🗑️'
				});
			} else {
				confirmado = confirm(`Deseja realmente remover o serviço "${s.nome}"?`);
			}

			if (confirmado) {
				servicos.splice(index, 1);
				localStorage.setItem('servicos', JSON.stringify(servicos));
				if (editIndex === index) {
					resetForm();
				}
				if (window.UI) window.UI.toast('Serviço excluído com sucesso.', 'info');
				atualizarServicos();
			}
		});
	});
}

servicoForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const nome = inputNome.value.trim();
	const preco = parseFloat(inputPreco.value) || 0;
	const diasRetorno = inputDiasRetorno ? (parseInt(inputDiasRetorno.value, 10) || 0) : 0;
	const descricao = inputDescricao.value.trim();

	if (editIndex !== null) {
		servicos[editIndex] = { nome, preco, diasRetorno, descricao };
		if (window.UI) window.UI.toast('Serviço atualizado com sucesso!', 'success');
	} else {
		servicos.push({ nome, preco, diasRetorno, descricao });
		if (window.UI) window.UI.toast('Serviço cadastrado com sucesso!', 'success');
	}

	localStorage.setItem('servicos', JSON.stringify(servicos));
	atualizarServicos();
	resetForm();
});

atualizarServicos();
