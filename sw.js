// ==========================================================================
// Service Worker - Sistema de Gestão Multi-Empresas (PWA)
// ==========================================================================

const CACHE_NAME = 'gestao-saas-cache-v10';
const PRECACHE_ASSETS = [
    './',
    'index.html',
    'login.html',
    'pedidos.html',
    'agendamentos.html',
    'caixa.html',
    'clientes.html',
    'servicos.html',
    'estoque.html',
    'fidelidade.html',
    'configuracoes.html',
    'historico.html',
    'orcamento.html',
    'agenda-publica.html',
    'painel-tv.html',
    'style.css',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-192.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    'icon.svg',
    'js/pwa-install.js',
    'js/error-guard.js',
    'js/brand-service.js',
    'js/saas-guard.js',
    'js/publico-service.js',
    'js/auth-service.js',
    'js/firebase-init.js',
    'js/firebase-sync.js',
    'js/empresa-service.js',
    'js/caixa-service.js',
    'js/equipe-service.js',
    'js/estoque-service.js',
    'js/fidelidade-service.js',
    'js/pacotes-service.js',
    'js/faturamento-service.js',
    'js/vistoria-service.js',
    'js/pix-service.js',
    'js/whatsapp-service.js',
    'js/recibo-service.js',
    'js/google-calendar-service.js',
    'js/backup-service.js',
    'js/index.js',
    'js/pedidos.js',
    'js/clientes.js',
    'js/servicos.js',
    'js/caixa.js',
    'js/agendamentos.js',
    'js/configuracoes.js',
    'js/historico.js',
    'js/orcamento-publico.js',
    'js/agenda-publica.js',
    'js/painel-tv.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Adicionar arquivos com segurança para que o SW instale com 100% de sucesso
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(new Request(asset, { cache: 'reload' }));
                } catch (err) {
                    console.warn('[SW] Pré-cache individual ignorado:', asset, err ? err.message : '');
                }
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Apenas requisições GET
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Ignora chamadas externas ou de telemetria / Firebase
    if (!url.origin.includes(self.location.origin)) {
        return;
    }

    // Estratégia: Network First com fallback para Cache
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.mode === 'navigate') {
                        return caches.match(event.request).then((navResp) => {
                            if (navResp) return navResp;
                            return caches.match('index.html').then((indexResp) => {
                                return indexResp || caches.match('./');
                            });
                        });
                    }
                });
            })
    );
});
