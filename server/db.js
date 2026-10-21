import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { seed } from './seed.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.DB_PATH ?? path.join(dir, 'data', 'rota.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

/** Conexão única com o banco SQLite (arquivo em server/data/rota.db). */
export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')

const TABELAS = ['sessoes', 'notificacoes', 'configuracoes', 'entrega_eventos', 'ativo_historico', 'ativos', 'entregas', 'alerta_passos', 'alertas', 'equipe', 'usuarios']

// versão do esquema: se o arquivo do banco for de uma versão anterior, ele é recriado
const VERSAO_ESQUEMA = 2
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

/** Apaga os dados e recria os registros de demonstração. */
export function resetDatabase() {
  transaction(() => {
    for (const t of TABELAS) db.exec(`DELETE FROM ${t}`)
    db.exec("DELETE FROM sqlite_sequence")
    seed(db)
  })
}

// primeira execução: popula com os dados de demonstração
if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n === 0) {
  transaction(() => seed(db))
  console.log('[db] banco criado e populado com dados de demonstração')
}
