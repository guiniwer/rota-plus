# Rota+ — Rastreabilidade de entregas e ativos

Aplicação web **full stack** (React + Node.js/Express + banco de dados **SQLite**) que dá visibilidade ponta a ponta sobre entregas, equipamentos, ferramentas, veículos e mercadorias. Ela atende tanto quem **envia ou recebe** uma encomenda quanto a **empresa** que gerencia a operação.

![Página inicial](docs/screenshots/landing.png)

---

## Problema escolhido

**[Rastreabilidade de entregas e ativos](https://coreto.app.emprel.gov.br/banco-de-bo/rastreabilidade-de-entregas-e-ativos)**: desafio publicado pela Prefeitura do Recife no Banco de Desafios da plataforma C.O.R.E.T.O.

Empresas que dependem de mercadorias, equipamentos ou equipes externas em circulação têm dificuldade para saber, em tempo real:

- onde estão seus ativos;
- qual é o status das entregas;
- quem é o responsável por cada item;
- quais riscos podem afetar prazos e custos.

Muitas ainda dependem de ligações, mensagens e planilhas. O resultado são atrasos, perdas, extravios, retrabalho, conflitos com clientes e pouca previsibilidade. O desafio pede uma solução **acessível e adaptada a empresas de diferentes portes**, com:

- registro de localização, responsável, status e histórico de uso e movimentação;
- alertas de atraso, desvio de rota, inatividade, perda de sinal e uso indevido;
- painel com visão geral da operação, entregas pendentes, ativos disponíveis e gargalos;
- interface simples para as equipes de campo atualizarem o status;
- melhor comunicação com clientes;
- relatórios de desempenho;
- cuidados com LGPD quando o rastreamento envolve pessoas.

## Solução proposta

O **Rota+** é um site responsivo com três frentes:

| Frente | Para quem | O que resolve |
|---|---|---|
| **Site público** | Qualquer pessoa | Apresentação, cotação de frete e **rastreio sem login** (código + CPF/CNPJ) |
| **Área do cliente** | Quem envia ou recebe | Fazer pedido com cálculo de frete, acompanhar no mapa, ver previsão, histórico, notificações e avaliar a entrega |
| **Área da empresa** | Gestores e equipes de campo | Painel da operação, entregas, ativos (QR/RFID/GPS), mapa ao vivo, central de alertas com fluxo de resposta, equipes, relatórios, configurações (LGPD, integrações) e **app de campo** com comprovante (foto + assinatura) e modo offline |

O visual segue o protótipo feito no Figma (telas mobile originais + versões desktop).

### Como cada requisito do desafio foi atendido

| Requisito do desafio | Onde está no sistema |
|---|---|
| Localização, responsável, status e histórico do ativo | `Ativos` › `Detalhe do ativo` (histórico de movimentação, uso em horas/dia, check-in/out, transferência) |
| Alertas: atraso, desvio, inatividade, perda de sinal, uso indevido | `Central de alertas`, com contadores por tipo, prazo de resposta (SLA), checklist do fluxo de resposta, assumir e resolver |
| Painel com visão geral, pendências, ativos disponíveis e gargalos | `Painel da operação` |
| Interface simples para a equipe de campo | `App de campo` (rota do dia, registro com foto, assinatura e GPS, modo offline com fila de sincronização) e `Escanear QR Code` |
| Comunicação com clientes | Rastreio público, link de rastreio compartilhável, notificações, reagendamento e avaliação |
| Relatórios de desempenho | `Relatórios` (no prazo por período, utilização por tipo de ativo, alertas tratados) com exportação em CSV |
| LGPD e risco de controle excessivo | Rastreamento de pessoas só no expediente, termo de ciência e anonimização após 90 dias (`Equipes` e `Configurações`) |
| Empresas de diferentes portes | Identificação por QR (barato), RFID ou GPS, e planos por quantidade de ativos |
| Integração com outros sistemas | `Configurações › Integrações` (ERP, WMS, CSV, API/Webhooks, WhatsApp, CMMS) |

### Regras de frete (Novo pedido e Cotação)

- **Peso cubado** = (C × L × A em m³) × 300. O valor cobrado usa o **maior** entre o peso real e o peso cubado.
- **Tipo de carga:** Documentos/Envelopes (peso fixo) ou Caixas (com dimensões e peso).
- **Tipo de entrega:** Normal ou **Mais rápida** (+ R$ 15,00).
- **Tipo de rastreamento:** por centro de distribuição (incluso) ou **por GPS** (+ R$ 50,00).
- **Taxas:** ad valorem (0,3% da NF), GRIS (0,2%), pedágios e ICMS (12%).

---

## Tecnologias

**Front-end**
- **React 19** com componentes funcionais
- **Vite** (build e servidor de desenvolvimento, com proxy para a API)
- **React Router** (`HashRouter`)
- **HTML, CSS puro** (variáveis CSS, Grid e Flexbox, media queries) e **JavaScript (ES2023)**
- Sem bibliotecas de UI: todos os componentes foram feitos no projeto

**Back-end e banco de dados**
- **Node.js + Express 5**: API REST em `/api`
- **SQLite** pelo módulo nativo `node:sqlite` do Node.js. Não é preciso instalar servidor de banco nem compilar nada: o banco é um arquivo (`server/data/rota.db`) criado e populado automaticamente na primeira execução
- Senhas com hash **scrypt** + salt; sessões por token (`Authorization: Bearer`)
- Controle de acesso por perfil: o cliente só vê as próprias entregas; ativos, alertas e equipe são exclusivos da empresa

## Banco de dados

### Arquitetura

```
 Navegador (React)  ──fetch /api──▶  Express (server/index.js)  ──SQL──▶  SQLite (server/data/rota.db)
   src/services/api.js                server/routes/*.js                  server/schema.sql
   src/context/AppContext.jsx         server/auth.js (sessão e perfil)    server/seed.js (dados iniciais)
```

Toda ação na interface grava no banco: pedido, mudança de status, check-in/out, avaliação, alertas, notificações e configurações. Por isso os dados continuam lá depois de recarregar a página, trocar de navegador ou reiniciar o servidor. O front-end busca novidades a cada 10 s. Assim, quando a empresa muda o status de uma entrega, o cliente vê a alteração e recebe uma notificação.

### Tabelas (`server/schema.sql`)

| Tabela | Conteúdo |
|---|---|
| `usuarios` | Clientes e empresas (perfil, e-mail único, hash da senha, CPF/CNPJ) |
| `sessoes` | Tokens de login ativos |
| `entregas` | Pedidos: cliente dono, origem/destino, modalidade, tipo de rastreio, valor, status, responsável, avaliação |
| `entrega_eventos` | Linha do tempo de cada entrega (cada mudança de status gera um evento) |
| `ativos` | Equipamentos, ferramentas, veículos e mercadorias: identificação (QR/RFID/GPS), responsável, local, status, horas de uso |
| `ativo_historico` | Movimentações e responsáveis ao longo do tempo (check-in/out, transferências, extravio) |
| `alertas` / `alerta_passos` | Alertas operacionais e o checklist do fluxo de resposta |
| `notificacoes` | Notificações de cada usuário |
| `equipe` | Colaboradores de campo e adesão ao registro no app |
| `configuracoes` | Preferências do cliente e regras de privacidade (LGPD) da empresa (chave/valor JSON) |

### Endpoints da API

| Método e rota | Descrição | Acesso |
|---|---|---|
| `POST /api/auth/login` · `POST /api/auth/cadastro` | Entrar / criar conta (devolve token) | público |
| `GET /api/auth/me` · `POST /api/auth/logout` | Sessão atual / sair | logado |
| `GET /api/rastreio?codigo=&documento=` | Rastreio sem login (código + CPF/CNPJ precisam conferir) | público |
| `GET /api/entregas` · `POST /api/entregas` | Listar (cliente vê só as suas) / criar pedido | logado |
| `PATCH /api/entregas/:id/status` · `PATCH /api/entregas/:id/responsavel` | Atualizar status (gera evento + notifica o cliente) / atribuir | empresa |
| `POST /api/entregas/:id/avaliacao` | Avaliar entrega recebida | dono da entrega |
| `GET /api/ativos` · `POST /api/ativos` | Listar / cadastrar ativo | empresa |
| `POST /api/ativos/:id/movimentacao` · `PATCH /api/ativos/:id/responsavel` · `POST /api/ativos/:id/extraviado` | Check-in/out, transferência, extravio | empresa |
| `GET /api/alertas` · `POST /api/alertas/:id/assumir` · `POST /api/alertas/:id/resolver` · `PATCH /api/alertas/:id/passos/:ordem` | Central de alertas | empresa |
| `GET /api/notificacoes` · `POST /api/notificacoes/lidas` | Notificações do usuário | logado |
| `GET/PUT /api/configuracoes/:chave` | Preferências / privacidade | logado |
| `GET /api/equipe` · `POST /api/demo/reset` | Equipe de campo / restaurar dados de demonstração | empresa |

### Recursos do React utilizados

- **`useState`**: formulários, filtros, abas, modais, paginação, estrelas da avaliação, modo offline etc.
- **`useEffect`**: carregar os dados da API, atualização periódica, contagem regressiva da previsão, simulação do veículo, atalho `Esc` no modal.
- **`useMemo`**, **`useRef`** (assinatura em `<canvas>`), **`useId`** (rótulos acessíveis), **`useContext`** (estado global alimentado pela API).
- **Hooks próprios:** `useSimulatedProgress`, `useEntregaSelecionada`.
- **Props:** todos os componentes de UI são configurados por props (`Button variant`, `Badge tone`, `DataTable columns/rows`, `MapView markers/progress` etc.).
- **Eventos:** `onClick`, `onChange`, `onSubmit`, `onMouseEnter` (estrelas), eventos de ponteiro (assinatura), `keydown` global (fechar modal com `Esc`).

## Responsividade

| Largura | Comportamento |
|---|---|
| ≥ 1024 px (desktop) | Sidebar completa + conteúdo em grid com coluna lateral |
| 768 – 1023 px (tablet) | Sidebar só com ícones; a coluna lateral desce para baixo do conteúdo |
| < 768 px (celular) | **Barra inferior** com botão central (+ Novo pedido / Escanear QR), menu lateral deslizante e **tabelas que viram cards** |

<p>
  <img src="docs/screenshots/mobile-cliente.png" alt="Versão mobile" width="260" />
</p>

## Estrutura de pastas

```
rota-plus/
├── index.html
├── public/favicon.svg
├── docs/screenshots/            # imagens usadas neste README
├── server/                      # back-end (API + banco)
│   ├── index.js                 # servidor Express (API em /api e, no build, o site)
│   ├── db.js                    # conexão SQLite, transações e criação automática do banco
│   ├── schema.sql               # tabelas e índices
│   ├── seed.js · seedData.js    # dados de demonstração inseridos na 1ª execução
│   ├── auth.js                  # hash de senha, sessões e controle de acesso por perfil
│   ├── mappers.js               # converte linhas do banco para o formato do front-end
│   ├── reset.js                 # npm run db:reset
│   ├── routes/                  # auth, entregas, ativos, alertas, notificações/configurações
│   └── data/rota.db             # arquivo do banco (gerado, fora do Git)
└── src/
    ├── main.jsx                 # ponto de entrada
    ├── App.jsx                  # rotas da aplicação
    ├── services/api.js          # cliente HTTP da API (fetch + token)
    ├── context/AppContext.jsx   # estado global carregado da API + ações (pedido, check-in, alertas…)
    ├── hooks/                   # hooks personalizados
    ├── data/contasDemo.js       # credenciais das contas de demonstração
    ├── utils/                   # regras de negócio (frete, status, formatação, mapa) — usadas também pela API
    ├── styles/                  # global, layout, componentes e páginas (CSS puro)
    ├── components/
    │   ├── ui/                  # Button, Card, Badge, Field, DataTable, MapView, Modal, Stepper…
    │   ├── layout/              # Sidebar, Topbar, BottomNav, Page, layouts público/logado
    │   └── entregas/            # componentes de domínio (badges de status, resultado de rastreio)
    └── pages/
        ├── publico/             # Landing, Login, Cadastro, Rastreio sem login
        ├── cliente/             # Início, Novo pedido, Acompanhar, Status, Previsão, Histórico, Notificações, Avaliar
        └── empresa/             # Painel, Entregas, Ativos, Detalhe do ativo, Mapa, Alertas, Equipes,
                                 # Relatórios, App de campo, Escanear, Configurações
```

---

## Como executar

**Pré-requisito:** [Node.js](https://nodejs.org/) **22.13 ou superior** (com npm). O banco SQLite usa o módulo `node:sqlite`, que já vem no Node; não é preciso instalar banco de dados.

```bash
# 1. clonar o repositório
git clone https://github.com/guiniwer/rota-plus.git
cd rota-plus

# 2. instalar as dependências
npm install

# 3. rodar API + site juntos (modo desenvolvimento)
npm run dev
```

Abra **http://localhost:5173**. A API sobe na porta **3001**. Na primeira execução, o banco `server/data/rota.db` é criado e populado sozinho; o terminal mostra `[db] banco criado e populado`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API (porta 3001) e o site (porta 5173) juntos |
| `npm run build` e depois `npm start` | Versão de produção: um único servidor em **http://localhost:3001** com site + API |
| `npm run db:reset` | Apaga os dados e recria o banco com os dados de demonstração |
| `npm run lint` | Verifica o código com o oxlint |

### Contas de demonstração

As contas abaixo são criadas no banco na primeira execução. Na tela de login, clique em **"Preencher com dados de demonstração"**, ou crie uma conta nova em **Cadastre-se**:

| Perfil | Como entrar |
|---|---|
| Usuário (cliente) | aba **Usuário** → e-mail `jhonata@email.com`, senha `demo123` |
| Empresa | aba **Empresa** → e-mail `luis@logisuape.com.br`, CNPJ `12.345.678/0001-90`, senha `demo123` |
| Rastreio sem login | menu **Rastrear** → código `RT-90827-BR` + CPF `123.456.789-00` |

Para voltar aos dados iniciais, rode `npm run db:reset` ou use **Empresa › Configurações › Dispositivos e plano › Restaurar dados**.

### Roteiro sugerido para avaliação

1. **Cliente:** faça um *Novo pedido* (troque Caixas/Documentos, Expressa e GPS e veja o frete mudar), depois veja o pedido em *Status* e *Acompanhar*.
2. Saia e entre como **Empresa:** o pedido aparece em *Entregas*. Atribua um responsável e mude o status.
3. Abra o **App de campo**, registre a entrega com foto e assinatura. Teste também desligando a "conexão" para ver a fila offline.
4. Em **Ativos**, abra o gerador `ATV-00412`, faça check-out/check-in e veja o histórico. Em **Escanear**, digite `ATV-00412`.
5. Na **Central de alertas**, marque etapas do fluxo de resposta, assuma e resolva um alerta.
6. Abra o site em **outro navegador** (ou aba anônima) como cliente: o status alterado pela empresa aparece em até 10 s, porque está no banco.
7. Reinicie o servidor (`Ctrl+C` e `npm run dev`): todos os dados continuam lá.
8. Reduza a largura da janela para ver as versões tablet e celular.

## Capturas de tela

| Área do cliente | Novo pedido |
|---|---|
| ![](docs/screenshots/cliente-inicio.png) | ![](docs/screenshots/novo-pedido.png) |

| Painel da empresa | Detalhe do ativo |
|---|---|
| ![](docs/screenshots/empresa-painel.png) | ![](docs/screenshots/ativo-detalhe.png) |

| Central de alertas | App de campo |
|---|---|
| ![](docs/screenshots/alertas.png) | ![](docs/screenshots/app-campo.png) |

---

## Equipe

- Arthur Vinícius — 01798631
- Güiniwer Mendes Buñol — 01783298
- Iderlan Fortaleza Arraes de Carvalho — 01779143
- Jhonata Soares Alves da Silva — 01796007
- Luís Simões Veras Filho — 01219274
