import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { removerDemo, seed } from './seed.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.DB_PATH ?? path.join(dir, 'data', 'rota.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

/** Conexão única com o banco SQLite (arquivo em server/data/rota.db). */
export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;')

// ordem pensada para apagar dependentes antes (também inclui tabelas de versões antigas)
const TABELAS = [
  'sessoes', 'notificacoes', 'push_inscricoes', 'configuracoes', 'convites', 'mensagens', 'ocorrencias',
  'entrega_contatos', 'entrega_mensagens', 'comprovantes', 'entrega_eventos', 'posicoes', 'rotas_planejadas',
  'ativo_movimentacoes', 'ativo_historico', 'ativos', 'entregas', 'alerta_passos', 'alertas', 'equipe',
  'usuarios', 'empresas', 'geocache', 'sistema',
]

// versão do esquema: se o arquivo do banco for de uma versão anterior, ele é recriado
const VERSAO_ESQUEMA = 3
if (db.prepare('PRAGMA user_version').get().user_version < VERSAO_ESQUEMA) {
  db.exec('PRAGMA foreign_keys = OFF')
  for (const t of TABELAS) db.exec(`DROP TABLE IF EXISTS ${t}`)
  db.exec(`PRAGMA user_version = ${VERSAO_ESQUEMA}; PRAGMA foreign_keys = ON;`)
}
db.exec(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'))

/** Executa fn dentro de uma transação (tudo ou nada). */
export function transaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Apaga TODOS os dados e recria os de demonstração (npm run db:reset). */
export function resetDatabase() {
  transaction(() => {
    for (const t of TABELAS.filter((t) => t !== 'equipe')) db.exec(`DELETE FROM ${t}`)
    db.exec('DELETE FROM sqlite_sequence')
    seed(db)
  })
}

/** Restaura só a empresa e o cliente de demonstração — as demais empresas não são tocadas. */
export function restaurarDemo() {
  transaction(() => {
    removerDemo(db)
    seed(db)
  })
}

// primeira execução: popula com os dados de demonstração
if (db.prepare('SELECT COUNT(*) AS n FROM empresas').get().n === 0 && process.env.SEM_DEMO !== '1') {
  transaction(() => seed(db))
  console.log('[db] banco criado e populado com dados de demonstração')
}
