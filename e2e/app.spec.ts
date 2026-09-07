import { expect, test } from '@playwright/test'

async function completeAllSets(page: import('@playwright/test').Page) {
  await page.locator('.warmup-complete, .complete-set-button').evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()))
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
}

test('works as a persistent iPhone workout log', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'iPhone WebKit flow')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Competition' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: /start workout/i }).click()
  await expect(page.getByLabel('Back Squat working weight')).toHaveValue('205')
  await page.getByRole('button', { name: 'Complete Back Squat set 1' }).click()
  await expect(page.getByText('RESTING')).toBeVisible()

  await page.reload()
  await expect(page.getByText(/1\/22 work/)).toBeVisible()
  await expect(page.getByLabel('Back Squat working weight')).toHaveValue('205')
})

test('cycles workouts and rotates the B bench variation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Full workflow runs once')
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Start rest timer automatically').uncheck()
  await page.getByRole('button', { name: 'Today' }).click()

  await page.getByRole('button', { name: /start workout/i }).click()
  await completeAllSets(page)
  await expect(page.getByRole('heading', { name: 'Deadlift + upper' })).toBeVisible()
  await expect(page.getByText('Feet-up Bench Press')).toBeVisible()

  await page.getByRole('button', { name: /start workout/i }).click()
  await expect(page.getByRole('heading', { name: 'Feet-up bench week' })).toBeVisible()
  await completeAllSets(page)
  await expect(page.getByRole('heading', { name: 'Paused technique' })).toBeVisible()

  await page.getByRole('button', { name: /start workout/i }).click()
  await completeAllSets(page)
  await expect(page.getByRole('heading', { name: 'Competition' })).toBeVisible()

  await page.getByRole('button', { name: /start workout/i }).click()
  await completeAllSets(page)
  await expect(page.getByRole('heading', { name: 'Deadlift + upper' })).toBeVisible()
  await expect(page.getByText('Incline Bench Press')).toBeVisible()
})

test('exports completed history as CSV', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Download behavior is covered in desktop Chrome')
  await page.goto('/')
  await page.getByRole('button', { name: /start workout/i }).click()
  await page.locator('.complete-set-button').first().click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.getByRole('button', { name: /Done/ }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export history CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^lift-history-\d{4}-\d{2}-\d{2}\.csv$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('session_id')
  expect(csv).toContain('Back Squat')
})

test('production PWA loads offline after installation cache is ready', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Offline cache check runs once')
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Competition' })).toBeVisible()
})

test('switches programs while retaining each program state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Program switch flow runs once')
  await page.goto('/')
  await page.getByRole('button', { name: 'Plan' }).click()
  await page.getByRole('button', { name: /Texas Method/ }).click()
  await page.getByRole('button', { name: /Use this program/ }).click()
  await expect(page.getByRole('heading', { name: 'Volume Day' })).toBeVisible()
  await page.getByRole('button', { name: 'Plan' }).click()
  await page.getByRole('button', { name: /Personal Powerlifting/ }).click()
  await page.getByRole('button', { name: /Use this program/ }).click()
  await expect(page.getByRole('heading', { name: 'Competition' })).toBeVisible()
})
