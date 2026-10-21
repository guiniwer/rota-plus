// npm run db:reset — recria o banco com os dados de demonstração
import { resetDatabase } from './db.js'

resetDatabase()
console.log('[db] banco restaurado com os dados de demonstração')
