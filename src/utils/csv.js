// Leitura de planilhas CSV (separador ; ou , detectado pelo cabeçalho; aspas duplas como no Excel).
export function lerCsv(texto) {
  const limpo = texto.replace(/^﻿/, '')
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas = []
  let campo = ''
  let linha = []
  let aspas = false
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) {
      linha.push(campo)
      campo = ''
    }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++
      linha.push(campo)
      if (linha.some((x) => x.trim())) linhas.push(linha)
      linha = []
      campo = ''
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x.trim())) linhas.push(linha)
  return linhas
}

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

// nomes de coluna aceitos → campo da API
const COLUNAS = {
  cliente: 'cliente', destinatario: 'cliente', empresa: 'cliente',
  endereco: 'destino', destino: 'destino', enderecodeentrega: 'destino',
  cidade: 'destinoCidade',
  janela: 'janela', horario: 'janela',
  prazo: 'prazoLimite',
  telefone: 'telefoneDestinatario', celular: 'telefoneDestinatario', whatsapp: 'telefoneDestinatario',
  email: 'emailDestinatario',
  carga: 'tipoCarga', conteudo: 'tipoCarga', descricao: 'tipoCarga',
  peso: 'pesoTaxado', pesokg: 'pesoTaxado',
  valor: 'valor', frete: 'valor', valornf: 'valorNF', notafiscal: 'valorNF',
  documento: 'documento', cpf: 'documento', cnpj: 'documento',
  entregador: 'entregadorEmail', emailentregador: 'entregadorEmail',
  instrucoes: 'instrucoes', observacoes: 'instrucoes', obs: 'instrucoes',
}

/** Converte a planilha em entregas para POST /entregas/importar. */
export function csvParaEntregas(texto) {
  const [cab, ...linhas] = lerCsv(texto)
  if (!cab) return { entregas: [], colunas: [] }
  const campos = cab.map((c) => COLUNAS[normalizar(c)] ?? null)
  const numero = (v) => Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0
  const entregas = linhas.map((l) => {
    const e = {}
    campos.forEach((k, i) => {
      if (!k || !l[i]?.trim()) return
      e[k] = ['pesoTaxado', 'valor', 'valorNF'].includes(k) ? numero(l[i]) : l[i].trim()
    })
    return e
  })
  return { entregas, colunas: campos.filter(Boolean) }
}

export const MODELO_CSV = 'cliente;endereco;cidade;janela;telefone;email;carga;peso;valor;entregador\nPadaria Boa Vista;Rua da Aurora, 325 — Boa Vista, Recife/PE;recife-pe;09:00–11:00;(81) 99999-0000;compras@padaria.com.br;2 caixas;8;45,90;thiago@logisuape.com.br\n'
