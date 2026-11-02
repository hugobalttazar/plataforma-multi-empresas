// ==========================================================================
// ThemeService - Titanium Aerospace Bento (Modo Claro & Modo Escuro)
// ==========================================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'app_theme';
    // O padrão solicitado pelo usuário é 'light' (Titanium Aerospace Light Mode)
    const DEFAULT_THEME = 'light';

    function getStoredTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'dark' || saved === 'light') {
                return saved;
            }
        } catch (e) {
            console.warn('[ThemeService] Não foi possível ler o localStorage:', e);
        }
        return DEFAULT_THEME;
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        
        // Atualiza a meta tag theme-color no navegador mobile/PWA
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.setAttribute('name', 'theme-color');
            document.head.appendChild(metaTheme);
        }
        metaTheme.setAttribute('content', theme === 'dark' ? '#090d16' : '#f8fafc');

        // Atualiza o estado visual de todos os botões de alternância na página
        updateToggleButtons(theme);

        // Dispara evento customizado para gráficos ou componentes que precisem re-renderizar
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            console.warn('[ThemeService] Não foi possível salvar no localStorage:', e);
        }
    }

    function updateToggleButtons(theme) {
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(btn => {
            const isDark = theme === 'dark';
            btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
            btn.setAttribute('data-active-theme', theme);
            
            const thumb = btn.querySelector('.theme-toggle-thumb');
            if (thumb) {
                thumb.textContent = isDark ? '🌙' : '☀️';
            }
            
            const textEl = btn.querySelector('.theme-toggle-text');
            if (textEl) {
                textEl.textContent = isDark ? 'Modo Escuro' : 'Modo Claro';
            }
        });
    }

    // Aplicação imediata antes do primeiro render para evitar qualquer FOUC (flash de tema errado)
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);

    const ThemeService = {
        getTheme: function() {
            return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        },

        setTheme: function(theme) {
            if (theme !== 'dark' && theme !== 'light') return;
            saveTheme(theme);
            applyTheme(theme);
        },

        toggleTheme: function() {
            const current = this.getTheme();
            const next = current === 'dark' ? 'light' : 'dark';
            this.setTheme(next);
            return next;
        },

        createToggleButtonHTML: function() {
            const isDark = this.getTheme() === 'dark';
            return `
                <button type="button" class="theme-toggle-btn" id="themeToggleBtn" title="Alternar entre Modo Claro e Escuro" aria-label="Alternar tema de interface" data-active-theme="${this.getTheme()}">
                    <span class="theme-toggle-track">
                        <span class="theme-toggle-thumb">${isDark ? '🌙' : '☀️'}</span>
                    </span>
                    <span class="theme-toggle-text">${isDark ? 'Modo Escuro' : 'Modo Claro'}</span>
                </button>
            `;
        },

        initHeaderToggle: function() {
            const headerActions = document.querySelector('.header-actions');
            if (headerActions && !document.getElementById('themeToggleBtn')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.createToggleButtonHTML().trim();
                const btn = tempDiv.firstChild;
                
                // Insere como primeiro elemento das ações do cabeçalho
                headerActions.insertBefore(btn, headerActions.firstChild);

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    ThemeService.toggleTheme();
                });
            } else if (document.getElementById('themeToggleBtn')) {
                const btn = document.getElementById('themeToggleBtn');
                btn.onclick = () => ThemeService.toggleTheme();
            }
        }
    };

    window.ThemeService = ThemeService;

    // Inicializa o botão no header assim que o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ThemeService.initHeaderToggle());
    } else {
        ThemeService.initHeaderToggle();
    }
})();
