import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { json } from 'node:stream/consumers'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const output = resolve('test-results', 'shadcn')
await mkdir(output, { recursive: true })

const appLookups = []
let storageUnavailable = false
let showStorageMetrics = false
const server = await preview({
  configFile: false,
  logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0, strictPort: true },
  plugins: [{
    name: 'workspace-browser-fixtures',
    configurePreviewServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next()
        if (request.method === 'POST' && request.url === '/api/app-links/lookup') {
          const lookup = await json(request)
          appLookups.push(lookup)
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ results: lookup.targets.map((target) => ({ target, state: 'unconfirmed', listings: [] })) }))
          return
        }
        if (storageUnavailable && request.url === '/api/library/mode') {
          response.writeHead(503, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'Failed to fetch' }))
          return
        }
        const endpoints = {
          '/api/library/mode': { active: false },
          '/api/library/status': {
            active: showStorageMetrics, databaseBytes: 156 * 1024, attachmentDiskBytes: 6451, journalBytes: 0,
            freePageBytes: 4096, audioBytes: 9_017_754, counts: { savedItems: 7 },
          },
          '/api/media/transcripts': { entries: [], nextCursor: null },
          '/api/ai/status': showStorageMetrics
            ? { state: 'connected', connectionId: 'fixture-connection', email: 'local-research-library-test-account@example.test', models: [{ slug: 'example-model', label: 'Example model' }] }
            : { state: 'disconnected' },
        }
        const body = endpoints[request.url]
        response.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(body ?? { error: 'No live integration is enabled in the browser test.' }))
      })
    },
  }],
})

const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const currentDate = new Date().toISOString()
const transcriptText = 'A local transcript about saving ideas. It mentions Desk Notes, Example Planner, and Focus Timer.'
const appNames = ['Desk Notes', 'Example Planner', 'Focus Timer']
const fingerprint = createHash('sha256').update(JSON.stringify(['transcript', transcriptText, 'fixture-text:transcript-v1:transcript-chunker-v1'])).digest('hex')
const savedItem = (id, title, status) => ({
  id, title, status, sourceType: 'instagram', contentType: 'video',
  createdAt: currentDate, updatedAt: currentDate, collectionIds: [], categoryIds: [], tagIds: [],
})
const fixture = {
  savedItems: [
    { ...savedItem('review', 'Desk research', 'inbox'), transcriptId: 'local-text', userNotes: 'Keep for later.', url: 'https://example.test/reel/example' },
    savedItem('reading', 'Reading list', 'saved'),
    savedItem('library-notes', 'Library notes', 'saved'),
  ],
  categories: [{ id: 'fixture-category', name: 'Research methods', createdAt: currentDate, updatedAt: currentDate }],
  transcripts: [{
    id: 'local-text', savedItemId: 'review', text: transcriptText, origin: 'pasted', format: 'text', segments: [],
    parserVersion: 'transcript-v1', fingerprint: 'fixture-text', importedAt: currentDate,
  }],
  analyses: [{
    id: 'analysis-review', savedItemId: 'review', provider: 'chatgpt-plan', model: 'example-model',
    version: '2', kind: 'transcript', createdAt: currentDate, fingerprint, links: [],
    result: { summary: { text: 'Ideas are kept for later.', evidence: 'saving ideas' }, points: [], categories: [],
      mentions: appNames.map((text) => ({ text, evidence: text })) },
  }],
}

let browser
try {
  browser = await puppeteer.launch({
    ...(process.env.SIFTORY_CHROME_PATH ? { executablePath: process.env.SIFTORY_CHROME_PATH } : { channel: 'chrome' }),
    headless: true,
    args: ['--disable-background-networking', '--disable-sync', '--no-first-run'],
  })
  const page = await browser.newPage()
  const externalRequests = []
  const pageErrors = []
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith(origin + '/') || url.startsWith('data:')) void request.continue()
    else {
      externalRequests.push(url)
      void request.abort()
    }
  })
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  const heading = (text) => page.waitForFunction((title) => document.querySelector('h1')?.textContent?.trim() === title, {}, text)
  const screenshot = (name) => page.screenshot({ path: resolve(output, name), fullPage: true })
  async function layoutFits() {
    try {
      await page.waitForFunction(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth, { timeout: 4000 })
    } catch {
      const diagnostics = await page.evaluate(() => {
        const { clientWidth, scrollWidth } = document.documentElement
        const overflowing = [...document.querySelectorAll('main *')].flatMap((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.width && bounds.right > clientWidth + 1
            ? [{ tag: element.tagName, slot: element.getAttribute('data-slot'), right: Math.round(bounds.right) }]
            : []
        }).slice(0, 8)
        return { clientWidth, scrollWidth, overflowing }
      })
      assert.fail(`Horizontal overflow: ${JSON.stringify(diagnostics)}`)
    }
  }

  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(origin)
  await heading('Dashboard')
  await page.waitForSelector('a[href="#/import"]')
  await page.waitForFunction(async () => (await indexedDB.databases()).some(({ name, version }) => name === 'siftory-library' && version === 7))
  await page.evaluate(async (rows) => {
    const db = await new Promise((done, reject) => {
      const request = indexedDB.open('siftory-library')
      request.onsuccess = () => done(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = db.transaction(Object.keys(rows), 'readwrite')
      for (const [store, entries] of Object.entries(rows)) {
        for (const entry of entries) tx.objectStore(store).put(entry)
      }
      await new Promise((done, reject) => {
        tx.oncomplete = done
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, fixture)

  await page.reload()
  await heading('Dashboard')
  assert(await page.evaluate(async () => {
    const [font] = await document.fonts.load('14px "Roboto Variable"')
    return font?.status === 'loaded' && getComputedStyle(document.body).fontFamily.includes('Roboto Variable')
  }))
  assert(await page.$eval('[data-slot="sidebar-inner"]', (sidebar) => {
    const style = getComputedStyle(sidebar)
    return parseFloat(style.borderRadius) > 0 && style.borderLeftWidth === '1px'
      && style.backgroundColor !== getComputedStyle(document.body).backgroundColor
  }))
  await page.waitForSelector('table a[href="#/item/review"]')
  await page.waitForSelector('[data-chart] svg')
  assert.equal(await page.$$eval('table tbody a[href^="#/item/"]', (links) => links.length), 3)
  await page.waitForFunction(() => document.querySelector('[role="status"]') && document.body.textContent.includes('3 items added in the last 30 days.'))
  const activityRange = '[aria-label^="Activity date range"]'
  await page.evaluate(() => {
    document.addEventListener('animationend', (event) => {
      if (event.target.matches('[data-slot="dropdown-menu-content"], [data-slot="select-content"]')) {
        document.body.classList.add(`test-animation-${event.animationName}`)
      }
    })
  })
  assert.equal(await page.$eval(activityRange, (element) => getComputedStyle(element).fontSize), '14px')
  await page.focus(activityRange)
  await page.keyboard.press('Enter')
  await page.waitForSelector('[role="menuitemradio"][aria-checked="true"]')
  assert.equal(await page.$eval('[role="menuitemradio"][aria-checked="true"]', (element) => element.textContent.trim()), 'Last 30 days')
  await page.waitForSelector('body.test-animation-menu-in')
  await screenshot('dashboard-range-menu.png')
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.body.textContent.includes('3 items added in the last 7 days.'))
  await page.waitForSelector('body.test-animation-menu-out')
  await page.waitForFunction((selector) => document.activeElement?.matches(selector), {}, activityRange)
  assert(await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await layoutFits()
  await screenshot('dashboard-desktop.png')
  const trigger = '[aria-label="Toggle navigation"]'
  await page.locator(trigger).click()
  await page.waitForSelector('[data-slot="sidebar"][data-state="collapsed"]')
  await page.keyboard.down('Control')
  await page.keyboard.press('b')
  await page.keyboard.up('Control')
  await page.waitForSelector('[data-slot="sidebar"][data-state="expanded"]')

  const primary = 'rgb(107, 52, 144)'
  const dashboardAction = 'a[data-slot="button"][data-variant="default"][href="#/import"]'
  await page.waitForSelector(dashboardAction)
  await page.evaluate((color) => document.documentElement.style.setProperty('--primary', color), primary)
  await page.waitForFunction((selector, color) => getComputedStyle(document.querySelector(selector)).backgroundColor === color, {}, dashboardAction, primary)
  await page.click(dashboardAction)
  await heading('Bring things in')
  await page.waitForSelector('.import-source-picker')
  await page.locator('::-p-text(A web link)').click()
  await page.waitForSelector('.import-url-form .primary-button')
  await page.waitForFunction((color) => getComputedStyle(document.querySelector('.import-url-form .primary-button')).backgroundColor === color, {}, primary)
  await page.evaluate(() => document.documentElement.style.removeProperty('--primary'))

  await page.goto(origin + '/#/dashboard')
  await page.waitForSelector('table a[href="#/item/review"]')
  await page.click('table a[href="#/item/review"]')
  await heading('Desk research')
  await page.waitForFunction(() => document.querySelector('.analysis-summary-text')?.textContent?.includes('Ideas are kept for later.'))
  const appLinks = '.app-links-panel'
  const appLinksToggle = `${appLinks} [data-slot="collapsible-trigger"]`
  await page.$eval(`${appLinks} .disclosure-grid`, (panel) => {
    panel.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'grid-template-rows' && event.target === panel) {
        panel.dataset.testTransition = panel.parentElement.dataset.state
      }
    })
  })
  await page.focus(appLinksToggle)
  await page.keyboard.press('Enter')
  await page.waitForSelector(`${appLinksToggle}[aria-expanded="true"]`)
  await page.waitForSelector(`${appLinks} [data-test-transition="open"]`)
  await page.locator('::-p-aria(Example Planner[role="checkbox"])').click()
  await page.waitForFunction(() => document.querySelector('.app-links-panel')?.textContent.includes('2 selected'))
  await screenshot('app-links-desktop.png')
  await page.locator('::-p-aria(Find app links[role="button"])').click()
  await page.waitForFunction(() => document.querySelector('.app-links-panel')?.textContent.includes('No matching listing was confirmed'))
  assert.deepEqual(appLookups.map(({ targets, consent }) => [targets.map(({ value }) => value), consent]), [[['Desk Notes', 'Focus Timer'], true]])
  await page.locator(appLinksToggle).click()
  await page.waitForSelector(`${appLinks} .disclosure-grid`, { hidden: true })
  await page.waitForSelector(`${appLinks} [data-test-transition="closed"]`)
  await page.locator(appLinksToggle).click()
  await page.waitForSelector('::-p-aria(Example Planner[role="checkbox"])')
  assert.equal(await page.$eval('::-p-aria(Example Planner[role="checkbox"])', (control) => control.getAttribute('aria-checked')), 'false')
  await page.click('#item-tab-transcript')
  await page.waitForSelector('#item-view-transcript:not([hidden]) .transcript-reading')
  assert(await page.$eval('.transcript-reading', (element) => element.textContent.includes('A local transcript')))

  await page.click('#item-tab-details')
  await page.waitForSelector('#item-view-details:not([hidden]) [data-slot="card"]')
  const category = '::-p-aria(Research methods[role="checkbox"])'
  await page.locator(category).click()
  await page.waitForSelector('#item-view-details [role="checkbox"][aria-checked="true"]')
  await layoutFits()
  await screenshot('item-details-desktop.png')

  await page.goto(origin + '/#/library')
  await heading('All saved')
  await page.locator('::-p-aria(Source and labels[role="button"])').click()
  await page.waitForSelector('.filter-panel input[type="date"]', { visible: true })
  const filterHeights = await page.$$eval('.library-toolbar [role="combobox"], .filter-panel [role="combobox"], .filter-panel input',
    (elements) => elements.map((element) => element.getBoundingClientRect().height))
  assert(filterHeights.length >= 8 && filterHeights.every((height) => height === 32))
  await screenshot('library-controls-desktop.png')

  storageUnavailable = true
  showStorageMetrics = true
  await page.goto(origin + '/#/settings')
  await page.reload()
  await heading('Settings')
  await page.waitForSelector('[aria-labelledby="storage-heading"] [role="alert"]')
  await page.waitForSelector('::-p-aria(Disconnect ChatGPT[role="button"])')
  assert.equal(await page.$('.storage-error'), null)
  storageUnavailable = false
  await page.locator('::-p-aria(Retry local storage[role="button"])').click()
  await page.waitForSelector('[aria-labelledby="storage-heading"] [role="alert"]', { hidden: true })
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="storage-heading"]')?.textContent.includes('156.0 KiB'))
  assert(await page.$$eval('[aria-labelledby="chatgpt-heading"], [aria-labelledby="storage-heading"]', ([ai, storage]) =>
    ai.getBoundingClientRect().top === storage.getBoundingClientRect().top))
  await layoutFits()
  await screenshot('settings-desktop.png')

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await heading('Settings')
  await page.waitForSelector('::-p-aria(Disconnect ChatGPT[role="button"])')
  assert(await page.$$eval('[aria-labelledby="chatgpt-heading"], [aria-labelledby="storage-heading"]', ([ai, storage]) =>
    ai.getBoundingClientRect().bottom < storage.getBoundingClientRect().top))
  await layoutFits()
  await screenshot('settings-mobile.png')
  await page.goto(origin + '/#/item/review')
  await heading('Desk research')
  await page.locator(appLinksToggle).click()
  await page.waitForSelector('::-p-aria(Example Planner[role="checkbox"])')
  await layoutFits()
  await screenshot('app-links-mobile.png')
  await page.goto(origin + '/#/dashboard')
  await heading('Dashboard')
  await page.waitForSelector('[aria-label="Toggle navigation"]')
  await page.locator(trigger).click()
  await page.waitForSelector('[role="dialog"] a[href="#/inbox"]', { visible: true })
  assert(await page.$eval('[role="dialog"][data-mobile="true"]', (sidebar) => parseFloat(getComputedStyle(sidebar).borderRadius) > 0))
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { hidden: true })
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Toggle navigation')
  await page.locator(trigger).click()
  await page.locator('[role="dialog"] a[href="#/inbox"]').click()
  await heading('Inbox')
  await page.waitForSelector('[role="dialog"]', { hidden: true })
  await page.locator('::-p-aria(Filter by review status[role="combobox"])').click()
  await page.locator('::-p-aria(Needs attention[role="option"])').click()
  await page.waitForFunction(() => document.body.textContent.includes('No matching items'))
  await page.locator('::-p-aria(Filter by review status[role="combobox"])').click()
  await page.locator('::-p-aria(All review stages[role="option"])').click()
  await page.waitForSelector('.inbox-row a[href="#/item/review"]')

  await page.locator('::-p-aria(Source and labels[role="button"])').click()
  await page.locator('::-p-aria(Source[role="combobox"])').click()
  await page.waitForSelector('[data-slot="select-content"]')
  assert.equal(await page.$eval('[data-slot="select-content"]', (menu) => getComputedStyle(menu).animationName), 'menu-in')
  await page.locator('::-p-aria(Website[role="option"])').click()
  await page.waitForFunction(() => document.body.textContent.includes('No matching items'))
  await page.waitForSelector('.inbox-row a[href="#/item/review"]', { hidden: true })
  await page.locator('::-p-aria(Source[role="combobox"])').click()
  await page.locator('::-p-aria(Any[role="option"])').click()
  await page.waitForSelector('.inbox-row a[href="#/item/review"]')
  await page.waitForSelector('[role="listbox"]', { hidden: true })
  await page.locator('[data-slot="collapsible-trigger"][aria-expanded="true"]').click()
  await page.waitForSelector('[data-slot="collapsible-trigger"][aria-expanded="false"]')

  const inboxActions = '[aria-label="Actions for Desk research"]'
  await page.waitForSelector(inboxActions, { visible: true })
  await page.locator(inboxActions).click()
  await page.waitForSelector('[role="menuitem"][data-variant="destructive"]', { visible: true })
  await layoutFits()
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="menu"]', { hidden: true })
  await page.waitForFunction((selector) => document.activeElement?.matches(selector), {}, inboxActions)
  await page.locator(inboxActions).click()
  await page.locator('::-p-aria(Move to All Saved[role="menuitem"])').click()
  await page.waitForSelector('.inbox-row a[href="#/item/review"]', { hidden: true })

  await page.locator('::-p-aria(Add item[role="button"])').click()
  await page.locator('::-p-aria(Title[role="textbox"])').fill('Synthetic article')
  await page.locator('::-p-aria(Source[role="combobox"])').click()
  await page.locator('::-p-aria(Reddit[role="option"])').click()
  await page.locator('::-p-aria(Content type[role="combobox"])').click()
  await page.locator('::-p-aria(Article[role="option"])').click()
  await page.locator('::-p-aria(Add to Inbox[role="button"])').click()
  await page.waitForFunction(() => {
    const row = document.querySelector('.inbox-row')
    return row?.textContent.includes('Synthetic article') && row?.textContent.includes('Reddit')
  })
  await page.locator('::-p-aria(Synthetic article[role="link"])').click()
  await heading('Synthetic article')
  await page.click('#item-tab-details')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#item-view-details:not([hidden]) .detail-list dd')).some((entry) => entry.textContent === 'Article'))

  await page.goto(origin + '/#/dashboard')
  await heading('Dashboard')
  await page.waitForSelector('table a[href="#/item/review"]')
  await page.click('[aria-label="Switch to light theme"]')
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
  await page.reload()
  await page.waitForSelector('table a[href="#/item/review"]')
  await page.waitForSelector('[data-chart] svg')
  assert(await page.evaluate(() => !document.documentElement.classList.contains('dark')))
  await layoutFits()
  await screenshot('dashboard-mobile.png')
  await page.setViewport({ width: 320, height: 780, isMobile: true, hasTouch: true })
  await layoutFits()
  await page.locator(activityRange).click()
  await page.waitForSelector('[role="menuitemradio"]', { visible: true })
  await layoutFits()
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="menu"]', { hidden: true })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.locator(activityRange).click()
  await page.waitForSelector('[role="menu"]', { visible: true })
  assert.equal(await page.$eval('[role="menu"]', (menu) => getComputedStyle(menu).animationName), 'none')

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(externalRequests, [])
  console.log('Puppeteer passed the dashboard, compact controls, item details, Settings recovery, menu motion, mobile layouts, and theme checks.')
  console.log(`Screenshots saved to ${output}.`)
} finally {
  await browser?.close()
  await new Promise((done) => server.httpServer.close(done))
}
