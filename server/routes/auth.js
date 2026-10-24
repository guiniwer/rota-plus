import { Router } from 'express'
import { autenticar, buscarUsuario, conferirSenha, criarSessao, hashSenha } from '../auth.js'
import { db, transaction } from '../db.js'
import { PREFERENCIAS_PADRAO } from '../entregasServico.js'
import { userToJson } from '../mappers.js'
import { notificar } from '../mensageria.js'
import { agora } from '../tempo.js'
import { cnpjValido, documentoValido } from '../../src/utils/documento.js'

const router = Router()
const digitos = (s = '') => String(s).replace(/\D/g, '')
const emailEmUso = (email, exceto = 0) => db.prepare('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?').get(email.trim(), exceto)
export const PRIVACIDADE_PADRAO = { soExpediente: true, termoCiencia: true, anonimizar90: true, compartilharEta: true }

// POST /api/auth/login  { perfil, email, senha, cnpj? }
router.post('/login', (req, res) => {
  const { perfil, email = '', senha = '', cnpj } = req.body
  const row = db.prepare('SELECT id, senha_hash FROM usuarios WHERE email = ?').get(String(email).trim())
  if (!row || !conferirSenha(String(senha), row.senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const u = buscarUsuario(row.id)
  if (u.perfil !== perfil) return res.status(403).json({ erro: `Esta conta é de ${u.perfil === 'empresa' ? 'empresa' : 'usuário'}. Troque a aba acima.` })
  if (perfil === 'empresa' && digitos(cnpj) !== u.cnpj) return res.status(401).json({ erro: 'CNPJ não confere com o cadastro.' })
  res.json({ token: criarSessao(u.id), usuario: userToJson(u) })
})

// GET /api/auth/convite/:token  — dados do convite de entregador (público)
router.get('/convite/:token', (req, res) => {
  const c = db
    .prepare('SELECT c.*, COALESCE(e.fantasia, e.razao_social) AS empresa, e.cnpj FROM convites c JOIN empresas e ON e.id = c.empresa_id WHERE c.token = ? AND c.usado_em IS NULL')
    .get(req.params.token)
  if (!c) return res.status(404).json({ erro: 'Convite inválido ou já utilizado.' })
  res.json({ empresa: c.empresa, cnpj: c.cnpj, email: c.email })
})

/**
 * POST /api/auth/cadastro
 *  cliente:            { perfil, nome, email, senha, documento, telefone? }
 *  empresa/admin:      { perfil, funcao: 'admin', nome (empresa), responsavel, documento (CNPJ), fantasia?, segmento?, email, senha, telefone? }
 *  empresa/entregador: { perfil, funcao: 'entregador', nome, documento (CNPJ da empresa) ou convite, email, senha, telefone?, veiculo? }
 */
router.post('/cadastro', (req, res) => {
  const { perfil, funcao, nome = '', responsavel = '', email = '', senha = '', documento = '', fantasia, segmento, telefone = '', veiculo = '', convite } = req.body
  if (!['cliente', 'empresa'].includes(perfil)) return res.status(400).json({ erro: 'Perfil inválido.' })
  if (perfil === 'empresa' && !['admin', 'entregador'].includes(funcao)) return res.status(400).json({ erro: 'Informe se a conta é de administrador ou entregador.' })
  if (nome.trim().length < 3 || !email.includes('@') || senha.length < 6) return res.status(400).json({ erro: 'Preencha nome, e-mail e senha (mín. 6 caracteres).' })
  if (emailEmUso(email)) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.', campo: 'email' })

  const ins = db.prepare('INSERT INTO usuarios (perfil, funcao, empresa_id, nome, email, senha_hash, documento, telefone, veiculo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  let id
  if (perfil === 'cliente') {
    if (![11, 14].includes(digitos(documento).length)) return res.status(400).json({ erro: 'CPF (11) ou CNPJ (14 dígitos).', campo: 'documento' })
    if (!documentoValido(documento)) return res.status(400).json({ erro: 'CPF/CNPJ inválido (confira os dígitos).', campo: 'documento' })
    transaction(() => {
      id = Number(ins.run('cliente', null, null, nome.trim(), email.trim(), hashSenha(senha), digitos(documento), telefone, null).lastInsertRowid)
      db.prepare("INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, 'preferencias', ?)").run(id, JSON.stringify(PREFERENCIAS_PADRAO))
    })
    notificar(id, { icon: 'star', titulo: 'Bem-vindo(a) à Rota+!', texto: 'Faça seu primeiro pedido e acompanhe tudo em tempo real.', link: '/cliente/novo-pedido' }, { push: false })
  } else if (funcao === 'admin') {
    const cnpj = digitos(documento)
    if (cnpj.length !== 14) return res.status(400).json({ erro: 'CNPJ deve ter 14 dígitos.', campo: 'documento' })
    if (!cnpjValido(cnpj)) return res.status(400).json({ erro: 'CNPJ inválido (confira os dígitos).', campo: 'documento' })
    if (responsavel.trim().length < 3) return res.status(400).json({ erro: 'Informe o nome do administrador responsável.', campo: 'responsavel' })
    if (db.prepare('SELECT 1 FROM empresas WHERE cnpj = ?').get(cnpj)) {
      return res.status(409).json({ erro: 'Esta empresa já está cadastrada. Peça ao administrador para criar seu acesso.', campo: 'documento' })
    }
    transaction(() => {
      const empresaId = Number(
        db.prepare('INSERT INTO empresas (cnpj, razao_social, fantasia, segmento, email, telefone, privacidade) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(cnpj, nome.trim(), fantasia?.trim() || null, segmento ?? null, email.trim(), telefone, JSON.stringify(PRIVACIDADE_PADRAO)).lastInsertRowid,
      )
      id = Number(ins.run('empresa', 'admin', empresaId, responsavel.trim(), email.trim(), hashSenha(senha), null, telefone, null).lastInsertRowid)
    })
  } else {
    // o entregador entra por convite ou pelo CNPJ de uma empresa já cadastrada
    const conv = convite ? db.prepare('SELECT * FROM convites WHERE token = ? AND usado_em IS NULL').get(convite) : null
    if (convite && !conv) return res.status(404).json({ erro: 'Convite inválido ou já utilizado.', campo: 'documento' })
    const empresa = conv ? db.prepare('SELECT * FROM empresas WHERE id = ?').get(conv.empresa_id) : db.prepare('SELECT * FROM empresas WHERE cnpj = ?').get(digitos(documento))
    if (!empresa) return res.status(404).json({ erro: 'Nenhuma empresa cadastrada com este CNPJ. Peça ao administrador o link de convite.', campo: 'documento' })
    transaction(() => {
      id = Number(ins.run('empresa', 'entregador', empresa.id, nome.trim(), email.trim(), hashSenha(senha), null, telefone, veiculo || null).lastInsertRowid)
      if (conv) db.prepare('UPDATE convites SET usado_em = ? WHERE token = ?').run(agora(), conv.token)
    })
    for (const adm of db.prepare("SELECT id FROM usuarios WHERE empresa_id = ? AND funcao = 'admin'").all(empresa.id)) {
      notificar(adm.id, { icon: 'users', titulo: 'Novo entregador na equipe', texto: `${nome.trim()} criou o acesso e já pode receber entregas.`, link: '/empresa/equipes' })
    }
  }
  res.status(201).json({ token: criarSessao(id), usuario: userToJson(buscarUsuario(id)) })
})

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }))

// PATCH /api/auth/perfil  { nome, email, telefone, veiculo? }
router.patch('/perfil', autenticar, (req, res) => {
  const u = req.usuario
  const { nome = '', email = '', telefone = '', veiculo = '' } = req.body
  if (nome.trim().length < 3) return res.status(400).json({ erro: 'Informe o nome completo.' })
  if (!email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido.' })
  if (emailEmUso(email, u.id)) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })
  transaction(() => {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, telefone = ?, veiculo = ? WHERE id = ?').run(nome.trim(), email.trim(), telefone, u.funcao === 'entregador' ? veiculo : null, u.id)
    // entregas e ativos guardam o nome do responsável para exibição
    db.prepare('UPDATE entregas SET responsavel = ? WHERE entregador_id = ?').run(nome.trim(), u.id)
    db.prepare('UPDATE ativos SET responsavel = ? WHERE responsavel_id = ?').run(nome.trim(), u.id)
    if (u.perfil === 'cliente') db.prepare('UPDATE entregas SET cliente = ? WHERE usuario_id = ?').run(nome.trim(), u.id)
  })
  res.json({ usuario: userToJson(buscarUsuario(u.id)) })
})

// POST /api/auth/senha  { atual, nova }
router.post('/senha', autenticar, (req, res) => {
  const { atual = '', nova = '' } = req.body
  const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id)
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
