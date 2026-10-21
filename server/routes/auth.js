import { Router } from 'express'
import { autenticar, conferirSenha, criarSessao, hashSenha } from '../auth.js'
import { db, transaction } from '../db.js'
import { userToJson } from '../mappers.js'
import { PREFERENCIAS, PRIVACIDADE } from '../seedData.js'

const router = Router()
const digitos = (s = '') => String(s).replace(/\D/g, '')
const buscarUsuario = (id) => db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
const emailEmUso = (email, exceto = 0) => db.prepare('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?').get(email.trim(), exceto)

// POST /api/auth/login  { perfil, email, senha, cnpj? }
router.post('/login', (req, res) => {
  const { perfil, email = '', senha = '', cnpj } = req.body
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim())
  if (!u || !conferirSenha(senha, u.senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  if (u.perfil !== perfil) return res.status(403).json({ erro: `Esta conta é de ${u.perfil === 'empresa' ? 'empresa' : 'usuário'}. Troque a aba acima.` })
  if (perfil === 'empresa' && digitos(cnpj) !== u.cnpj) return res.status(401).json({ erro: 'CNPJ não confere com o cadastro.' })
  res.json({ token: criarSessao(u.id), usuario: userToJson(u) })
})

/**
 * POST /api/auth/cadastro
 *  cliente:            { perfil, nome, email, senha, documento, telefone? }
 *  empresa/admin:      { perfil, funcao: 'admin', nome (empresa), responsavel, documento (CNPJ), fantasia?, email, senha, telefone? }
 *  empresa/entregador: { perfil, funcao: 'entregador', nome, documento (CNPJ da empresa), email, senha, telefone?, veiculo? }
 */
router.post('/cadastro', (req, res) => {
  const { perfil, funcao, nome = '', responsavel = '', email = '', senha = '', documento = '', fantasia, telefone = '', veiculo = '' } = req.body
  if (!['cliente', 'empresa'].includes(perfil)) return res.status(400).json({ erro: 'Perfil inválido.' })
  if (perfil === 'empresa' && !['admin', 'entregador'].includes(funcao)) return res.status(400).json({ erro: 'Informe se a conta é de administrador ou entregador.' })
  if (nome.trim().length < 3 || !email.includes('@') || senha.length < 6) return res.status(400).json({ erro: 'Preencha nome, e-mail e senha (mín. 6 caracteres).' })
  if (emailEmUso(email)) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })

  const ins = db.prepare(
    'INSERT INTO usuarios (perfil, funcao, nome, email, senha_hash, documento, empresa, cargo, cnpj, telefone, veiculo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  let id
  if (perfil === 'cliente') {
    id = Number(ins.run('cliente', null, nome.trim(), email.trim(), hashSenha(senha), digitos(documento), null, null, null, telefone, null).lastInsertRowid)
    db.prepare('INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?)').run(id, 'preferencias', JSON.stringify(PREFERENCIAS))
    db.prepare("INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, quando) VALUES (?, 'star', 'var(--pink)', 'Bem-vindo(a) à Rota+!', 'Faça seu primeiro pedido e acompanhe tudo em tempo real.', 'agora')").run(id)
  } else if (funcao === 'admin') {
    if (responsavel.trim().length < 3) return res.status(400).json({ erro: 'Informe o nome do administrador responsável.' })
    const empresa = nome.trim()
    id = Number(ins.run('empresa', 'admin', responsavel.trim(), email.trim(), hashSenha(senha), null, empresa, `Administrador · ${fantasia || empresa}`, digitos(documento), telefone, null).lastInsertRowid)
    db.prepare('INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?)').run(id, 'privacidade', JSON.stringify(PRIVACIDADE))
  } else {
    // o entregador se vincula a uma empresa que já tem administrador cadastrado
    const adm = db.prepare("SELECT empresa FROM usuarios WHERE perfil = 'empresa' AND funcao = 'admin' AND cnpj = ?").get(digitos(documento))
    if (!adm) return res.status(404).json({ erro: 'Nenhuma empresa cadastrada com este CNPJ. Peça ao administrador para criar a conta da empresa.' })
    transaction(() => {
      id = Number(ins.run('empresa', 'entregador', nome.trim(), email.trim(), hashSenha(senha), null, adm.empresa, null, digitos(documento), telefone, veiculo || null).lastInsertRowid)
      db.prepare("INSERT INTO equipe (usuario_id, nome, funcao, base, veiculo, hoje, prazo, adesao, status) VALUES (?, ?, 'Entregador', 'A definir', ?, '—', '—', 100, 'Disponível')").run(id, nome.trim(), veiculo || '—')
    })
  }
  res.status(201).json({ token: criarSessao(id), usuario: userToJson(buscarUsuario(id)) })
})

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }))

// PATCH /api/auth/perfil  { nome, email, telefone, veiculo?, empresa? }
router.patch('/perfil', autenticar, (req, res) => {
  const u = req.usuario
  const { nome = '', email = '', telefone = '', veiculo = '', empresa } = req.body
  if (nome.trim().length < 3) return res.status(400).json({ erro: 'Informe o nome completo.' })
  if (!email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido.' })
  if (emailEmUso(email, u.id)) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })
  transaction(() => {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, telefone = ?, veiculo = ? WHERE id = ?').run(nome.trim(), email.trim(), telefone, u.funcao === 'entregador' ? veiculo : null, u.id)
    if (u.funcao === 'admin' && empresa?.trim()) {
      // o nome da empresa vale para todos os usuários do mesmo CNPJ
      db.prepare("UPDATE usuarios SET empresa = ? WHERE perfil = 'empresa' AND cnpj = ?").run(empresa.trim(), u.cnpj)
    }
    if (u.funcao === 'entregador') {
      // mantém a equipe, as entregas e os ativos com o nome atualizado
      db.prepare('UPDATE equipe SET nome = ?, veiculo = ? WHERE usuario_id = ?').run(nome.trim(), veiculo || '—', u.id)
      db.prepare('UPDATE entregas SET responsavel = ? WHERE entregador_id = ?').run(nome.trim(), u.id)
      db.prepare('UPDATE ativos SET responsavel = ? WHERE responsavel = ?').run(nome.trim(), u.nome)
    }
    if (u.perfil === 'cliente') db.prepare('UPDATE entregas SET cliente = ? WHERE usuario_id = ?').run(nome.trim(), u.id)
  })
  res.json({ usuario: userToJson(buscarUsuario(u.id)) })
})

// POST /api/auth/senha  { atual, nova }
router.post('/senha', autenticar, (req, res) => {
  const { atual = '', nova = '' } = req.body
  const row = buscarUsuario(req.usuario.id)
  if (!conferirSenha(atual, row.senha_hash)) return res.status(400).json({ erro: 'A senha atual está incorreta.' })
  if (nova.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' })
  transaction(() => {
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(nova), row.id)
    // encerra as outras sessões abertas
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token <> ?').run(row.id, req.token)
  })
  res.status(204).end()
})

// POST /api/auth/logout
router.post('/logout', autenticar, (req, res) => {
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(req.token)
  res.status(204).end()
})

export default router
