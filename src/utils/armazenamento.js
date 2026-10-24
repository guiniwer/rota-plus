// Armazenamento local persistente (IndexedDB) para a fila offline do entregador.
// Fotos de comprovante não cabem no localStorage; o IndexedDB aguenta dezenas de MB.
const BANCO = 'rota-plus'
const LOJA = 'kv'
let conexao = null
const memoria = new Map() // reserva se o navegador bloquear o IndexedDB (ex.: aba anônima antiga)

function abrir() {
  if (conexao) return conexao
  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch(() => null)
  return conexao
}

async function operar(modo, fn) {
  const db = await abrir()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOJA, modo)
    const req = fn(tx.objectStore(LOJA))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function ler(chave) {
  try {
    const v = await operar('readonly', (s) => s.get(chave))
    return v ?? memoria.get(chave) ?? null
  } catch {
    return memoria.get(chave) ?? null
  }
}

export async function gravar(chave, valor) {
  memoria.set(chave, valor)
  try {
    await operar('readwrite', (s) => s.put(valor, chave))
  } catch {
    /* fica só na memória */
  }
}
