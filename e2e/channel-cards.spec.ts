import { test, expect, type Page } from '@playwright/test';

/**
 * Channel card typography must survive viewer font scaling.
 *
 * Regression: BUG-022 — the grid/list cards had a hard-coded px height while
 * their contents were rem-sized (Tailwind), so any root font size above 16px
 * made flex shrink the name/group line boxes and `overflow-hidden` cropped the
 * text. These specs force a larger root font size and assert that the name and
 * group text keep their full line box, and that the scroller's index math
 * still matches the rendered row pitch (otherwise scrolling would desync).
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Live TV/i }).first().click();
  await expect(page.getByTestId('live-viewport')).toBeVisible();
});

test.afterAll(async () => {
  await page.context().close();
});

async function setRootFontSize(px: number) {
  await page.evaluate((size) => {
    let style = document.getElementById('spec-root-font') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'spec-root-font';
      document.head.appendChild(style);
    }
    style.textContent = `html { font-size: ${size}px; }`;
  }, px);
  await page.waitForTimeout(250);
}

/** Name/group line boxes and the row-pitch the scroller is using. */
function cardMetrics() {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-index]'));
    const sample = cells.slice(0, 4);
    return {
      cells: sample.map((cell) => {
        const h4 = cell.querySelector('h4') as HTMLElement | null;
        const p = cell.querySelector('p') as HTMLElement | null;
        const line = (el: HTMLElement | null) =>
          el === null
            ? { box: 0, line: 0 }
            : {
                box: el.getBoundingClientRect().height,
                line: parseFloat(getComputedStyle(el).lineHeight),
              };
        return {
          height: cell.getBoundingClientRect().height,
          offsetTop: cell.offsetTop,
          name: line(h4),
          group: line(p),
          overflow: cell.scrollHeight - cell.clientHeight,
        };
      }),
      // VirtualGrid writes totalRows * rowSize onto the content element.
      contentHeight: (() => {
        const viewport = document.querySelector('[data-testid="live-viewport"]');
        const content = viewport?.firstElementChild as HTMLElement | null;
        return content ? parseFloat(content.style.height || '0') : 0;
      })(),
      columns: (() => {
        const grid = document
          .querySelector('[data-testid="live-viewport"]')
          ?.querySelector<HTMLElement>('.grid');
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      })(),
    };
  });
}

function expectNoClipping(metrics: Awaited<ReturnType<typeof cardMetrics>>) {
  for (const cell of metrics.cells) {
    expect(cell.name.box, `channel name line box (card h=${cell.height})`).toBeGreaterThanOrEqual(
      cell.name.line - 0.5
    );
    expect(cell.group.box, 'group line box').toBeGreaterThanOrEqual(cell.group.line - 0.5);
    expect(cell.overflow, 'card content clipped by overflow-hidden').toBeLessThanOrEqual(1);
  }
  const uniform = new Set(metrics.cells.map((cell) => Math.round(cell.height)));
  expect(uniform.size, 'row heights must stay uniform for index math').toBe(1);
}

async function expectScrollMathMatchesPitch(metrics: Awaited<ReturnType<typeof cardMetrics>>) {
  const pitch = metrics.cells[0].height + 16;
  const rows = metrics.contentHeight / pitch;
  expect(Number.isInteger(rows), `content height ${metrics.contentHeight} vs pitch ${pitch}`).toBe(
    true
  );
  expect(metrics.columns).toBeGreaterThan(0);
}

test('grid cards keep full name/group line boxes at the default font size', async () => {
  await setRootFontSize(16);
  expectNoClipping(await cardMetrics());
});

test('grid cards survive a 20px root font size and keep scroll math in sync', async () => {
  await setRootFontSize(20);
  const metrics = await cardMetrics();
  expectNoClipping(metrics);
  expect(metrics.cells[0].height).toBeGreaterThan(208);
  await expectScrollMathMatchesPitch(metrics);
});

test('grid cards survive a 24px root font size', async () => {
  await setRootFontSize(24);
  const metrics = await cardMetrics();
  expectNoClipping(metrics);
  await expectScrollMathMatchesPitch(metrics);
});

test('focused card stays fully visible after scrolling at 20px root font size', async () => {
  await setRootFontSize(20);
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(600);

  const visible = await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="live-viewport"]') as HTMLElement;
    const focused = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    if (!focused) return { ok: false, reason: 'no focused card' };
    const vp = viewport.getBoundingClientRect();
    const f = focused.getBoundingClientRect();
    return { ok: f.top >= vp.top - 1 && f.bottom <= vp.bottom + 1, top: f.top, vpTop: vp.top, vpBottom: vp.bottom, bottom: f.bottom };
  });
  expect(visible.ok, JSON.stringify(visible)).toBe(true);
});

test('list rows keep the logo and text unclipped at 20px root font size', async () => {
  await setRootFontSize(20);
  await page.getByRole('button', { name: /List View/i }).click();
  await page.waitForTimeout(400);
  const list = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-index]'));
    return cells.slice(0, 3).map((cell) => {
      const logo = cell.querySelector('img, div') as HTMLElement | null;
      const h4 = cell.querySelector('h4') as HTMLElement | null;
      return {
        overflow: cell.scrollHeight - cell.clientHeight,
        logoBox: logo ? logo.getBoundingClientRect().height : 0,
        nameBox: h4 ? h4.getBoundingClientRect().height : 0,
        nameLine: h4 ? parseFloat(getComputedStyle(h4).lineHeight) : 0,
      };
    });
  });
  for (const row of list) {
    expect(row.overflow, 'list row clipped').toBeLessThanOrEqual(1);
    expect(row.nameBox, 'list row name clipped').toBeGreaterThanOrEqual(row.nameLine - 0.5);
  }
  // restore grid view for later runs of the serial suite
  await page.getByRole('button', { name: /Grid View/i }).click();
});
