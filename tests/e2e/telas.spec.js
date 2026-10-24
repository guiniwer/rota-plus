// Fluxos principais pelas telas, com os dados de demonstração.
import { expect, test } from '@playwright/test'
import { entrar, itensDoMenu } from './ajuda.js'

test('rastreio público mostra o pedido com código + CPF', async ({ page }) => {
  await page.goto('/#/rastreio')
  await page.getByLabel('Código do localizador').fill('RT-90827-BR')
  await page.getByLabel('CPF / CNPJ').fill('12345678909')
  await page.getByRole('button', { name: /Rastrear|Localizar|Buscar/ }).first().click()
  await expect(page.getByText('Saiu para entrega').first()).toBeVisible()
  await expect(page.getByText('Rua Vigário Freire', { exact: false }).first()).toBeVisible()
})

test('login com senha errada mostra o erro e continua na tela', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('E-mail', { exact: true }).fill('jhonata@email.com')
  await page.getByLabel('Senha').fill('errada')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/#\/login/)
})

test.describe('cliente', () => {
  test('menu enxuto e página única do pedido', async ({ page }) => {
    await entrar(page, { email: 'jhonata@email.com' })
    await expect(page.getByRole('heading', { name: 'Olá, Jhonata!' })).toBeVisible()
    expect(await itensDoMenu(page)).toEqual(['Início', 'Meus pedidos', 'Novo pedido'])

    await page.getByRole('button', { name: 'Acompanhar pedido' }).click()
    await expect(page.getByRole('heading', { name: 'RT-90827-BR' })).toBeVisible()
    await expect(page.getByText('Detalhes do envio')).toBeVisible()
    await page.getByRole('button', { name: 'Etiqueta' }).click()
    await expect(page.getByRole('dialog')).toContainText('Etiqueta de envio')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('endereço antigo de status redireciona para o pedido', async ({ page }) => {
    await entrar(page, { email: 'jhonata@email.com' })
    await page.goto('/#/cliente/status/RT-90827-BR')
    await expect(page).toHaveURL(/#\/cliente\/pedidos\/RT-90827-BR/)
  })

  test('faz um novo pedido e cai na página dele', async ({ page }) => {
    await entrar(page, { email: 'jhonata@email.com' })
    await page.getByRole('button', { name: 'Novo pedido' }).first().click()
    await page.getByLabel('Endereço de retirada (origem)').fill('Rua da Aurora, 100')
    await page.getByLabel('Endereço de entrega (destino)').fill('Av. Boa Viagem, 500')
    await page.getByLabel('Nome do destinatário').fill('Maria Teste')
    await page.getByRole('button', { name: 'Solicitar envio' }).click()
    await expect(page).toHaveURL(/#\/cliente\/pedidos\/RT-/)
    await expect(page.getByText('Detalhes do envio')).toBeVisible()
  })
})

test.describe('administrador', () => {
  test('menu com 7 áreas, mapa no painel e configurações em 3 abas', async ({ page }) => {
    await entrar(page, { empresa: true, email: 'luis@logisuape.com.br' })
    await expect(page.getByRole('heading', { name: 'Painel da operação' })).toBeVisible()
    expect(await itensDoMenu(page)).toEqual(['Painel', 'Entregas', 'Ativos', 'Central de alertas', 'Equipes', 'Relatórios', 'Configurações'])
    await expect(page.getByRole('region', { name: 'Mapa ao vivo da operação' })).toBeVisible()

    await page.goto('/#/empresa/configuracoes')
    for (const aba of ['Empresa', 'Privacidade (LGPD)', 'Integrações']) await expect(page.getByRole('tab', { name: aba, exact: true })).toBeVisible()
  })

  test('importação de CSV abre dentro de Entregas', async ({ page }) => {
    await entrar(page, { empresa: true, email: 'luis@logisuape.com.br' })
    await page.goto('/#/empresa/entregas')
    await page.getByRole('button', { name: 'Importar CSV' }).click()
    await expect(page.getByRole('dialog')).toContainText('Baixar modelo')
  })

  test('ficha do ativo mostra utilização de no máximo 100%', async ({ page }) => {
    await entrar(page, { empresa: true, email: 'luis@logisuape.com.br' })
    await page.goto('/#/empresa/ativos/ATV-00412')
    const linha = page.locator('.row-between', { has: page.getByText('Utilização', { exact: true }) })
    const pct = Number((await linha.locator('strong').innerText()).replace('%', ''))
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThanOrEqual(100)
  })
})
