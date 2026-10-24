// App do entregador no celular: carregar a rota e registrar uma entrega com foto e assinatura.
import { expect, test } from '@playwright/test'
import { PNG, entrar } from './ajuda.js'

test('um toque por parada: registrar entrega faz a próxima sair sozinha', async ({ page }) => {
  await entrar(page, { empresa: true, email: 'thiago@logisuape.com.br' })
  const termo = page.getByRole('button', { name: /Estou ciente/ })
  if (await termo.isVisible().catch(() => false)) await termo.click()

  // sem barra inferior e com a próxima parada visível sem rolar
  await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveCount(0)
  await expect(page.getByText('Próxima parada')).toBeInViewport()

  const carregar = page.getByRole('button', { name: /Carregar e/ })
  if (await carregar.isVisible().catch(() => false)) {
    await carregar.click()
    await expect(page.getByText(/Rota iniciada/)).toBeVisible()
  }

  const destino = await page.locator('.card.highlight h2').innerText()
  await page.getByRole('button', { name: 'Registrar entrega' }).first().click()
  await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG })
  const area = await page.getByLabel('Área de assinatura').boundingBox()
  await page.mouse.move(area.x + 20, area.y + 30)
  await page.mouse.down()
  await page.mouse.move(area.x + 140, area.y + 80, { steps: 6 })
  await page.mouse.up()
  await page.getByLabel('Nome do recebedor').fill('Maria Teste')
  await page.getByRole('button', { name: 'Finalizar entrega' }).click()

  await expect(page.getByText(/Registrado/)).toBeVisible()
  await expect(page.getByText(/concluída\(s\) hoje/)).toBeVisible()
  // a próxima parada agora é outra, já "saiu para entrega"
  await expect(page.locator('.card.highlight h2')).not.toHaveText(destino)
  await expect(page.locator('.card.highlight')).toContainText('Saiu para entrega')
})
