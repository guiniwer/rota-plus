// Cadastros fixos da empresa de demonstração. O histórico (entregas, movimentações e alertas)
// é gerado em seed.js com datas relativas ao momento da criação do banco.
export { CLIENTE_DEMO, EMPRESA_DEMO } from '../src/data/contasDemo.js'

export const EMPRESA = {
  cnpj: '12345678000195',
  razaoSocial: 'LogiSuape Transportes Ltda.',
  fantasia: 'LogiSuape',
  segmento: 'Logística',
  email: 'contato@logisuape.com.br',
  telefone: '(81) 3512-4000',
  endereco: 'CD Recife — BR-232, Curado, Recife/PE',
  lat: -8.089,
  lng: -34.933,
  turnoInicio: '06:00',
  turnoFim: '22:00',
}

export const ENTREGADORES = [
  { nome: 'Thiago Rodrigues', email: 'thiago@logisuape.com.br', telefone: '(81) 98811-2034', veiculo: 'Van PE-02', regiao: 'recife' },
  { nome: 'Carla Menezes', email: 'carla@logisuape.com.br', telefone: '(81) 99120-4471', veiculo: 'Moto PE-11', regiao: 'recife' },
  { nome: 'Ana Paula Lima', email: 'anapaula@logisuape.com.br', telefone: '(81) 98654-1290', veiculo: 'Furgão PE-09', regiao: 'recife' },
  { nome: 'Rafael Toscano', email: 'rafael@logisuape.com.br', telefone: '(81) 99702-3318', veiculo: 'Caminhão PE-07', regiao: 'suape' },
  { nome: 'Jonas Ferreira', email: 'jonas@logisuape.com.br', telefone: '(81) 98123-7765', veiculo: 'Van PE-05', regiao: 'recife' },
  {
    nome: 'Bruno Carvalho', email: 'bruno@logisuape.com.br', telefone: '(81) 97410-5522', veiculo: 'Van PE-04', regiao: 'agreste',
    base: { nome: 'CD Caruaru (Agreste)', lat: -8.2706, lng: -35.944 },
  },
]

// destinos reais usados no histórico (cliente, documento, endereço, cidade, lat, lng)
const d = (cliente, documento, destino, cidade, lat, lng) => ({ cliente, documento, destino, cidade, lat, lng })
export const DESTINOS = {
  recife: [
    d('Hospital da Restauração', '10571982000125', 'Av. Agamenon Magalhães · Derby, Recife', 'recife-pe', -8.0505, -34.8963),
    d('Clínica Imip — Almoxarifado', '09553829000140', 'Rua dos Coelhos, 300 · Boa Vista, Recife', 'recife-pe', -8.056, -34.8916),
    d('Construtora Alfa — Obra Lote 3', '22333444000155', 'Av. Boa Viagem · Boa Viagem, Recife', 'recife-pe', -8.1197, -34.9003),
    d('Shopping RioMar — Doca 2', '11222333000181', 'Av. República do Líbano · Pina, Recife', 'recife-pe', -8.0857, -34.8949),
    d('Atacadão Imbiribeira', '75315333000109', 'Av. Mal. Mascarenhas de Morais · Imbiribeira, Recife', 'recife-pe', -8.11, -34.913),
    d('Farmácia Pague Menos — Casa Forte', '06626253000151', 'Av. 17 de Agosto · Casa Forte, Recife', 'recife-pe', -8.0349, -34.9198),
    d('Livraria Jaqueira — Olinda', '13400521000190', 'Rua do Amparo · Carmo, Olinda', 'olinda-pe', -8.0089, -34.8553),
    d('Clínica Sorriso — Piedade', '27865757000102', 'Av. Bernardo Vieira de Melo · Piedade, Jaboatão', 'jaboatao-pe', -8.1642, -34.9156),
    d('Supermercado Arco-Íris — Madalena', '30111222000144', 'Rua Real da Torre · Madalena, Recife', 'recife-pe', -8.0527, -34.9095),
    d('Escola Técnica Estadual — Afogados', '10572012000180', 'Av. Sul · Afogados, Recife', 'recife-pe', -8.0756, -34.9087),
    d('Paulista Center — Loja 14', '40999888000177', 'Av. Mal. Floriano Peixoto · Centro, Paulista', 'paulista-pe', -7.9408, -34.8728),
    d('Hotel Mar — Recepção', '08888777000166', 'Av. Boa Viagem, 4000 · Boa Viagem, Recife', 'recife-pe', -8.1306, -34.9025),
  ],
  suape: [
    d('Porto de Suape — Pátio B', '11402803000195', 'Complexo Industrial Portuário · Ipojuca', 'ipojuca-pe', -8.395, -34.97),
    d('Estaleiro Atlântico Sul', '08771744000134', 'Rod. PE-60 · Ipojuca', 'ipojuca-pe', -8.4029, -34.9665),
    d('Refinaria Abreu e Lima — Almoxarifado', '33000167000101', 'Rod. PE-60, km 10 · Ipojuca', 'ipojuca-pe', -8.3837, -34.9997),
    d('Polo Cabo — Galpão 4', '41222333000110', 'Rod. BR-101 Sul · Cabo de Santo Agostinho', 'cabo-pe', -8.2822, -35.0322),
  ],
  agreste: [
    d('Shopping Difusora — Doca', '55444333000122', 'Av. Agamenon Magalhães, 444 · Maurício de Nassau, Caruaru', 'caruaru-pe', -8.2833, -35.9706),
    d('Polo Comercial — Galpão 7', '66555444000133', 'BR-104, km 62 · Caruaru', 'caruaru-pe', -8.2465, -35.9645),
    d('Hospital Mestre Vitalino', '77666555000144', 'BR-104 · Caruaru', 'caruaru-pe', -8.2539, -35.9628),
    d('Feira de Caruaru — Box 210', '88777666000155', 'Parque 18 de Maio · Centro, Caruaru', 'caruaru-pe', -8.2827, -35.9739),
  ],
}

export const RECEBEDORES = ['Paulo Mendes', 'Juliana Costa', 'Marcos Araújo', 'Fernanda Lima', 'Ricardo Alves', 'Beatriz Souza', 'Carlos Henrique', 'Luciana Rocha', 'André Barros', 'Patrícia Gomes']
export const CARGAS = ['Caixa · insumos', 'Documentos', '2 volumes', 'Palete', 'Caixa · peças', '3 caixas', 'Envelope']
export const JANELAS = ['08:00–09:00', '09:00–10:00', '10:00–11:00', '11:00–12:00', '13:00–14:00', '14:00–15:00', '15:00–16:00', '16:00–17:00', '17:00–18:00']

// bens da empresa: veículo de cada entregador + equipamentos e ferramentas do CD
export const ATIVOS = [
  { id: 'VEI-0002', nome: 'Van de entrega', tipo: 'Veículo', identificacao: 'GPS', valor: 98000, de: 'Thiago Rodrigues' },
  { id: 'VEI-0011', nome: 'Motocicleta', tipo: 'Veículo', identificacao: 'GPS', valor: 15000, de: 'Carla Menezes' },
  { id: 'VEI-0009', nome: 'Furgão', tipo: 'Veículo', identificacao: 'GPS', valor: 76000, de: 'Ana Paula Lima' },
  { id: 'VEI-0007', nome: 'Caminhão', tipo: 'Veículo', identificacao: 'GPS', valor: 310000, de: 'Rafael Toscano' },
  { id: 'VEI-0005', nome: 'Van de entrega', tipo: 'Veículo', identificacao: 'QR', valor: 92000, de: 'Jonas Ferreira' },
  { id: 'VEI-0104', nome: 'Van de entrega', tipo: 'Veículo', identificacao: 'QR', valor: 95000, de: 'Bruno Carvalho', base: 'agreste' },
  { id: 'ATV-00412', nome: 'Gerador de energia', tipo: 'Equipamento', identificacao: 'QR', valor: 38900, uso: 'eventual' },
  { id: 'EQP-2203', nome: 'Andaime', tipo: 'Equipamento', identificacao: 'QR', valor: 12500, uso: 'locado' },
  { id: 'EQP-3101', nome: 'Empilhadeira', tipo: 'Equipamento', identificacao: 'RFID', valor: 145000, uso: 'diario-curto' },
  { id: 'TRK-118', nome: 'Rastreador GPS', tipo: 'Equipamento', identificacao: 'GPS', valor: 650, uso: 'rastreador' },
  { id: 'FER-1180', nome: 'Furadeira', tipo: 'Ferramenta', identificacao: 'QR', valor: 890, uso: 'eventual' },
  { id: 'FER-1212', nome: 'Parafusadeira', tipo: 'Ferramenta', identificacao: 'QR', valor: 720, uso: 'eventual' },
  { id: 'FER-0931', nome: 'Multímetro', tipo: 'Ferramenta', identificacao: 'RFID', valor: 1900, uso: 'extraviado' },
]

// imagem usada nos comprovantes do histórico de demonstração (identificada como tal)
export const FOTO_DEMO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#2A1A47"/><g fill="none" stroke="#E856A6" stroke-width="6" stroke-linejoin="round"><path d="M150 120 240 80l90 40v110l-90 40-90-40z"/><path d="M150 120l90 40 90-40M240 160v110"/></g><text x="240" y="300" fill="#B9A8D9" font-family="sans-serif" font-size="18" text-anchor="middle">Foto de demonstração</text></svg>`,
  ).toString('base64')
