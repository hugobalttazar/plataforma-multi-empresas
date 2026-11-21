import { db, doc, setDoc, getDoc, onSnapshot } from './firebase-init.js';

const COLLECTIONS = [
    'clientes', 'servicos', 'pedidos', 'caixas_fechados', 'caixa_atual', 'caixa_saidas', 'caixa_entradas',
    'config_negocio', 'agendamentos', 'estoque_produtos', 'equipe_membros', 
    'comissoes_pagamentos', 'fidelidade_config', 'fidelidade_lembretes', 'vistorias_pedidos',
    'pacotes_planos', 'pacotes_clientes', 'contas_financeiras', 'faturamentos_lotes', 'usuarios'
];

let isSyncing = false;
let syncEnabled = false;
let activeUnsubscribers = [];
let lastSyncTenantId = null;
let lastSyncTime = null;
let lastPingTime = null;
let connectionState = navigator.onLine ? 'conectado' : 'inativa';
let lastError = null;

function emitirMudancaStatus() {
    window.dispatchEvent(new CustomEvent('firebaseStatusChanged', {
        detail: FirebaseSync.getStatus()
    }));
}

// Monitora conectividade de rede do navegador
window.addEventListener('online', () => {
    connectionState = 'conectado';
    lastError = null;
    emitirMudancaStatus();
    if (FirebaseSync.start) {
        FirebaseSync.start();
    }
});

window.addEventListener('offline', () => {
    connectionState = 'inativa';
    lastError = 'Sem conexão com a internet (Modo Offline).';
    emitirMudancaStatus();
});

const originalSetItem = localStorage.setItem.bind(localStorage);

localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (syncEnabled && !isSyncing && COLLECTIONS.includes(key)) {
        const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
        if (user && user.empresaId && db) {
            // Push strictly to active tenant's document
            try {
                const docRef = doc(db, 'empresas', user.empresaId, 'dados', key);
                setDoc(docRef, { data: value })
                    .then(() => {
                        connectionState = 'conectado';
                        lastSyncTime = new Date();
                        lastError = null;
                        emitirMudancaStatus();
                    })
                    .catch(err => {
                        connectionState = 'inativa';
                        lastError = err ? (err.message || String(err)) : 'Erro ao sincronizar';
                        emitirMudancaStatus();
                        console.warn('Erro ao sincronizar com nuvem:', err ? (err.message || String(err)) : '');
                    });
            } catch (err) {
                connectionState = 'inativa';
                lastError = err ? (err.message || String(err)) : 'Erro no setDoc';
                emitirMudancaStatus();
                console.warn('Erro no setDoc:', err ? (err.message || String(err)) : '');
            }
        }
    }
};

const FirebaseSync = {
    start: function() {
        const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
        if (!user || !user.empresaId || !db) {
            connectionState = !navigator.onLine ? 'inativa' : 'conectado';
            emitirMudancaStatus();
            return;
        }

        // Cancelar listeners ativos anteriores para evitar interferência entre empresas
        activeUnsubscribers.forEach(unsub => {
            try {
                if (typeof unsub === 'function') unsub();
            } catch (e) {}
        });
        activeUnsubscribers = [];

        // Se a empresa mudou em relação à sincronização anterior, limpar cache local residual
        if (lastSyncTenantId && lastSyncTenantId !== user.empresaId) {
            COLLECTIONS.forEach(k => {
                originalSetItem(k, (k === 'config_negocio' || k === 'caixa_atual' || k === 'fidelidade_config' || k === 'vistorias_pedidos') ? '{}' : '[]');
            });
        }
        lastSyncTenantId = user.empresaId;

        syncEnabled = true;
        if (!navigator.onLine) {
            connectionState = 'inativa';
            lastError = 'Navegador desconectado da rede.';
            emitirMudancaStatus();
            return;
        }

        COLLECTIONS.forEach(key => {
            try {
                const docRef = doc(db, 'empresas', user.empresaId, 'dados', key);
                const unsub = onSnapshot(docRef, (snapshot) => {
                    connectionState = 'conectado';
                    lastSyncTime = new Date();
                    lastError = null;
                    emitirMudancaStatus();

                    if (snapshot.exists()) {
                        const cloudData = snapshot.data().data;
                        const localData = localStorage.getItem(key);
                        if (cloudData !== localData) {
                            isSyncing = true;
                            originalSetItem(key, cloudData);
                            isSyncing = false;
                            
                            // Notify UI components
                            window.dispatchEvent(new CustomEvent('cloudDataChanged', { detail: key }));
                        }
                    } else {
                        // Isolamento garantido: inicializa limpo e vazio para a nova empresa sem vazar dados
                        const defaultVal = (key === 'config_negocio' || key === 'caixa_atual' || key === 'fidelidade_config' || key === 'vistorias_pedidos') ? '{}' : '[]';
                        isSyncing = true;
                        originalSetItem(key, defaultVal);
                        isSyncing = false;
                        setDoc(docRef, { data: defaultVal }).catch(() => {});
                        window.dispatchEvent(new CustomEvent('cloudDataChanged', { detail: key }));
                    }
                }, (error) => {
                    connectionState = 'inativa';
                    lastError = error ? (error.message || String(error)) : 'Falha no canal de sincronização';
                    emitirMudancaStatus();
                    console.warn(`Aviso de conexão para ${key}:`, error ? (error.message || String(error)) : '');
                });

                activeUnsubscribers.push(unsub);
            } catch (err) {
                connectionState = 'inativa';
                lastError = err ? (err.message || String(err)) : 'Erro ao inicializar listener';
                emitirMudancaStatus();
                console.warn(`Erro ao iniciar listener para ${key}:`, err ? (err.message || String(err)) : '');
            }
        });
    },
    stop: function() {
        activeUnsubscribers.forEach(unsub => {
            try {
                if (typeof unsub === 'function') unsub();
            } catch (e) {}
        });
        activeUnsubscribers = [];
        syncEnabled = false;
    },
    getStatus: function() {
        const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const isOnline = navigator.onLine;
        const estaConectado = isOnline && connectionState === 'conectado';

        return {
            status: estaConectado ? 'conectado' : 'inativa',
            statusTexto: estaConectado ? 'Conectado' : 'Inativa ou desconectado',
            isOnline: isOnline,
            syncEnabled: syncEnabled,
            lastSyncTime: lastSyncTime,
            lastPingTime: lastPingTime,
            lastError: lastError,
            empresaId: user?.empresaId || 'padrao',
            empresaNome: user?.empresaNome || 'Estabelecimento Ativo',
            dbId: 'ai-studio-lavajatodanilode-e261df4e-97bf-4fcf-8c9f-056d118147ca'
        };
    },
    testarConexao: async function() {
        if (!navigator.onLine) {
            connectionState = 'inativa';
            lastError = 'Sem conexão com a internet.';
            emitirMudancaStatus();
            return {
                sucesso: false,
                status: 'inativa',
                statusTexto: 'Inativa ou desconectado',
                mensagem: 'Seu dispositivo está sem sinal de internet no momento.'
            };
        }

        const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
        const empresaId = user?.empresaId || 'padrao';
        const inicio = performance.now();

        try {
            if (!db) throw new Error('Instância do Firestore não inicializada');
            const docRef = doc(db, 'empresas', empresaId, 'dados', 'config_negocio');
            await getDoc(docRef);
            const latencia = Math.round(performance.now() - inicio);

            connectionState = 'conectado';
            lastPingTime = new Date();
            lastError = null;
            emitirMudancaStatus();

            return {
                sucesso: true,
                status: 'conectado',
                statusTexto: 'Conectado',
                latenciaMs: latencia,
                mensagem: `Conexão bem-sucedida com o Firebase (${latencia}ms). Servidor ativo e sincronizado.`
            };
        } catch (err) {
            connectionState = 'inativa';
            lastError = err ? (err.message || String(err)) : 'Falha ao comunicar com Firebase';
            emitirMudancaStatus();

            return {
                sucesso: false,
                status: 'inativa',
                statusTexto: 'Inativa ou desconectado',
                mensagem: 'Não foi possível alcançar o servidor do banco de dados na nuvem.'
            };
        }
    }
};

window.FirebaseSync = FirebaseSync;

// Auto-refresh UI when cloud data changes
window.addEventListener('cloudDataChanged', (e) => {
    const key = e.detail;
    if (key === 'clientes' && typeof window.renderizarTabelaClientes === 'function') window.renderizarTabelaClientes();
    if (key === 'servicos' && typeof window.renderizarTabelaServicos === 'function') window.renderizarTabelaServicos();
    if (key === 'pedidos' && typeof window.renderizarTabelaPedidos === 'function') window.renderizarTabelaPedidos();
    if (key === 'caixas_fechados' && typeof window.renderizarTabelaCaixa === 'function') window.renderizarTabelaCaixa();
    if (key === 'agendamentos' && typeof window.renderizarAgenda === 'function') window.renderizarAgenda();
    if (key === 'equipe_membros' && typeof window.renderizarEquipe === 'function') window.renderizarEquipe();
    if (key === 'estoque_produtos' && typeof window.renderizarEstoque === 'function') window.renderizarEstoque();
    if ((key === 'pacotes_planos' || key === 'pacotes_clientes' || key === 'contas_financeiras' || key === 'faturamentos_lotes' || key === 'caixa_entradas') && typeof window.carregarDadosCaixa === 'function') window.carregarDadosCaixa();
    if (key === 'usuarios' && typeof window.renderizarUsuarios === 'function') window.renderizarUsuarios();
});

export default FirebaseSync;
export { FirebaseSync };
