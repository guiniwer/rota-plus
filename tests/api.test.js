// Testes de integração da API: sobem o servidor com um banco temporário (dados de demonstração)
// e conferem login, separação por CNPJ, cálculo de frete, fluxo do entregador, relatórios e integrações.
// Rodar: npm test
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'

const PORT = 3990 + Math.floor(Math.random() * 9)
const BASE = `http://localhost:${PORT}/api`
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-teste-'))
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const CNPJ_DEMO = '12.345.678/0001-95'
let servidor

async function req(caminho, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(BASE + caminho, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const tipo = res.headers.get('content-type') ?? ''
  const dados = res.status === 204 ? null : tipo.includes('json') ? await res.json() : await res.text()
  return { status: res.status, dados, tipo }
}

const login = async (perfil, email, cnpj) => {
  const r = await req('/auth/login', { method: 'POST', body: { perfil, email, senha: 'demo123', cnpj } })
  assert.equal(r.status, 200, JSON.stringify(r.dados))
  return r.dados.token
}

/** CNPJ com dígitos verificadores corretos a partir de 12 dígitos. */
function gerarCnpj(base) {
  const dv = (s, pesos) => {
    const r = [...s].reduce((a, c, i) => a + Number(c) * pesos[i], 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  const a = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${base}${a}${dv(base + a, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`
}

before(async () => {
  servidor = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(dir, 'teste.db'), GEOCODER: 'off', OSRM: 'off', MONITOR: 'off' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('O servidor não subiu.')
})

after(() => {
  servidor?.kill()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('autenticação', () => {
  test('login das contas de demonstração', async () => {
    assert.ok(await login('empresa', 'luis@logisuape.com.br', CNPJ_DEMO))
    assert.ok(await login('empresa', 'thiago@logisuape.com.br', CNPJ_DEMO))
    assert.ok(await login('cliente', 'jhonata@email.com'))
  })

  test('senha errada e CNPJ errado são recusados', async () => {
    const r = await req('/auth/login', { method: 'POST', body: { perfil: 'cliente', email: 'jhonata@email.com', senha: 'errada' } })
    assert.equal(r.status, 401)
    const r2 = await req('/auth/login', { method: 'POST', body: { perfil: 'empresa', email: 'luis@logisuape.com.br', senha: 'demo123', cnpj: gerarCnpj('999999990001') } })
    assert.notEqual(r2.status, 200)
  })

  test('cadastro recusa CPF com dígito verificador inválido', async () => {
    const r = await req('/auth/cadastro', { method: 'POST', body: { perfil: 'cliente', nome: 'Teste Silva', email: 'teste@x.com', senha: 'abcdef', documento: '111.222.333-44' } })
    assert.equal(r.status, 400)
    assert.equal(r.dados.campo, 'documento')
  })

  test('rota protegida sem token responde 401', async () => {
    assert.equal((await req('/entregas')).status, 401)
  })
})

describe('separação por empresa (CNPJ)', () => {
  test('uma empresa nova não enxerga os dados da outra', async () => {
    const cnpj = gerarCnpj('112223330001')
    const r = await req('/auth/cadastro', {
      method: 'POST',
      body: { perfil: 'empresa', funcao: 'admin', nome: 'Transportes Teste Ltda', responsavel: 'Ana Teste', email: 'ana@teste.com.br', senha: 'abcdef', documento: cnpj },
    })
    assert.equal(r.status, 201, JSON.stringify(r.dados))
    const token = r.dados.token
    assert.deepEqual((await req('/entregas', { token })).dados, [])
    assert.equal((await req('/entregas/RT-90911', { token })).status, 404)
    assert.equal((await req('/ativos/VEI-0002', { token })).status, 404)
    assert.equal((await req('/equipe', { token })).dados.length, 0)
    // o mesmo CNPJ não pode ser cadastrado de novo
    const dup = await req('/auth/cadastro', { method: 'POST', body: { perfil: 'empresa', funcao: 'admin', nome: 'Outra', responsavel: 'Fulano', email: 'f@teste.com.br', senha: 'abcdef', documento: cnpj } })
    assert.equal(dup.status, 409)
  })

  test('o entregador só vê as próprias entregas', async () => {
    const token = await login('empresa', 'thiago@logisuape.com.br', CNPJ_DEMO)
    const lista = (await req('/entregas', { token })).dados
    assert.ok(lista.length > 0)
    assert.ok(lista.every((e) => e.responsavel === 'Thiago Rodrigues'))
    assert.equal((await req('/ativos', { token })).status, 403)
  })
})

describe('pedido do cliente', () => {
  test('o servidor recalcula frete e prazo (não confia no valor enviado)', async () => {
    const token = await login('cliente', 'jhonata@email.com')
    const [empresa] = (await req('/empresas')).dados
    const r = await req('/entregas', {
      method: 'POST',
      token,
      body: {
        empresaId: empresa.id, destinatario: 'Maria', origem: 'Rua A, 1 — Recife', destino: 'Rua B, 2 — Olinda', origemCidade: 'recife-pe', destinoCidade: 'olinda-pe',
        formato: 'caixa', comprimento: 30, largura: 20, altura: 10, peso: 2, valorNF: 100, tipoCarga: 'Caixa · teste', modalidade: 'normal', rastreio: 'cd', valor: 0.01,
      },
    })
    assert.equal(r.status, 201, JSON.stringify(r.dados))
    assert.ok(r.dados.valor > 10)
    assert.ok(Date.parse(r.dados.prazoLimite) > Date.now())
    assert.equal(r.dados.status, 'confirmado')
  })
})

describe('fluxo do entregador', () => {
  test('atualiza status e exige comprovante completo para concluir', async () => {
    const token = await login('empresa', 'thiago@logisuape.com.br', CNPJ_DEMO)
    const r = await req('/entregas/RT-90940/status', { method: 'PATCH', token, body: { status: 'saiu', descricao: 'A caminho' } })
    assert.equal(r.status, 200, JSON.stringify(r.dados))
    assert.equal(r.dados.status, 'saiu')

    const semFoto = await req('/entregas/RT-90940/comprovante', { method: 'POST', token, body: { resultado: 'entregue', recebedor: 'Fulano', assinatura: PNG } })
    assert.equal(semFoto.status, 400)

    const ok = await req('/entregas/RT-90940/comprovante', { method: 'POST', token, body: { resultado: 'entregue', recebedor: 'Fulano', foto: PNG, assinatura: PNG, lat: -8.1, lng: -34.9, conferido: true } })
    assert.equal(ok.status, 201, JSON.stringify(ok.dados))
    assert.equal(ok.dados.status, 'entregue')
    assert.ok(ok.dados.entregueEm)

    const repetido = await req('/entregas/RT-90940/comprovante', { method: 'POST', token, body: { resultado: 'tentativa' } })
    assert.equal(repetido.status, 409)
  })
})

describe('relatórios e rastreio público', () => {
  test('relatório calculado do banco e exportação CSV', async () => {
    const token = await login('empresa', 'luis@logisuape.com.br', CNPJ_DEMO)
    const r = (await req('/relatorios?periodo=30d', { token })).dados
    assert.ok(r.entregas.concluidas > 100)
    assert.ok(r.entregas.noPrazoPct > 50 && r.entregas.noPrazoPct <= 100)
    assert.ok(r.alertas.resolvidos > 0)
    const csv = await req('/relatorios/csv?periodo=7d', { token })
    assert.equal(csv.status, 200)
    assert.match(csv.tipo, /csv/)
  })

  test('rastreio público exige o documento e não expõe dados pessoais', async () => {
    assert.equal((await req('/rastreio?codigo=RT-90827-BR&documento=00000000000')).status, 404)
    const r = await req('/rastreio?codigo=RT-90827-BR&documento=123.456.789-09')
    assert.equal(r.status, 200)
    for (const campo of ['documento', 'telefoneDestinatario', 'emailDestinatario', 'valorNF']) assert.equal(r.dados[campo], undefined, campo)
  })
})

describe('integrações', () => {
  test('API v1 com chave e entrada de rastreador GPS', async () => {
    const token = await login('empresa', 'luis@logisuape.com.br', CNPJ_DEMO)
    const { apiKey } = (await req('/empresa/api-key', { method: 'POST', token })).dados
    assert.match(apiKey, /^rp_/)
    assert.equal((await req('/v1/entregas', { headers: { 'X-Api-Key': 'rp_invalida' } })).status, 401)
    const criada = await req('/v1/entregas', { method: 'POST', headers: { 'X-Api-Key': apiKey }, body: { cliente: 'Loja Centro', destino: 'Rua da Aurora, 100, Recife/PE', janela: '14:00–16:00' } })
    assert.equal(criada.status, 201, JSON.stringify(criada.dados))

    const { token: trk } = (await req('/ativos/EQP-2203/rastreador', { method: 'POST', token })).dados
    const pos = await req('/dispositivos/posicao', { method: 'POST', headers: { 'X-Dispositivo-Token': trk }, body: { lat: -8.06, lng: -34.87, bateria: 80 } })
    assert.equal(pos.status, 200, JSON.stringify(pos.dados))
    const ativo = (await req('/ativos/EQP-2203', { token })).dados
    assert.equal(ativo.lat, -8.06)
    assert.equal(ativo.bateria, 80)
  })
})
