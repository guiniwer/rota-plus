// Converte linhas do banco (snake_case) para o formato usado pelo front-end (camelCase).

export function userToJson(u) {
  return {
    id: u.id,
    perfil: u.perfil,
    nome: u.nome,
    email: u.email,
    documento: u.documento,
    empresa: u.empresa,
    funcao: u.perfil === 'empresa' ? u.funcao : null, // 'admin' | 'entregador'
    cargo: u.perfil === 'cliente' ? 'Cliente' : u.funcao === 'entregador' ? `Entregador · ${u.empresa}` : u.cargo,
    cnpj: u.cnpj,
    telefone: u.telefone,
    veiculo: u.veiculo,
    criadoEm: u.criado_em,
  }
}

export function entregaToJson(e, eventos = []) {
  return {
    id: e.id,
    cliente: e.cliente,
    documento: e.documento,
    remetente: e.remetente,
    destinatario: e.destinatario,
    origem: e.origem,
    destino: e.destino,
    tipoCarga: e.tipo_carga,
    pesoTaxado: e.peso_taxado,
    modalidade: e.modalidade,
    rastreio: e.rastreio,
    valor: e.valor,
    status: e.status,
    criadoEm: e.criado_em,
    previsao: e.previsao,
    janela: e.janela,
    responsavel: e.responsavel,
    entregadorId: e.entregador_id,
    lat: e.lat,
    lng: e.lng,
    progresso: e.progresso,
    avaliacao: e.avaliacao_nota ? { nota: e.avaliacao_nota, estado: e.avaliacao_estado, comentario: e.avaliacao_comentario } : null,
    // mais recente primeiro
    eventos: eventos.map((ev) => ({ titulo: ev.titulo, descricao: ev.descricao, data: ev.data })),
  }
}

export function ativoToJson(a, historico = []) {
  return {
    id: a.id,
    nome: a.nome, // tipo de ativo genérico
    tipo: a.tipo, // categoria
    entregaId: a.entrega_id,
    identificacao: a.identificacao,
    bateria: a.bateria,
    responsavel: a.responsavel,
    local: a.local,
    ultimaLeitura: a.ultima_leitura,
    status: a.status,
    valor: a.valor,
    x: a.x,
    y: a.y,
    uso: JSON.parse(a.uso),
    historico: historico.map((h) => ({ titulo: h.titulo, descricao: h.descricao, data: h.data, cor: h.cor ?? undefined })),
  }
}

export function alertaToJson(a, passos = []) {
  return {
    id: a.id,
    tipo: a.tipo,
    severidade: a.severidade,
    titulo: a.titulo,
    descricao: a.descricao,
    entidade: a.entidade,
    aberto: a.aberto,
    sla: a.sla,
    responsavel: a.responsavel,
    status: a.status,
    passos: passos.map((p) => ({ texto: p.texto, feito: Boolean(p.feito) })),
  }
}

export function notificacaoToJson(n) {
  return { id: n.id, icon: n.icon, cor: n.cor, titulo: n.titulo, texto: n.texto, quando: n.quando, grupo: n.grupo, lida: Boolean(n.lida) }
}

export function equipeToJson(p) {
  return { id: p.id, usuarioId: p.usuario_id, nome: p.nome, funcao: p.funcao, base: p.base, veiculo: p.veiculo, hoje: p.hoje, prazo: p.prazo, adesao: p.adesao, status: p.status }
}
