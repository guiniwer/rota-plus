// Converte linhas do banco (snake_case) para o formato usado pelo front-end (camelCase).
import { agora } from './tempo.js'

const FINALIZADA = ['entregue', 'cancelado']

export function userToJson(u) {
  const empresa = u.empresa_fantasia || u.empresa_razao || null
  return {
    id: u.id,
    perfil: u.perfil,
    funcao: u.perfil === 'empresa' ? u.funcao : null, // 'admin' | 'entregador'
    empresaId: u.empresa_id ?? null,
    nome: u.nome,
    email: u.email,
    documento: u.documento,
    empresa,
    razaoSocial: u.empresa_razao ?? null,
    cnpj: u.cnpj ?? null,
    cargo: u.perfil === 'cliente' ? 'Cliente' : `${u.funcao === 'entregador' ? 'Entregador' : 'Administrador'} · ${empresa}`,
    telefone: u.telefone,
    veiculo: u.veiculo,
    base: u.base_nome ?? null,
    criadoEm: u.criado_em,
  }
}

export function empresaToJson(e, { privado = false } = {}) {
  const publico = { id: e.id, nome: e.fantasia || e.razao_social, base: e.endereco, lat: e.base_lat, lng: e.base_lng, segmento: e.segmento }
  if (!privado) return publico
  return {
    ...publico,
    cnpj: e.cnpj,
    razaoSocial: e.razao_social,
    fantasia: e.fantasia,
    email: e.email,
    telefone: e.telefone,
    endereco: e.endereco,
    turnoInicio: e.turno_inicio,
    turnoFim: e.turno_fim,
    fuso: e.fuso,
    privacidade: JSON.parse(e.privacidade || '{}'),
    temApiKey: Boolean(e.api_key),
    webhookUrl: e.webhook_url,
    demo: Boolean(e.demo),
  }
}

/** e = linha de entregas (com empresa_nome e colunas do último comprovante, se houver). */
export function entregaToJson(e, eventos = []) {
  const fim = !FINALIZADA.includes(e.status) ? null : e.entregue_em
  return {
    id: e.id,
    empresaId: e.empresa_id,
    transportadora: e.empresa_nome ?? null,
    cliente: e.cliente,
    documento: e.documento,
    remetente: e.remetente,
    destinatario: e.destinatario,
    telefoneDestinatario: e.telefone_destinatario,
    emailDestinatario: e.email_destinatario,
    origem: e.origem,
    destino: e.destino,
    destinoCidade: e.destino_cidade,
    tipoCarga: e.tipo_carga,
    pesoTaxado: e.peso_taxado,
    modalidade: e.modalidade,
    rastreio: e.rastreio,
    valor: e.valor,
    valorNF: e.valor_nf,
    status: e.status,
    criadoEm: e.criado_em,
    prazoLimite: e.prazo_limite,
    janela: e.janela,
    entregueEm: fim,
    // atrasada = ainda não terminou e o prazo já passou; ou terminou depois do prazo
    atrasada: Boolean(e.prazo_limite && (FINALIZADA.includes(e.status) ? e.status === 'entregue' && e.entregue_em > e.prazo_limite : e.prazo_limite < agora())),
    responsavel: e.responsavel,
    entregadorId: e.entregador_id,
    lat: e.lat,
    lng: e.lng,
    origemLat: e.origem_lat,
    origemLng: e.origem_lng,
    geoFonte: e.geo_fonte,
    instrucoes: e.instrucoes,
    comprovante: e.comp_id
      ? { id: e.comp_id, resultado: e.comp_resultado, recebedor: e.comp_recebedor, temFoto: Boolean(e.comp_foto), temAssinatura: Boolean(e.comp_assinatura), lat: e.comp_lat, lng: e.comp_lng, criadoEm: e.comp_criado_em }
      : null,
    avaliacao: e.avaliacao_nota ? { nota: e.avaliacao_nota, estado: e.avaliacao_estado, comentario: e.avaliacao_comentario, criadoEm: e.avaliado_em } : null,
    // mais recente primeiro
    eventos: eventos.map((ev) => ({ titulo: ev.titulo, descricao: ev.descricao, data: ev.criado_em, status: ev.status, lat: ev.lat, lng: ev.lng })),
  }
}

export function ativoToJson(a, historico = [], uso = null) {
  return {
    id: a.id,
    nome: a.nome, // tipo de ativo genérico
    tipo: a.tipo, // categoria
    entregaId: a.entrega_id,
    identificacao: a.identificacao,
    temRastreador: Boolean(a.dispositivo_token),
    bateria: a.bateria,
    responsavel: a.responsavel,
    responsavelId: a.responsavel_id,
    local: a.local,
    lat: a.lat,
    lng: a.lng,
    ultimaLeituraEm: a.ultima_leitura_em,
    status: a.status,
    valor: a.valor,
    criadoEm: a.criado_em,
    uso, // horas de uso por dia nos últimos 14 dias (calculadas dos check-outs/check-ins)
    historico: historico.map((h) => ({ titulo: h.titulo, descricao: h.descricao, data: h.criado_em, cor: h.cor ?? undefined })),
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
    referencia: a.referencia,
    abertoEm: a.aberto_em,
    slaMin: a.sla_min,
    responsavel: a.responsavel,
    status: a.status,
    resolvidoEm: a.resolvido_em,
    resolucao: a.resolucao,
    passos: passos.map((p) => ({ texto: p.texto, feito: Boolean(p.feito) })),
  }
}

export function notificacaoToJson(n) {
  return { id: n.id, icon: n.icon, cor: n.cor, titulo: n.titulo, texto: n.texto, link: n.link, criadoEm: n.criado_em, lida: Boolean(n.lida) }
}
