# Sistema de Gestão - Danilo Detailer (Lava Jato & Estética Automotiva)

Sistema completo de CRM, gestão operacional e controle financeiro desenvolvido especificamente para centros de estética automotiva e lava-jatos. Criado para proporcionar uma operação ágil, moderna, fluida e 100% livre de papel ou planilhas manuais.

🔗 **Link de Acesso (Preview):** [https://hugobalttazar.github.io/plataforma-multi-empresas/](https://hugobalttazar.github.io/plataforma-multi-empresas/)

---

## 📌 Sobre o Sistema

O sistema roda diretamente no navegador e opera no modelo **Local-First & Nuvem**, projetado para alta performance em celulares, tablets e computadores de balcão (PWA). Possui arquitetura multi-empresas, controle rigoroso de permissões por perfil de usuário, emissão de recibos digitais instantâneos, integrações com Google e regras inteligentes de pós-venda.

---

## 🚀 Principais Funcionalidades

### 📋 1. Gestão de Pedidos (Ordens de Serviço) & Vistoria
* **Abertura Rápida de O.S.:** Cadastro dinâmico com identificação do cliente, veículo (placa, modelo, cor) e serviços contratados.
* **Vistoria Expressa Integrada:** Checklist de entrada para registrar pertences, nível de combustível e avarias pré-existentes, garantindo segurança operacional.
* **Vínculo com a Equipe:** Atribuição do profissional executor com cálculo automático de comissão por serviço.
* **Recibo Digital em PNG:** Geração instantânea de recibo visual com logotipo da empresa, detalhamento de valores e QR Code Pix dinâmico com chave e valor.
* **Avisos via WhatsApp em 1 Clique:** Envio de mensagens prontas avisando que o veículo está pronto para retirada ou enviando o recibo digital.

### 📅 2. Agendamentos & Integração Google Calendar
* **Grade Visual de Horários:** Organização clara dos atendimentos diários, semanais e mensais.
* **Sincronização com Google Calendar:** Criação automática de eventos na agenda via Google API.
* **Convite ao Cliente:** Link gerado automaticamente para o cliente salvar o agendamento no próprio calendário via WhatsApp.

### 💰 3. Livro Caixa & Controle Financeiro
* **Lançamentos Automáticos:** Entrada automática de valores no fechamento de cada Ordem de Serviço.
* **Controle de Despesas & Sangrias:** Registro categorizado de saídas, compras e retiradas do caixa.
* **Fechamento de Caixa Diário:** Apuração em tempo real dos saldos por forma de pagamento (Dinheiro, Pix, Cartão de Crédito e Débito).
* **Extrato e Histórico:** Histórico completo de movimentações com filtros por data.

### 👥 4. Gestão de Equipe & Comissões (em Configurações)
* **Cadastro de Profissionais:** Registro de lavadores, detailers e operadores com definição de função.
* **Regras Flexíveis de Remuneração:** Suporte a comissão por porcentagem sobre o serviço (`%`) ou taxa fixa por veículo atendido (`R$`).
* **Apuração de Comissões por Período:** Relatório com filtros por data, total de veículos executados por membro, faturamento gerado e total a pagar.
* **Gestão Direta:** Ferramentas de edição e exclusão de integrantes com proteção contra exclusões acidentais.

### 📦 5. Controle de Estoque & Consumo de Insumos
* **Gestão de Produtos:** Cadastro de shampoos, ceras, vitrificadores, microfibras e insumos em geral.
* **Alertas de Estoque Mínimo:** Identificação visual de itens abaixo do ponto de reposição.
* **Baixa Operacional:** Registro de entradas de mercadoria e baixas vinculadas à execução de serviços.

### 🎁 6. Pós-Venda, Retenção & Cartão Fidelidade
* **Clientes sem Visita (Churn Prevention):** Radar automático de clientes sem retorno há mais de 25 ou 30 dias.
* **Controle de Pontos de Fidelidade:** Acúmulo de pontos configurável (ex: a cada 10 lavagens, 1 cortesia).
* **Disparos Prontos para WhatsApp:** Mensagens personalizadas de reconquista e consulta de saldo de fidelidade.

### 👤 7. Clientes & Histórico Veicular
* **Cadastro Completo:** Registro de clientes com telefone, endereço e histórico de placas atendidas.
* **Autopreenchimento Inteligente:** Reconhecimento automático dos dados do veículo e cliente ao digitar a placa ou nome.
* **Histórico Detalhado:** Acesso rápido a todas as ordens de serviço anteriores realizadas para o cliente.

### 🛠️ 8. Catálogo de Serviços
* **Tabela de Preços Padronizada:** Cadastro de serviços e valores por categoria de veículo (Pequeno, Médio, SUV, Caminhonete, Moto).
* **Agilidade na Emissão:** Inclusão rápida de serviços na O.S. com cálculo de totais em tempo real.

### 🏢 9. Arquitetura Multi-Empresas (Multi-Tenant)
* **Gestão de Múltiplos Negócios:** Permite ao Administrador Master gerenciar empresas isoladas na mesma plataforma (Lava-Jato, Barbearia, etc.).
* **Isolamento Completo de Dados:** Cada empresa possui seus próprios clientes, serviços, estoque, agendamentos, equipe e caixa.
* **Alternância Fácil:** Troca rápida de empresa ativa diretamente pelo painel administrativo.

### 🔐 10. Perfis de Acesso & Segurança (RBAC)
* **Níveis de Permissão:** Administrador Master, Administrador, Operador e Caixa.
* **Proteção de Rotas:** Bloqueio automático de telas e botões de acordo com os privilégios do usuário logado.
* **Tela de Bloqueio/Login:** Autenticação rápida e saída segura (`Logout`) disponível no cabeçalho.

### 💾 11. Banco de Dados, Planilhas Excel & Backup
* **Banco Local & Nuvem:** Armazenamento local-first veloz e integração com Firestore e Google Drive.
* **Exportação/Importação Excel (.xlsx):** Compatibilidade para download e upload de todas as tabelas em formato de planilha.
* **Backup Completo em JSON:** Exportação integral da base de dados e restauração facilitada.

### 🎨 12. Interface Fluida & Componentes Padronizados
* **Modais & Toasts Nativos da Aplicação (`window.UI`):** Diálogos customizados e notificações suaves, eliminando janelas bloqueantes (`confirm`/`alert`) para compatibilidade perfeita com PWA e iFrames.
* **Design Responsivo & Microinterações:** Animações sutis, indicador visual de foco, scrollbar customizada e toque adaptado para telas mobile.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5 Semântico, CSS3 Moderno (Variáveis CSS, Flexbox/Grid, Microinterações), JavaScript Vanilla (ES6+ modular).
* **Manipulação de Planilhas:** SheetJS (`xlsx.full.min.js`) para leitura e escrita de planilhas Excel diretamente no cliente.
* **Geração de Imagens & Recibos:** HTML5 Canvas para desenho dinâmico de recibos PNG em alta resolução.
* **QR Code:** Geração dinâmica de QR Code Pix padrão BACEN.
* **Integrações de API:** Google Calendar API, Google Drive API e links de protocolo direto do WhatsApp Web/App.
* **Armazenamento:** LocalStorage Local-First e Firebase Firestore na nuvem.

---

## 📂 Estrutura de Navegação

* `index.html`: Painel inicial com resumo do dia, métricas de faturamento e atalhos rápidos.
* `agendamentos.html`: Calendário e agenda diária de serviços.
* `pedidos.html`: Abertura e controle de Ordens de Serviço (O.S.) e vistorias.
* `caixa.html`: Livro caixa, entradas, saídas e fechamento financeiro.
* `estoque.html`: Controle de materiais, insumos e saldo de estoque.
* `fidelidade.html`: Radar de pós-venda e pontuação de fidelidade.
* `clientes.html`: Base de clientes e histórico de atendimento.
* `servicos.html`: Tabela de preços e catálogo de serviços.
* `historico.html`: Histórico detalhado de O.S. por cliente.
* `configuracoes.html`: Gestão de negócios, equipe & comissões, usuários, backup e multi-empresas.

---

## ⚙️ Configuração Local

1. Clone ou faça o download deste repositório.
2. Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Safari, Firefox).
3. Caso deseje executar com servidor local:
   ```bash
   # Utilizando Python
   python3 -m http.server 3000
   
   # Ou utilizando Node.js (npx serve)
   npx serve . -p 3000
   ```
4. Acesse `http://localhost:3000` no seu navegador.

