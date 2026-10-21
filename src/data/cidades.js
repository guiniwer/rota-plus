// Cidades atendidas na cotação (coordenadas do centro urbano, usadas para estimar a distância).
// Grupos seguem as regiões do IBGE; Pernambuco vem primeiro por ser a base de operação.
const c = (id, nome, uf, lat, lng) => ({ id, nome, uf, lat, lng })

export const CIDADES = [
  // Pernambuco
  c('recife-pe', 'Recife', 'PE', -8.0476, -34.877),
  c('olinda-pe', 'Olinda', 'PE', -8.0089, -34.8553),
  c('jaboatao-pe', 'Jaboatão dos Guararapes', 'PE', -8.1129, -35.0147),
  c('paulista-pe', 'Paulista', 'PE', -7.9408, -34.8728),
  c('cabo-pe', 'Cabo de Santo Agostinho', 'PE', -8.2822, -35.0322),
  c('ipojuca-pe', 'Ipojuca (Porto de Suape)', 'PE', -8.3989, -35.0634),
  c('vitoria-pe', 'Vitória de Santo Antão', 'PE', -8.1181, -35.2914),
  c('caruaru-pe', 'Caruaru', 'PE', -8.276, -35.9819),
  c('garanhuns-pe', 'Garanhuns', 'PE', -8.8828, -36.4964),
  c('arcoverde-pe', 'Arcoverde', 'PE', -8.4189, -37.0569),
  c('serratalhada-pe', 'Serra Talhada', 'PE', -7.9856, -38.295),
  c('petrolina-pe', 'Petrolina', 'PE', -9.3891, -40.5027),
  // Nordeste
  c('maceio-al', 'Maceió', 'AL', -9.666, -35.735),
  c('salvador-ba', 'Salvador', 'BA', -12.9718, -38.5011),
  c('feira-ba', 'Feira de Santana', 'BA', -12.2664, -38.9663),
  c('fortaleza-ce', 'Fortaleza', 'CE', -3.7319, -38.5267),
  c('juazeiro-ce', 'Juazeiro do Norte', 'CE', -7.2131, -39.3151),
  c('saoluis-ma', 'São Luís', 'MA', -2.5307, -44.3068),
  c('joaopessoa-pb', 'João Pessoa', 'PB', -7.1195, -34.845),
  c('campinagrande-pb', 'Campina Grande', 'PB', -7.2307, -35.8817),
  c('teresina-pi', 'Teresina', 'PI', -5.0892, -42.8019),
  c('natal-rn', 'Natal', 'RN', -5.7945, -35.211),
  c('mossoro-rn', 'Mossoró', 'RN', -5.1878, -37.3442),
  c('aracaju-se', 'Aracaju', 'SE', -10.9472, -37.0731),
  // Sudeste
  c('saopaulo-sp', 'São Paulo', 'SP', -23.5505, -46.6333),
  c('campinas-sp', 'Campinas', 'SP', -22.9099, -47.0626),
  c('guarulhos-sp', 'Guarulhos', 'SP', -23.4538, -46.5333),
  c('santos-sp', 'Santos', 'SP', -23.9608, -46.3336),
  c('ribeirao-sp', 'Ribeirão Preto', 'SP', -21.1704, -47.8103),
  c('riodejaneiro-rj', 'Rio de Janeiro', 'RJ', -22.9068, -43.1729),
  c('belohorizonte-mg', 'Belo Horizonte', 'MG', -19.9167, -43.9345),
  c('uberlandia-mg', 'Uberlândia', 'MG', -18.9186, -48.2772),
  c('vitoria-es', 'Vitória', 'ES', -20.3155, -40.3128),
  // Sul
  c('curitiba-pr', 'Curitiba', 'PR', -25.4284, -49.2733),
  c('florianopolis-sc', 'Florianópolis', 'SC', -27.5954, -48.548),
  c('joinville-sc', 'Joinville', 'SC', -26.3045, -48.8487),
  c('portoalegre-rs', 'Porto Alegre', 'RS', -30.0346, -51.2177),
  // Centro-Oeste
  c('brasilia-df', 'Brasília', 'DF', -15.7939, -47.8828),
  c('goiania-go', 'Goiânia', 'GO', -16.6869, -49.2648),
  c('cuiaba-mt', 'Cuiabá', 'MT', -15.601, -56.0974),
  c('campogrande-ms', 'Campo Grande', 'MS', -20.4697, -54.6201),
  // Norte
  c('manaus-am', 'Manaus', 'AM', -3.119, -60.0217),
  c('belem-pa', 'Belém', 'PA', -1.4558, -48.4902),
  c('palmas-to', 'Palmas', 'TO', -10.2491, -48.3243),
  c('portovelho-ro', 'Porto Velho', 'RO', -8.7612, -63.9004),
  c('riobranco-ac', 'Rio Branco', 'AC', -9.975, -67.8243),
  c('macapa-ap', 'Macapá', 'AP', 0.0349, -51.0694),
  c('boavista-rr', 'Boa Vista', 'RR', 2.8235, -60.6758),
]

const REGIAO_UF = {
  Pernambuco: ['PE'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PI', 'RN', 'SE'],
  Sudeste: ['SP', 'RJ', 'MG', 'ES'],
  Sul: ['PR', 'SC', 'RS'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Norte: ['AM', 'PA', 'TO', 'RO', 'AC', 'AP', 'RR'],
}

/** Opções agrupadas para <select> com <optgroup>. */
export const OPCOES_CIDADES = Object.entries(REGIAO_UF).map(([grupo, ufs]) => ({
  grupo,
  options: CIDADES.filter((x) => ufs.includes(x.uf)).map((x) => ({ value: x.id, label: `${x.nome} — ${x.uf}` })),
}))

export const cidadePorId = (id) => CIDADES.find((x) => x.id === id)
export const nomeCidade = (id) => {
  const x = cidadePorId(id)
  return x ? `${x.nome}/${x.uf}` : ''
}
