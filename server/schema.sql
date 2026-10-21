-- Esquema do banco de dados do Rota+ (SQLite)

CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  perfil      TEXT    NOT NULL CHECK (perfil IN ('cliente', 'empresa')),
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash  TEXT    NOT NULL,
  documento   TEXT,               -- CPF/CNPJ do cliente (só dígitos)
  empresa     TEXT,
  cargo       TEXT,
  cnpj        TEXT,               -- CNPJ da empresa (só dígitos)
  funcao      TEXT    CHECK (funcao IN ('admin', 'entregador')), -- só para perfil empresa
  telefone    TEXT,
  veiculo     TEXT,               -- entregador
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entregas (
  id                    TEXT    PRIMARY KEY,
  usuario_id            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, -- cliente dono do pedido
  cliente               TEXT    NOT NULL,
  documento             TEXT,
  remetente             TEXT,
  destinatario          TEXT,
  origem                TEXT,
  destino               TEXT,
  tipo_carga            TEXT,
  peso_taxado           REAL    NOT NULL DEFAULT 0,
  modalidade            TEXT    NOT NULL DEFAULT 'normal',
  rastreio              TEXT    NOT NULL DEFAULT 'cd',
  valor                 REAL    NOT NULL DEFAULT 0,
  status                TEXT    NOT NULL DEFAULT 'confirmado',
  criado_em             TEXT,
  previsao              TEXT,
  janela                TEXT,
  responsavel           TEXT,
  entregador_id         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, -- entregador designado
  lat                   REAL,   -- coordenadas do destino (usadas na otimização de rota)
  lng                   REAL,
  progresso             REAL    NOT NULL DEFAULT 0,
  avaliacao_nota        INTEGER,
  avaliacao_estado      TEXT,
  avaliacao_comentario  TEXT,
  ordem                 INTEGER NOT NULL DEFAULT 0   -- mais recente = maior
);

CREATE TABLE IF NOT EXISTS entrega_eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id  TEXT    NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  titulo      TEXT    NOT NULL,
  descricao   TEXT,
  data        TEXT
);

-- nome = tipo de ativo genérico (ex.: "Gerador de energia", "Caixa"); tipo = categoria
CREATE TABLE IF NOT EXISTS ativos (
  id             TEXT    PRIMARY KEY,
  nome           TEXT    NOT NULL,
  tipo           TEXT    NOT NULL CHECK (tipo IN ('Veículo', 'Equipamento', 'Ferramenta', 'Carga')),
  entrega_id     TEXT    UNIQUE REFERENCES entregas(id) ON DELETE CASCADE, -- toda entrega vira um ativo "Carga"
  identificacao  TEXT    NOT NULL,
  bateria        INTEGER,
  responsavel    TEXT,
  local          TEXT,
  ultima_leitura TEXT,
  status         TEXT    NOT NULL DEFAULT 'disponivel',
  valor          REAL    NOT NULL DEFAULT 0,
  x              REAL,
  y              REAL,
  uso            TEXT    NOT NULL DEFAULT '[]',   -- horas de uso por dia (JSON)
  ordem          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ativo_historico (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ativo_id   TEXT    NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  titulo     TEXT    NOT NULL,
  descricao  TEXT,
  data       TEXT,
  cor        TEXT
);

CREATE TABLE IF NOT EXISTS alertas (
  id           TEXT PRIMARY KEY,
  tipo         TEXT NOT NULL,
  severidade   TEXT NOT NULL,
  titulo       TEXT NOT NULL,
  descricao    TEXT,
  entidade     TEXT,
  aberto       TEXT,
  sla          TEXT,
  responsavel  TEXT,
  status       TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'tratamento', 'resolvido'))
);

CREATE TABLE IF NOT EXISTS alerta_passos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id  TEXT    NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL,
  texto      TEXT    NOT NULL,
  feito      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  icon        TEXT,
  cor         TEXT,
  titulo      TEXT NOT NULL,
  texto       TEXT,
  quando      TEXT,
  grupo       TEXT NOT NULL DEFAULT 'Hoje',
  lida        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipe (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE, -- login do entregador (se tiver)
  nome     TEXT NOT NULL,
  funcao   TEXT,
  base     TEXT,
  veiculo  TEXT,
  hoje     TEXT,
  prazo    TEXT,
  adesao   INTEGER,
  status   TEXT
);

-- configurações em formato chave/valor (JSON): preferências do usuário e privacidade da empresa
CREATE TABLE IF NOT EXISTS configuracoes (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave       TEXT    NOT NULL,
  valor       TEXT    NOT NULL,
  PRIMARY KEY (usuario_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_entregas_usuario ON entregas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_entregas_entregador ON entregas(entregador_id);
CREATE INDEX IF NOT EXISTS idx_eventos_entrega ON entrega_eventos(entrega_id);
CREATE INDEX IF NOT EXISTS idx_historico_ativo ON ativo_historico(ativo_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
