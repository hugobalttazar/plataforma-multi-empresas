/**
 * ui-feedback.js - Sistema Universal de Toasts e Diálogos Visuais In-App
 * Substitui alerts e confirms nativos bloqueados por iframes, garantindo
 * fluidez, acessibilidade e design consistente em toda a aplicação.
 */

(function () {
    // 1. Container de Toasts
    let toastContainer = null;

    function getToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'uiToastContainer';
            toastContainer.className = 'ui-toast-container';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    /**
     * Exibe notificação flutuante elegante (Toast)
     * @param {string} message 
     * @param {'success'|'error'|'warning'|'info'} type 
     * @param {number} duration 
     */
    function showToast(message, type = 'info', duration = 3500) {
        const container = getToastContainer();
        const toast = document.createElement('div');
        toast.className = `ui-toast ui-toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="ui-toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="ui-toast-msg">${message}</span>
            <button type="button" class="ui-toast-close" aria-label="Fechar">&times;</button>
        `;

        const closeBtn = toast.querySelector('.ui-toast-close');
        closeBtn.onclick = () => removeToast(toast);

        container.appendChild(toast);

        // Auto remove
        const timer = setTimeout(() => {
            removeToast(toast);
        }, duration);

        toast.onmouseenter = () => clearTimeout(timer);
    }

    function removeToast(toast) {
        if (!toast) return;
        toast.classList.add('ui-toast-leaving');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 220);
    }

    /**
     * Exibe Modal de Confirmação In-App que retorna uma Promise<boolean>
     * Substitui o window.confirm() nativo que é bloqueado por navegadores em iframes.
     */
    function showConfirmDialog(options = {}) {
        const {
            title = 'Confirmação',
            message = 'Deseja realmente prosseguir com esta ação?',
            confirmText = 'Confirmar',
            cancelText = 'Cancelar',
            danger = false,
            icon = danger ? '⚠️' : '❓'
        } = typeof options === 'string' ? { message: options } : options;

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay open ui-dialog-overlay';
            overlay.style.zIndex = '10000';

            const confirmBtnClass = danger ? 'btn btn-danger' : 'btn btn-primary';
            const confirmBtnStyle = danger ? 'background:#dc2626; color:#fff; border:none;' : '';

            overlay.innerHTML = `
                <div class="modal-card ui-dialog-card" style="max-width: 460px; transform: scale(1);">
                    <div class="modal-header">
                        <h3 style="display:flex; align-items:center; gap:8px; margin:0; font-size:1.1rem; color:var(--text-main);">
                            <span>${icon}</span>
                            <span>${title}</span>
                        </h3>
                        <button type="button" class="modal-close-btn ui-dialog-close">&times;</button>
                    </div>
                    <div class="modal-body" style="padding:18px 20px; font-size:0.95rem; color:var(--text-main); line-height:1.5;">
                        ${message}
                    </div>
                    <div class="modal-footer" style="padding:14px 20px; display:flex; justify-content:flex-end; gap:10px; background:var(--bg-surface); border-top:1px solid var(--border-color);">
                        <button type="button" class="btn btn-secondary ui-dialog-cancel">${cancelText}</button>
                        <button type="button" class="${confirmBtnClass} ui-dialog-confirm" style="${confirmBtnStyle}">${confirmText}</button>
                    </div>
                </div>
            `;

            function cleanup(result) {
                overlay.classList.remove('open');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 150);
                resolve(result);
            }

            overlay.querySelector('.ui-dialog-close').onclick = () => cleanup(false);
            overlay.querySelector('.ui-dialog-cancel').onclick = () => cleanup(false);
            overlay.querySelector('.ui-dialog-confirm').onclick = () => cleanup(true);

            // Clicar fora fecha
            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup(false);
            };

            // Teclado
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', keyHandler);
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    document.removeEventListener('keydown', keyHandler);
                    cleanup(true);
                }
            };
            document.addEventListener('keydown', keyHandler);

            document.body.appendChild(overlay);

            // Focus no botão de confirmar ou cancelar
            const confirmBtn = overlay.querySelector('.ui-dialog-confirm');
            if (confirmBtn) confirmBtn.focus();
        });
    }

    /**
     * Exibe Modal Informativo In-App
     * Substitui o window.alert() nativo.
     */
    function showAlertModal(message, title = 'Aviso') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay open ui-dialog-overlay';
            overlay.style.zIndex = '10000';

            overlay.innerHTML = `
                <div class="modal-card ui-dialog-card" style="max-width: 440px; transform: scale(1);">
                    <div class="modal-header">
                        <h3 style="display:flex; align-items:center; gap:8px; margin:0; font-size:1.1rem; color:var(--text-main);">
                            <span>ℹ️</span>
                            <span>${title}</span>
                        </h3>
                        <button type="button" class="modal-close-btn ui-dialog-close">&times;</button>
                    </div>
                    <div class="modal-body" style="padding:18px 20px; font-size:0.95rem; color:var(--text-main); line-height:1.5;">
                        ${message}
                    </div>
                    <div class="modal-footer" style="padding:14px 20px; display:flex; justify-content:flex-end; background:var(--bg-surface); border-top:1px solid var(--border-color);">
                        <button type="button" class="btn btn-primary ui-dialog-ok">Entendi</button>
                    </div>
                </div>
            `;

            function cleanup() {
                overlay.classList.remove('open');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 150);
                resolve();
            }

            overlay.querySelector('.ui-dialog-close').onclick = cleanup;
            overlay.querySelector('.ui-dialog-ok').onclick = cleanup;
            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup();
            };

            document.body.appendChild(overlay);
            const okBtn = overlay.querySelector('.ui-dialog-ok');
            if (okBtn) okBtn.focus();
        });
    }

    // Expor globalmente
    window.showToast = showToast;
    window.showConfirmDialog = showConfirmDialog;
    window.showAlertModal = showAlertModal;
    window.UI = {
        toast: showToast,
        confirm: showConfirmDialog,
        alert: showAlertModal
    };

    // ======================================================================
    // Utilitário Global de Datas Brasileiras (dd/mm/aaaa)
    // ======================================================================
    const DateBR = {
        aplicarMascaraTexto(valor) {
            const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
            if (digitos.length <= 2) return digitos;
            if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
            return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
        },

        formatarParaBR(valor) {
            if (!valor) return '';
            const str = String(valor).trim();
            const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
                return str;
            }
            return str;
        },

        validarDataBR(valorBR) {
            const str = String(valorBR || '').trim();
            const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!match) {
                return { valido: false, iso: null, br: null };
            }
            const dia = parseInt(match[1], 10);
            const mes = parseInt(match[2], 10);
            const ano = parseInt(match[3], 10);

            if (ano < 1900 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
                return { valido: false, iso: null, br: null };
            }

            const dataObj = new Date(ano, mes - 1, dia);
            if (
                dataObj.getFullYear() !== ano ||
                dataObj.getMonth() !== mes - 1 ||
                dataObj.getDate() !== dia
            ) {
                return { valido: false, iso: null, br: null };
            }

            const dd = String(dia).padStart(2, '0');
            const mm = String(mes).padStart(2, '0');
            return {
                valido: true,
                iso: `${ano}-${mm}-${dd}`,
                br: `${dd}/${mm}/${ano}`
            };
        },

        converterBRParaISO(valor) {
            const str = String(valor || '').trim();
            if (!str) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                const [ano, mes, dia] = str.split('-');
                const check = this.validarDataBR(`${dia}/${mes}/${ano}`);
                return check.valido ? check.iso : null;
            }
            const res = this.validarDataBR(str);
            return res.valido ? res.iso : null;
        },

        resolverElemento(inputOrId) {
            if (!inputOrId) return null;
            if (typeof inputOrId === 'string') return document.getElementById(inputOrId);
            return inputOrId;
        },

        setInputISO(inputOrId, valorISO) {
            const input = this.resolverElemento(inputOrId);
            if (!input) return;
            if (!valorISO) {
                input.value = '';
                input.classList.remove('date-br-invalid');
                input.setCustomValidity('');
                if (input._datePickerInput) input._datePickerInput.value = '';
                return;
            }
            const br = this.formatarParaBR(valorISO);
            const iso = this.converterBRParaISO(br);
            input.value = br;
            input.classList.remove('date-br-invalid');
            input.setCustomValidity('');
            if (input._datePickerInput) {
                input._datePickerInput.value = iso || '';
            }
        },

        getInputISO(inputOrId) {
            const input = this.resolverElemento(inputOrId);
            if (!input) return '';
            return this.converterBRParaISO(input.value);
        },

        setupCampoData(input) {
            if (!input || input.dataset.dateBrReady === 'true') return;
            input.dataset.dateBrReady = 'true';

            input.type = 'text';
            input.inputMode = 'numeric';
            input.maxLength = 10;
            input.placeholder = input.placeholder || 'dd/mm/aaaa';
            input.autocomplete = 'off';
            input.classList.add('date-br-input');

            if (input.value && /^\d{4}-\d{2}-\d{2}/.test(input.value.trim())) {
                input.value = this.formatarParaBR(input.value);
            }

            let wrapper = input.parentElement;
            if (!wrapper || !wrapper.classList.contains('date-br-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = 'date-br-wrapper';
                if (input.dataset.dateCompact === 'true') {
                    wrapper.classList.add('date-br-compact');
                }
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            const nativePicker = document.createElement('input');
            nativePicker.type = 'date';
            nativePicker.className = 'date-br-native-picker';
            nativePicker.tabIndex = -1;
            nativePicker.setAttribute('aria-hidden', 'true');

            const isoInicial = this.converterBRParaISO(input.value);
            if (isoInicial) {
                nativePicker.value = isoInicial;
            }

            const pickerBtn = document.createElement('button');
            pickerBtn.type = 'button';
            pickerBtn.className = 'date-br-picker-btn';
            pickerBtn.title = 'Selecionar data no calendário';
            pickerBtn.setAttribute('aria-label', 'Selecionar data no calendário');
            pickerBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;

            wrapper.appendChild(pickerBtn);
            wrapper.appendChild(nativePicker);
            input._datePickerInput = nativePicker;

            pickerBtn.addEventListener('click', () => {
                const isoAtual = this.converterBRParaISO(input.value);
                nativePicker.value = isoAtual || '';
                if (typeof nativePicker.showPicker === 'function') {
                    try {
                        nativePicker.showPicker();
                        return;
                    } catch (err) {
                        // Fallback abaixo
                    }
                }
                nativePicker.focus();
                nativePicker.click();
            });

            nativePicker.addEventListener('change', () => {
                if (nativePicker.value) {
                    input.value = this.formatarParaBR(nativePicker.value);
                    input.classList.remove('date-br-invalid');
                    input.setCustomValidity('');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            input.addEventListener('input', () => {
                const posAnterior = input.selectionStart || 0;
                const digitosAntes = input.value.slice(0, posAnterior).replace(/\D/g, '').length;
                const mascarado = this.aplicarMascaraTexto(input.value);

                if (input.value !== mascarado) {
                    input.value = mascarado;
                    let novaPos = mascarado.length;
                    if (digitosAntes <= 2) {
                        novaPos = digitosAntes;
                    } else if (digitosAntes <= 4) {
                        novaPos = digitosAntes + 1;
                    } else {
                        novaPos = digitosAntes + 2;
                    }
                    try {
                        input.setSelectionRange(novaPos, novaPos);
                    } catch (e) {}
                }

                input.classList.remove('date-br-invalid');
                input.setCustomValidity('');

                const isoAtual = this.converterBRParaISO(input.value);
                if (isoAtual) {
                    nativePicker.value = isoAtual;
                } else if (!input.value.trim()) {
                    nativePicker.value = '';
                }
            });

            input.addEventListener('blur', () => {
                const val = input.value.trim();
                if (!val) {
                    input.classList.remove('date-br-invalid');
                    input.setCustomValidity('');
                    return;
                }
                const check = this.validarDataBR(val);
                if (!check.valido) {
                    input.classList.add('date-br-invalid');
                    input.setCustomValidity('Informe uma data válida no formato dd/mm/aaaa.');
                } else {
                    input.value = check.br;
                    input.classList.remove('date-br-invalid');
                    input.setCustomValidity('');
                    nativePicker.value = check.iso;
                }
            });
        },

        inicializarTodos() {
            document.querySelectorAll('input[data-date-br="true"]').forEach((el) => {
                this.setupCampoData(el);
            });
        }
    };

    window.DateBR = DateBR;

    // ======================================================================
    // Cockpit Bottom Dock (Opção 1) — Navegação Inferior Universal + Menu "Mais"
    // ======================================================================
    const MODULE_BY_HREF = {
        'agendamentos.html': 'agenda',
        'pedidos.html': 'pedidos',
        'caixa.html': 'caixa',
        'estoque.html': 'estoque',
        'fidelidade.html': 'posvenda',
        'clientes.html': 'clientes',
        'servicos.html': 'servicos'
    };

    const PRIMARY_HREFS = ['index.html', 'agendamentos.html', 'pedidos.html', 'caixa.html'];
    let dockGlobalListenersBound = false;

    function normalizeDockLinks(navbar) {
        const links = Array.from(navbar.children).filter(el => el.tagName === 'A');
        links.forEach((link) => {
            if (link.dataset.dockNormalized === 'true') return;
            link.dataset.dockNormalized = 'true';

            if (!link.querySelector('.nav-icon')) {
                const textSpan = link.querySelector('.nav-text');
                let iconText = '';
                const nodesToRemove = [];
                link.childNodes.forEach((node) => {
                    if (node !== textSpan && node.nodeType === Node.TEXT_NODE) {
                        const trimmed = node.textContent.trim();
                        if (trimmed) iconText += (iconText ? ' ' : '') + trimmed;
                        nodesToRemove.push(node);
                    }
                });
                if (iconText) {
                    nodesToRemove.forEach((n) => n.remove());
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'nav-icon';
                    iconSpan.setAttribute('aria-hidden', 'true');
                    iconSpan.textContent = iconText;
                    link.insertBefore(iconSpan, textSpan || link.firstChild);
                }
            }
        });
        return links;
    }

    function isDockLinkPermitted(link) {
        if (!link) return false;
        if (link.style.display === 'none') return false;
        const href = (link.getAttribute('href') || '').split('?')[0].split('#')[0];
        const mod = MODULE_BY_HREF[href];
        if (mod && window.AuthService && typeof window.AuthService.hasPermission === 'function') {
            return window.AuthService.hasPermission(mod);
        }
        return true;
    }

    function closeDockMoreSheet() {
        const sheet = document.querySelector('.dock-more-sheet.open');
        const btn = document.querySelector('.dock-more-btn');
        if (sheet) sheet.classList.remove('open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function refreshCockpitDock() {
        const navbar = document.querySelector('nav.navbar');
        if (!navbar || !document.body) {
            if (document.body) document.body.classList.remove('has-bottom-dock');
            return;
        }

        document.body.classList.add('has-bottom-dock');

        // Garante que a navbar seja filha direta do body para position: fixed nunca ficar presa no header
        if (navbar.parentElement !== document.body) {
            document.body.appendChild(navbar);
        }

        const links = normalizeDockLinks(navbar);

        // Limpa controles dinâmicos anteriores para permitir reexecução idempotente
        navbar.querySelectorAll('.dock-more-btn, .dock-more-sheet').forEach((el) => el.remove());

        const permittedLinks = links.filter((link) => {
            link.removeAttribute('data-dock-overflow');
            return isDockLinkPermitted(link);
        });

        // Em telas pequenas (<= 768px), exibe até 4 principais + botão "Mais" se houver mais de 5 itens
        if (permittedLinks.length > 5) {
            const primarySet = new Set();

            PRIMARY_HREFS.forEach((href) => {
                if (primarySet.size >= 4) return;
                const match = permittedLinks.find(
                    (l) => (l.getAttribute('href') || '').split('?')[0] === href
                );
                if (match) primarySet.add(match);
            });

            permittedLinks.forEach((l) => {
                if (primarySet.size >= 4) return;
                if (!primarySet.has(l)) primarySet.add(l);
            });

            const overflowLinks = permittedLinks.filter((l) => !primarySet.has(l));
            if (overflowLinks.length > 0) {
                let anyOverflowActive = false;

                const sheet = document.createElement('div');
                sheet.className = 'dock-more-sheet';
                sheet.setAttribute('role', 'menu');
                sheet.setAttribute('aria-label', 'Mais módulos');

                overflowLinks.forEach((link) => {
                    link.setAttribute('data-dock-overflow', 'true');
                    const isActive = link.classList.contains('active');
                    if (isActive) anyOverflowActive = true;

                    const clone = document.createElement('a');
                    clone.href = link.getAttribute('href') || '#';
                    if (isActive) clone.className = 'active';
                    clone.setAttribute('role', 'menuitem');

                    const icon = link.querySelector('.nav-icon');
                    const text = link.querySelector('.nav-text');
                    if (icon) {
                        const ic = document.createElement('span');
                        ic.className = 'nav-icon';
                        ic.setAttribute('aria-hidden', 'true');
                        ic.textContent = icon.textContent;
                        clone.appendChild(ic);
                    }
                    if (text) {
                        const tx = document.createElement('span');
                        tx.className = 'nav-text';
                        tx.textContent = text.textContent;
                        clone.appendChild(tx);
                    } else {
                        clone.textContent = link.textContent;
                    }

                    clone.addEventListener('click', (e) => {
                        const href = clone.getAttribute('href');
                        closeDockMoreSheet();
                        if (href && (href.endsWith('.html') || href.includes('.html?'))) {
                            e.preventDefault();
                            window.location.replace(href);
                        }
                    });

                    sheet.appendChild(clone);
                });

                const moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'dock-more-btn' + (anyOverflowActive ? ' active' : '');
                moreBtn.setAttribute('aria-haspopup', 'true');
                moreBtn.setAttribute('aria-expanded', 'false');
                moreBtn.setAttribute('aria-label', 'Abrir mais módulos');
                moreBtn.innerHTML = '<span class="nav-icon" aria-hidden="true">☰</span><span class="nav-text">Mais</span>';

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = sheet.classList.toggle('open');
                    moreBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });

                navbar.appendChild(sheet);
                navbar.appendChild(moreBtn);
            }
        }

        if (!dockGlobalListenersBound) {
            dockGlobalListenersBound = true;
            document.addEventListener('click', (e) => {
                const nav = document.querySelector('nav.navbar');
                if (nav && !nav.contains(e.target)) {
                    closeDockMoreSheet();
                }
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeDockMoreSheet();
                }
            });
        }
    }

    window.refreshCockpitDock = refreshCockpitDock;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DateBR.inicializarTodos();
            refreshCockpitDock();
        });
    } else {
        DateBR.inicializarTodos();
        refreshCockpitDock();
    }
})();


