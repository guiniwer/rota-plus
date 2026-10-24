-- Esquema do banco de dados do Rota+ (SQLite) — versão 3
-- Todas as datas são ISO 8601 em UTC (ex.: 2026-10-21T14:05:00.000Z).
-- Cada empresa (CNPJ) é um "inquilino": entregas, ativos, alertas e equipe pertencem a uma empresa.

CREATE TABLE IF NOT EXISTS empresas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj            TEXT    NOT NULL UNIQUE,          -- só dígitos
  razao_social    TEXT    NOT NULL,
  fantasia        TEXT,
  segmento        TEXT,
  email           TEXT,
  telefone        TEXT,
  endereco        TEXT,                             -- endereço da base / CD principal
  base_lat        REAL,
  base_lng        REAL,
  turno_inicio    TEXT    NOT NULL DEFAULT '07:00', -- expediente (horário local)
  turno_fim       TEXT    NOT NULL DEFAULT '19:00',
  fuso            TEXT    NOT NULL DEFAULT 'America/Recife',
  privacidade     TEXT    NOT NULL DEFAULT '{}',    -- JSON (LGPD)
  api_key         TEXT    UNIQUE,                   -- integração ERP / API REST
  webhook_url     TEXT,
  webhook_segredo TEXT,
  demo            INTEGER NOT NULL DEFAULT 0,       -- empresa de demonstração (pode ser restaurada)
  criado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  perfil            TEXT    NOT NULL CHECK (perfil IN ('cliente', 'empresa')),
  funcao            TEXT    CHECK (funcao IN ('admin', 'entregador')), -- só para perfil empresa
  empresa_id        INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  nome              TEXT    NOT NULL,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash        TEXT    NOT NULL,
  documento         TEXT,               -- CPF/CNPJ do cliente (só dígitos)
  telefone          TEXT,
  veiculo           TEXT,               -- entregador
  base_nome         TEXT,               -- base própria do entregador (senão, a da empresa)
  base_lat          REAL,
  base_lng          REAL,
  ultima_lat        REAL,               -- última posição GPS enviada pelo app do entregador
  ultima_lng        REAL,
  ultima_precisao   REAL,
  ultima_posicao_em TEXT,
  criado_em         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS entregas (
  id                    TEXT    PRIMARY KEY,
  empresa_id            INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE, -- transportadora
  usuario_id            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,          -- cliente dono do pedido
  cliente               TEXT    NOT NULL,
  documento             TEXT,
  remetente             TEXT,
  destinatario          TEXT,
  telefone_destinatario TEXT,
  email_destinatario    TEXT,
  origem                TEXT,
  destino               TEXT,
  destino_cidade        TEXT,           -- id de src/data/cidades.js
  tipo_carga            TEXT,
  peso_taxado           REAL    NOT NULL DEFAULT 0,
  modalidade            TEXT    NOT NULL DEFAULT 'normal',
  rastreio              TEXT    NOT NULL DEFAULT 'cd',
  valor                 REAL    NOT NULL DEFAULT 0,
  valor_nf              REAL    NOT NULL DEFAULT 0,
  status                TEXT    NOT NULL DEFAULT 'confirmado',
  criado_em             TEXT    NOT NULL,
  prazo_limite          TEXT,           -- fim da janela / prazo prometido
  janela                TEXT,           -- texto "14:00–15:00" (horário local)
  entregue_em           TEXT,
  responsavel           TEXT,
  entregador_id         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  origem_lat            REAL,
  origem_lng            REAL,
  lat                   REAL,           -- coordenadas do destino
  lng                   REAL,
  geo_fonte             TEXT,           -- 'endereco' (geocodificado) | 'cidade' (aproximado) | 'manual'
  instrucoes            TEXT,           -- recados do destinatário ao entregador
  avaliacao_nota        INTEGER,
  avaliacao_estado      TEXT,
  avaliacao_comentario  TEXT,
  avaliado_em           TEXT
);

CREATE TABLE IF NOT EXISTS entrega_eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id  TEXT    NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  status      TEXT,
  titulo      TEXT    NOT NULL,
  descricao   TEXT,
  lat         REAL,
  lng         REAL,
  autor_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em   TEXT    NOT NULL
);

-- comprovante registrado pelo entregador (foto e assinatura em data URL)
CREATE TABLE IF NOT EXISTS comprovantes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id         TEXT    NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  resultado          TEXT    NOT NULL CHECK (resultado IN ('entregue', 'tentativa', 'avaria')),
  recebedor          TEXT,
  documento          TEXT,
  foto               TEXT,
  assinatura         TEXT,
  lat                REAL,
  lng                REAL,
  precisao           REAL,
  volumes_conferidos INTEGER NOT NULL DEFAULT 0,
  entregador_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em          TEXT    NOT NULL
);

-- conversa entre cliente e entregador/central sobre uma entrega
CREATE TABLE IF NOT EXISTS entrega_mensagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id  TEXT    NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  autor_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nome  TEXT    NOT NULL,
  autor_papel TEXT    NOT NULL,
  texto       TEXT    NOT NULL,
  criado_em   TEXT    NOT NULL
);

-- e-mails cadastrados no rastreio público para receber avisos
CREATE TABLE IF NOT EXISTS entrega_contatos (
  entrega_id  TEXT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  email       TEXT NOT NULL COLLATE NOCASE,
  criado_em   TEXT NOT NULL,
  PRIMARY KEY (entrega_id, email)
);

-- nome = tipo de ativo genérico (ex.: "Gerador de energia", "Caixa"); tipo = categoria
CREATE TABLE IF NOT EXISTS ativos (
  id                TEXT    PRIMARY KEY,
  empresa_id        INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome              TEXT    NOT NULL,
  tipo              TEXT    NOT NULL CHECK (tipo IN ('Veículo', 'Equipamento', 'Ferramenta', 'Carga')),
  entrega_id        TEXT    UNIQUE REFERENCES entregas(id) ON DELETE CASCADE, -- toda entrega vira um ativo "Carga"
  identificacao     TEXT    NOT NULL,
  dispositivo_token TEXT    UNIQUE,     -- rastreador GPS que envia posições para a API
  bateria           INTEGER,            -- só quando informada pelo rastreador
  responsavel       TEXT,
  responsavel_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  local             TEXT,
  lat               REAL,
  lng               REAL,
  ultima_leitura_em TEXT,
  status            TEXT    NOT NULL DEFAULT 'disponivel',
  valor             REAL    NOT NULL DEFAULT 0,
  criado_em         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS ativo_historico (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ativo_id   TEXT    NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  titulo     TEXT    NOT NULL,
  descricao  TEXT,
  cor        TEXT,
  criado_em  TEXT    NOT NULL
);

-- check-out / check-in: base do cálculo de utilização
CREATE TABLE IF NOT EXISTS ativo_movimentacoes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ativo_id        TEXT    NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  tipo            TEXT    NOT NULL CHECK (tipo IN ('checkout', 'checkin')),
  responsavel     TEXT,
  responsavel_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  local           TEXT,
  lat             REAL,
  lng             REAL,
  via             TEXT    NOT NULL DEFAULT 'manual', -- 'qr' | 'rfid' | 'manual'
  criado_em       TEXT    NOT NULL
);

-- trilha de posições (app do entregador e rastreadores dos ativos)
CREATE TABLE IF NOT EXISTS posicoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  ativo_id    TEXT    REFERENCES ativos(id) ON DELETE CASCADE,
  lat         REAL    NOT NULL,
  lng         REAL    NOT NULL,
  precisao    REAL,
  velocidade  REAL,
  criado_em   TEXT    NOT NULL
);

-- última rota calculada para cada entregador (usada na detecção de desvio)
CREATE TABLE IF NOT EXISTS rotas_planejadas (
  entregador_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  paradas       TEXT NOT NULL,   -- JSON: ids das entregas na ordem
  trajeto       TEXT NOT NULL,   -- JSON: [[lat, lng], ...]
  fonte         TEXT NOT NULL,
  distancia_km  REAL NOT NULL,
  duracao_min   REAL NOT NULL,
  calculada_em  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alertas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id   INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo         TEXT    NOT NULL,
  severidade   TEXT    NOT NULL,
  titulo       TEXT    NOT NULL,
  descricao    TEXT,
  entidade     TEXT,
  referencia   TEXT,              -- id da entrega / ativo / entregador
  chave        TEXT    NOT NULL,  -- evita abrir o mesmo alerta duas vezes
  aberto_em    TEXT    NOT NULL,
  sla_min      INTEGER NOT NULL,
  responsavel  TEXT,
  status       TEXT    NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'tratamento', 'resolvido')),
  resolvido_em TEXT,
  resolucao    TEXT               -- 'manual' | 'automatica'
);

CREATE TABLE IF NOT EXISTS alerta_passos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id  INTEGER NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL,
  texto      TEXT    NOT NULL,
  feito      INTEGER NOT NULL DEFAULT 0
);

-- problemas reportados pelo cliente
CREATE TABLE IF NOT EXISTS ocorrencias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id  TEXT    NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo      TEXT    NOT NULL,
  detalhes    TEXT,
  criado_em   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  icon        TEXT,
  cor         TEXT,
  titulo      TEXT NOT NULL,
  texto       TEXT,
  link        TEXT,
  criado_em   TEXT NOT NULL,
  lida        INTEGER NOT NULL DEFAULT 0
);

-- inscrições de notificação push do navegador (Web Push)
CREATE TABLE IF NOT EXISTS push_inscricoes (
  endpoint    TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  p256dh      TEXT    NOT NULL,
  auth        TEXT    NOT NULL,
  criado_em   TEXT    NOT NULL
);

-- caixa de saída: e-mails, links de WhatsApp e webhooks disparados
CREATE TABLE IF NOT EXISTS mensagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  entrega_id  TEXT,
  canal       TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp', 'webhook', 'push')),
  destino     TEXT NOT NULL,
  assunto     TEXT,
  corpo       TEXT,
  status      TEXT NOT NULL,    -- 'enviado' | 'nao_configurado' | 'falhou' | 'link'
  erro        TEXT,
  criado_em   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS convites (
  token       TEXT    PRIMARY KEY,
  empresa_id  INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email       TEXT,
  criado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em   TEXT    NOT NULL,
  usado_em    TEXT
);

-- preferências do usuário (chave/valor JSON)
CREATE TABLE IF NOT EXISTS configuracoes (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave       TEXT    NOT NULL,
  valor       TEXT    NOT NULL,
  PRIMARY KEY (usuario_id, chave)
);

-- chaves internas (ex.: VAPID do Web Push)
CREATE TABLE IF NOT EXISTS sistema (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);

-- cache de geocodificação (Nominatim / OpenStreetMap)
CREATE TABLE IF NOT EXISTS geocache (
  consulta   TEXT PRIMARY KEY,
  lat        REAL,
  lng        REAL,
  nome       TEXT,              -- endereço reverso (coordenada → nome do lugar)
  criado_em  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_entregas_empresa ON entregas(empresa_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_entregas_usuario ON entregas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_entregas_entregador ON entregas(entregador_id);
CREATE INDEX IF NOT EXISTS idx_eventos_entrega ON entrega_eventos(entrega_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_entrega ON comprovantes(entrega_id);
CREATE INDEX IF NOT EXISTS idx_ativos_empresa ON ativos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_historico_ativo ON ativo_historico(ativo_id);
CREATE INDEX IF NOT EXISTS idx_mov_ativo ON ativo_movimentacoes(ativo_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_posicoes_usuario ON posicoes(usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_posicoes_ativo ON posicoes(ativo_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa ON alertas(empresa_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_chave_aberta ON alertas(empresa_id, chave) WHERE status <> 'resolvido';
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_empresa ON mensagens(empresa_id, criado_em);
