// Web e2e scenario: hovering a sidebar session row marquees a title wider than
// its cell. The jsdom lane pins only the positions the handler writes; the
// assembled browser is where the title really clips, really crawls toward its
// own hovered extent (the trailing relative-time cell yields to the row menu
// while the pointer rests on the row, so the hovered cell is wider than the
// resting one), really fades its moved left edge, and really returns to its
// start when the pointer leaves.
//
// Zero model calls: seeding one renamed session and hovering its row touches no
// provider.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { captureStableAria, compareOrRefreshGolden, launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SEED = fileURLToPath(new URL('../../../snapshots/web/seeded-history/session.v3.jsonl', import.meta.url))
/** Wider than the sidebar cell, under the 80-byte title limit, with a far-edge suffix the marquee must reach. */
const TITLE = 'Forked session clipped before its suffix (1)'
const MOBILE_EXPECTED = fileURLToPath(new URL('./expected/sidebar-mobile.expected.md', import.meta.url))
const HEADER_EXPECTED = fileURLToPath(new URL('./expected/header-corner-scroll.expected.md', import.meta.url))
const MODE = webSnapshotMode()

describe('web e2e: hovering a clipped session title marquees it to its far edge', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    const workspace = await scaffold.ctx.workspaceRegistry.create(scaffold.workspaceCwd)
    const id = await seedSession(scaffold, await readFile(SEED, 'utf8'), 'sidebar-title-hover-scroll')
    await workspace.attachSession(id)
    await scaffold.ctx.sessionController.rename({ sessionId: id, title: TITLE })
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('crawls the clipped title under the pointer and restores its start after', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-sidebar-title-hover-scroll'))
    const row = page.getByRole('treeitem').filter({ has: page.getByText(TITLE, { exact: true }) })
    await row.waitFor({ timeout: 20_000 })
    const title = row.getByText(TITLE, { exact: true })

    // At rest the row clips its title with an ellipsis and holds its start.
    expect(await title.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0)
    expect(await title.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis')
    expect(await title.evaluate(el => el.scrollLeft)).toBe(0)

    await row.hover()
    // The marquee crawls instead of jumping: the title is caught mid-travel,
    // strictly between its start and its far edge, with both cut edges
    // publishing their fade-mask hooks.
    await expect.poll(
      async () => title.evaluate(el => el.scrollLeft > 0),
      { timeout: 5_000 },
    ).toBe(true)
    expect(await title.evaluate(el => el.scrollLeft < el.scrollWidth - el.clientWidth - 1)).toBe(true)
    expect(await title.evaluate(el => el.hasAttribute('data-scrolled'))).toBe(true)
    expect(await title.evaluate(el => el.hasAttribute('data-clipped'))).toBe(true)
    expect(await title.evaluate(el => getComputedStyle(el).maskImage)).toContain('linear-gradient')
    // The crawl still reaches the far edge of the hovered cell (the wider
    // one — the relative-time label yields to the row menu) and rests there,
    // lifting the right fade so the final character reads at full strength.
    // The fade lifts on the frame that lands exactly on the far edge, one or
    // two frames after scrollLeft first rounds within a pixel of it.
    await expect.poll(
      async () => title.evaluate(el => el.scrollLeft >= el.scrollWidth - el.clientWidth - 1),
      { timeout: 20_000 },
    ).toBe(true)
    await expect.poll(
      async () => title.evaluate(el => el.hasAttribute('data-clipped')),
      { timeout: 5_000 },
    ).toBe(false)
    // At its extent, the title must not paint the ellipsis over the
    // characters the marquee reached.
    expect(await title.evaluate(el => getComputedStyle(el).textOverflow)).toBe('clip')

    // Leaving returns in one step: a crawl back would still be travelling
    // inside this window, and it would carry the resting ellipsis with it.
    await page.mouse.move(0, 0)
    await expect.poll(
      async () => title.evaluate(el => el.scrollLeft),
      { timeout: 150, interval: 20 },
    ).toBe(0)
    expect(await title.evaluate(el => el.hasAttribute('data-scrolled'))).toBe(false)
    expect(await title.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis')

    // Reduced motion reaches the handler's matchMedia probe: the reveal jumps
    // to the far edge instead of crawling.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await row.hover()
    await expect.poll(
      async () => title.evaluate(el => el.scrollLeft >= el.scrollWidth - el.clientWidth - 1),
      { timeout: 500, interval: 20 },
    ).toBe(true)
    await page.mouse.move(0, 0)
    await page.emulateMedia({ reducedMotion: null })
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it('keeps the narrow sidebar in a zero-track overlay', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-sidebar-mobile-overlay'))
    await page.setViewportSize({ width: 800, height: 900 })
    const frame = page.locator('[data-sidebar-mobile]')
    await frame.waitFor({ timeout: 20_000 })
    const firstTrack = async (): Promise<string> => frame.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ')[0] ?? '')
    await expect.poll(firstTrack).toBe('0px')

    const trigger = page.getByRole('button', { name: 'Open sidebar', exact: true })
    await trigger.waitFor({ timeout: 20_000 })
    await page.mouse.move(780, 800)
    await page.getByRole('tooltip').waitFor({ state: 'detached', timeout: 5_000 })
    if (process.env.DSH_VISUAL_EVIDENCE_DIR !== undefined) {
      await page.screenshot({ path: join(process.env.DSH_VISUAL_EVIDENCE_DIR, 'sidebar-800-closed.png') })
    }
    await trigger.click()
    const drawer = page.locator('[data-sidebar-mobile-root]')
    await drawer.waitFor({ timeout: 10_000 })
    expect(await firstTrack()).toBe('0px')
    expect(await page.getByRole('button', { name: 'New session', exact: true }).count()).toBe(1)
    await page.mouse.move(780, 800)
    await page.getByRole('tooltip').waitFor({ state: 'detached', timeout: 5_000 })
    if (process.env.DSH_VISUAL_EVIDENCE_DIR !== undefined) {
      await page.screenshot({ path: join(process.env.DSH_VISUAL_EVIDENCE_DIR, 'sidebar-800-open.png') })
    }
    const snapshot = await captureStableAria(page, '[data-sidebar-mobile-root]', scaffold.workspaceCwd, {
      normalizeAge: true,
      replacements: [[basename(scaffold.workspaceCwd), '{{workspace}}']],
    })
    await compareOrRefreshGolden(MOBILE_EXPECTED, snapshot, MODE)

    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'detached', timeout: 10_000 })
    await trigger.waitFor({ state: 'visible' })
    await trigger.click()
    await drawer.waitFor({ timeout: 10_000 })
    await page.locator('[data-sidebar-brand-collapse]').click()
    await drawer.waitFor({ state: 'detached', timeout: 10_000 })
    await trigger.waitFor({ state: 'visible' })
    expect(await firstTrack()).toBe('0px')
    await page.setViewportSize({ width: 1280, height: 900 })
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it('keeps the header corner fixed while title controls scroll', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-header-corner-scroll'))
    await page.locator('[data-sidebar-mobile]').waitFor({ state: 'detached', timeout: 10_000 })
    const openSidebar = page.getByRole('button', { name: 'Open sidebar', exact: true })
    if (await openSidebar.isVisible()) await openSidebar.click()
    await page.getByRole('treeitem').filter({ has: page.getByText(TITLE, { exact: true }) }).click()
    await page.locator('[data-conversation-header-scroller]').getByText(TITLE, { exact: true }).waitFor()
    await page.setViewportSize({ width: 360, height: 900 })
    await page.locator('[data-sidebar-mobile-trigger]').waitFor({ timeout: 10_000 })
    await expect.poll(() => page.locator('[class*="centerCol"]').first().evaluate(element => element.getBoundingClientRect().width), { timeout: 10_000 }).toBeGreaterThan(300)
    const row = page.locator('[data-conversation-header-row]')
    const corner = page.locator('[data-conversation-header-corner]')
    const cornerButton = corner.getByRole('button', { name: 'Open right sidebar', exact: true })
    await row.waitFor({ timeout: 20_000 })
    await cornerButton.waitFor({ timeout: 20_000 })

    const scrollWidths = async (): Promise<number> => page.evaluate(() => {
      const element = document.querySelector<HTMLDivElement>('[data-conversation-header-scroller]')
      if (element === null) throw new Error('conversation title scroller was not rendered')
      return element.scrollWidth - element.clientWidth
    })
    await expect.poll(scrollWidths, { timeout: 10_000 }).toBeGreaterThan(0)
    await page.locator('[data-conversation-header-scroller]').evaluate((element) => { element.scrollLeft = 0 })
    expect(await page.locator('[data-conversation-header-scroller]').evaluate(element => element.scrollLeft)).toBe(0)
    const before = await cornerButton.boundingBox()
    if (before === null) throw new Error('right sidebar control has no layout box')
    if (process.env.DSH_VISUAL_EVIDENCE_DIR !== undefined) {
      await page.screenshot({ path: join(process.env.DSH_VISUAL_EVIDENCE_DIR, 'header-360-before.png') })
    }
    const snapshot = await captureStableAria(page, '[data-conversation-header-row]', scaffold.workspaceCwd, { normalizeAge: true })
    await compareOrRefreshGolden(HEADER_EXPECTED, snapshot, MODE)

    await page.evaluate(() => {
      const element = document.querySelector<HTMLDivElement>('[data-conversation-header-scroller]')
      if (element === null) throw new Error('conversation title scroller was not rendered')
      element.scrollLeft = element.scrollWidth
    })
    expect(await page.evaluate(() => document.querySelector<HTMLDivElement>('[data-conversation-header-scroller]')?.scrollLeft ?? 0)).toBeGreaterThan(0)
    const after = await cornerButton.boundingBox()
    if (after === null) throw new Error('right sidebar control left the viewport')
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
    if (process.env.DSH_VISUAL_EVIDENCE_DIR !== undefined) {
      await page.screenshot({ path: join(process.env.DSH_VISUAL_EVIDENCE_DIR, 'header-360-after.png') })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)
})
