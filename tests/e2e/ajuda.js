import { expect } from '@playwright/test'

export const CNPJ_DEMO = '12.345.678/0001-95'
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** Entra pela tela de login, como uma pessoa faria. */
export async function entrar(page, { empresa = false, email, senha = 'demo123' }) {
  await page.goto('/#/login')
  if (empresa) await page.getByRole('tab', { name: 'Empresa', exact: true }).click()
  await page.getByLabel(empresa ? 'E-mail corporativo' : 'E-mail', { exact: true }).fill(email)
  if (empresa) await page.getByLabel('CNPJ').fill(CNPJ_DEMO)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/#\/login/)
}

/** Itens do menu hambúrguer (abre e lê os links). */
export async function itensDoMenu(page) {
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  const menu = page.getByRole('complementary', { name: 'Menu principal' })
  await expect(menu).toBeVisible()
  const itens = await menu.locator('nav a').allInnerTexts()
  await page.getByRole('button', { name: 'Fechar menu' }).click()
  return itens.map((t) => t.replace(/\d+$/, '').trim())
}
