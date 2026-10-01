import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { KENO_PAYTABLE, type KenoPicks } from "../src/lib/logic/keno";
import { ankOf } from "../src/lib/logic/matka";
import { PLINKO_X10 } from "../src/lib/logic/plinko";
import { SCRATCH_PRIZES_X100, type ScratchSymbol } from "../src/lib/logic/scratch";
import { evaluateLines, type SymbolId } from "../src/lib/logic/slots";
import { WHEEL_SEGMENTS_X10, segmentAtPointer } from "../src/lib/logic/wheel";
import { formatMultiplier } from "../src/lib/money";

/** Fails the test on any console error, any message mentioning hydration, or an uncaught page error. */
const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" || /hydration/i.test(msg.text())) errors.push(`[console.${msg.type()}] ${msg.text()}`);
      });
      page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
      await use(errors);
      expect(errors, "console errors / hydration warnings / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

const BET = 1000; // the default "10.00"
const SETTLED_KIND = /^(win|push|partial|loss)$/;

interface Played {
  balanceBefore: number;
  balanceAfter: number;
  bet: number;
  payout: number;
}

const balanceLocator = (page: Page) => page.locator("[data-testid=balance][data-cents]");

async function readBalance(page: Page): Promise<number> {
  await expect(balanceLocator(page)).toBeVisible();
  return Number(await balanceLocator(page).getAttribute("data-cents"));
}

async function gotoGame(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(balanceLocator(page)).toBeVisible();
  await expect(page.getByTestId("bet-input")).toHaveValue("10.00");
}

/**
 * Shared single-round check (AC13–AC23): trigger the round (triple-click), wait for exactly one
 * settle, confirm no second round follows within 1 s, and check balance = before − bet + payout.
 */
async function playOnce(page: Page, trigger: () => Promise<void>): Promise<Played> {
  const balanceBefore = await readBalance(page);
  const result = page.getByTestId("result");
  const roundBefore = Number(await result.getAttribute("data-round"));

  await trigger();

  const roundAfter = String(roundBefore + 1);
  await expect(result).toHaveAttribute("data-round", roundAfter, { timeout: 15_000 });
  await expect(result).toHaveAttribute("data-kind", SETTLED_KIND);
  await page.waitForTimeout(1000);
  await expect(result).toHaveAttribute("data-round", roundAfter);

  const bet = Number(await result.getAttribute("data-bet-cents"));
  const payout = Number(await result.getAttribute("data-payout-cents"));
  expect(bet).toBe(BET);
  expect(Number.isInteger(payout) && payout >= 0).toBe(true);
  const balanceAfter = balanceBefore - bet + payout;
  await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(balanceAfter));
  return { balanceBefore, balanceAfter, bet, payout };
}

const tripleClick = (target: Locator) => () => target.click({ clickCount: 3 });

async function expectKind(page: Page, won: boolean): Promise<void> {
  await expect(page.getByTestId("result")).toHaveAttribute("data-kind", won ? "win" : "loss");
}

// ---------------------------------------------------------------------------------------------
// Slots

test("slots: one spin, reels stop in order, payout and win cells match evaluateLines", async ({ page }) => {
  await gotoGame(page, "/slots");

  // In-page poll (every animation frame) of the moment each reel flips back to data-stopped="true".
  await page.evaluate(() => {
    const w = window as unknown as { __reelStops: (number | null)[] };
    w.__reelStops = [null, null, null, null, null];
    const seenSpinning = [false, false, false, false, false];
    const start = performance.now();
    const poll = () => {
      const reels = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="reel"]'));
      for (const el of reels) {
        const i = Number(el.dataset.reel);
        const stopped = el.dataset.stopped === "true";
        if (!stopped) seenSpinning[i] = true;
        else if (seenSpinning[i] && w.__reelStops[i] === null) w.__reelStops[i] = performance.now();
      }
      if (w.__reelStops.some((t) => t === null) && performance.now() - start < 15_000) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));

  const stops = await page.evaluate(() => (window as unknown as { __reelStops: (number | null)[] }).__reelStops);
  expect(stops.every((t) => t !== null), `every reel observed stopping: ${JSON.stringify(stops)}`).toBe(true);
  for (let i = 1; i < stops.length; i++) {
    expect(stops[i]!, `reel ${i} stops after reel ${i - 1}`).toBeGreaterThanOrEqual(stops[i - 1]!);
  }

  const cells = await page.getByTestId("slot-cell").evaluateAll((els) =>
    els.map((el) => ({
      reel: Number(el.getAttribute("data-reel")),
      row: Number(el.getAttribute("data-row")),
      symbol: el.getAttribute("data-symbol"),
      win: el.getAttribute("data-win") === "true",
    })),
  );
  expect(cells).toHaveLength(15);
  const grid: SymbolId[][] = Array.from({ length: 5 }, () => Array<SymbolId>(3));
  for (const c of cells) {
    expect(c.symbol, `slot-cell ${c.reel}/${c.row} has data-symbol`).not.toBeNull();
    grid[c.reel][c.row] = c.symbol as SymbolId;
  }
  const { wins, totalTenths } = evaluateLines(grid);
  expect(payout).toBe(Math.floor((bet * totalTenths) / 10));

  const expectedWin = new Set(wins.flatMap((w) => w.cells.map(([reel, row]) => `${reel}-${row}`)));
  const actualWin = new Set(cells.filter((c) => c.win).map((c) => `${c.reel}-${c.row}`));
  expect([...actualWin].sort()).toEqual([...expectedWin].sort());
});

// ---------------------------------------------------------------------------------------------
// Wheel

test("wheel: one spin lands on the segment under the pointer and pays its multiplier", async ({ page }) => {
  await gotoGame(page, "/wheel");
  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));

  const i = Number(await page.getByTestId("result").getAttribute("data-outcome"));
  const wheel = page.getByTestId("wheel");
  expect(Number(await wheel.getAttribute("data-segment-index"))).toBe(i);
  expect(segmentAtPointer(Number(await wheel.getAttribute("data-rotation")), 40)).toBe(i);
  expect(payout).toBe(Math.floor((bet * WHEEL_SEGMENTS_X10[i]) / 10));
});

// ---------------------------------------------------------------------------------------------
// Scratch

async function readScratchCells(page: Page) {
  const cells = page.getByTestId("scratch-cell");
  await expect(cells).toHaveCount(9);
  await expect(page.locator('[data-testid="scratch-cell"][data-symbol]')).toHaveCount(9);
  return cells.evaluateAll((els) =>
    els.map((el) => ({
      index: Number(el.getAttribute("data-index")),
      symbol: el.getAttribute("data-symbol") as string,
      win: el.getAttribute("data-win") === "true",
    })),
  );
}

async function assertScratchSettled(page: Page, bet: number, payout: number): Promise<void> {
  const cells = await readScratchCells(page);
  const bySymbol = new Map<string, number[]>();
  for (const c of cells) bySymbol.set(c.symbol, [...(bySymbol.get(c.symbol) ?? []), c.index]);
  const triple = [...bySymbol.entries()].find(([, idx]) => idx.length === 3);
  const winning = cells.filter((c) => c.win).map((c) => c.index).sort((a, b) => a - b);
  if (triple) {
    const [symbol, idx] = triple;
    expect(payout).toBe(Math.floor((bet * SCRATCH_PRIZES_X100[symbol as ScratchSymbol]) / 100));
    expect(winning).toEqual([...idx].sort((a, b) => a - b));
  } else {
    expect(payout).toBe(0);
    expect(winning).toEqual([]);
  }
  await expect(page.getByTestId("scratch-buy")).toBeEnabled({ timeout: 2000 });
}

/** Triple-click Buy: exactly one deduction, Buy and Reveal state while the card is covered. */
async function buyCard(page: Page): Promise<void> {
  const before = await readBalance(page);
  const buy = page.getByTestId("scratch-buy");
  await buy.click({ clickCount: 3 });
  await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(before - BET));
  await expect(buy).toBeDisabled();
  await expect(page.getByTestId("scratch-reveal")).toBeEnabled();
  await expect(page.locator('[data-testid="scratch-cell"][data-symbol]')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(before - BET));
}

/** Scrolls the foil canvas to the middle of the viewport (clear of the sticky navbar) and returns its box. */
async function canvasBox(page: Page) {
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** Zig-zag points: 12 rows × 11 points across the canvas. */
function zigZag(box: { x: number; y: number; width: number; height: number }): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let row = 0; row < 12; row++) {
    for (let i = 0; i <= 10; i++) {
      points.push({ x: box.x + (i / 10) * box.width, y: box.y + ((row + 0.5) / 12) * box.height });
    }
  }
  return points;
}

test("scratch: Buy once, then scratch the foil (mouse or touch) until auto-reveal, and Reveal all", async ({ page, isMobile }) => {
  await gotoGame(page, "/scratch");
  await expect(page.getByTestId("scratch-reveal")).toBeDisabled();

  if (!isMobile) {
    // Desktop: real mouse drag across the canvas until the 55% auto-reveal settles the round.
    const first = await playOnce(page, async () => {
      await buyCard(page);
      const box = await canvasBox(page);
      await page.mouse.move(box.x + 4, box.y + 4);
      await page.mouse.down();
      for (const p of zigZag(box)) await page.mouse.move(p.x, p.y, { steps: 2 });
      await page.mouse.up();
    });
    await assertScratchSettled(page, first.bet, first.payout);

    // Second card: Reveal all.
    const second = await playOnce(page, async () => {
      await buyCard(page);
      await page.getByTestId("scratch-reveal").click();
    });
    await assertScratchSettled(page, second.bet, second.payout);
  } else {
    // Mobile: Reveal all on the first card.
    const first = await playOnce(page, async () => {
      await buyCard(page);
      await page.getByTestId("scratch-reveal").click();
    });
    await assertScratchSettled(page, first.bet, first.payout);

    // Second card: real touch events through CDP (page.touchscreen only supports tap()).
    const second = await playOnce(page, async () => {
      await buyCard(page);
      const box = await canvasBox(page);
      const cdp = await page.context().newCDPSession(page);
      let last = { x: box.x + 4, y: box.y + 4 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [last] });
      for (const p of zigZag(box)) {
        // Two interpolated steps per point, like mouse.move(..., { steps: 2 }).
        const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [mid] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
        last = p;
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    });
    await assertScratchSettled(page, second.bet, second.payout);
  }
});

// ---------------------------------------------------------------------------------------------
// Dice

test("dice: 50 / under shows 50% and 1.98x, one roll pays per the rolled value", async ({ page }) => {
  await gotoGame(page, "/dice");
  await expect(page.getByTestId("dice-chance")).toHaveText("50%");
  await expect(page.getByTestId("dice-multiplier")).toHaveText("1.98x");

  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));
  const roll = Number(await page.getByTestId("result").getAttribute("data-outcome"));
  expect(Number.isInteger(roll) && roll >= 0 && roll <= 9999).toBe(true);
  await expect(page.getByTestId("dice-roll")).toHaveText((roll / 100).toFixed(2));
  const won = roll < 5000;
  await expectKind(page, won);
  expect(payout).toBe(won ? Math.floor((bet * 19800) / 10000) : 0);
});

// ---------------------------------------------------------------------------------------------
// Coin flip

test("coinflip: one flip (Heads) lands on the reported face and pays 1.98x on heads", async ({ page }) => {
  await gotoGame(page, "/coinflip");
  await expect(page.getByTestId("pick-heads")).toHaveAttribute("aria-pressed", "true");

  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));
  const outcome = await page.getByTestId("result").getAttribute("data-outcome");
  expect(outcome === "heads" || outcome === "tails").toBe(true);
  await expect(page.getByTestId("coin")).toHaveAttribute("data-face", outcome!);
  expect(payout).toBe(outcome === "heads" ? Math.floor((bet * 198) / 100) : 0);
});

// ---------------------------------------------------------------------------------------------
// Limbo

test("limbo: target 2.00x, one launch shows the exact result and wins iff it reaches the target", async ({ page }) => {
  await gotoGame(page, "/limbo");
  await expect(page.getByTestId("limbo-target")).toHaveValue("2.00");

  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));
  const h = Number(await page.getByTestId("result").getAttribute("data-outcome"));
  expect(Number.isInteger(h) && h >= 100).toBe(true);
  await expect(page.getByTestId("limbo-result")).toHaveText(formatMultiplier(h, 100));
  const won = h >= 200;
  await expectKind(page, won);
  expect(payout).toBe(won ? Math.floor((bet * 200) / 100) : 0);
});

// ---------------------------------------------------------------------------------------------
// Keno

test("keno: Quick pick then one draw, 10 numbers drawn, payout from the paytable", async ({ page }) => {
  await gotoGame(page, "/keno");
  await page.getByRole("button", { name: "Quick pick" }).click();
  await expect(page.locator('[data-testid="keno-cell"][data-state="picked"]')).toHaveCount(10);

  const { bet, payout } = await playOnce(page, tripleClick(page.getByTestId("play-button")));
  const states = await page.getByTestId("keno-cell").evaluateAll((els) => els.map((el) => el.getAttribute("data-state")));
  expect(states).toHaveLength(40);
  expect(states.filter((s) => s === "hit" || s === "drawn")).toHaveLength(10);
  const hits = states.filter((s) => s === "hit").length;
  const picks = states.filter((s) => s === "hit" || s === "miss").length;
  expect(picks).toBe(10);
  expect(states.filter((s) => s === "picked")).toHaveLength(0);
  expect(payout).toBe(Math.floor((bet * KENO_PAYTABLE[picks as KenoPicks][hits]) / 100));
});

// ---------------------------------------------------------------------------------------------
// Mines

async function historySums(page: Page): Promise<{ count: number; bet: number; payout: number }> {
  const items = await page.getByTestId("history-item").evaluateAll((els) =>
    els.map((el) => ({ bet: Number(el.getAttribute("data-bet-cents")), payout: Number(el.getAttribute("data-payout-cents")) })),
  );
  return {
    count: items.length,
    bet: items.reduce((s, i) => s + i.bet, 0),
    payout: items.reduce((s, i) => s + i.payout, 0),
  };
}

test("mines: 1 mine, Start once, reveal a gem (retry on bust), Cash out once", async ({ page }) => {
  await gotoGame(page, "/mines");
  const phase = page.getByTestId("mines-phase");
  const primary = page.getByTestId("play-button");
  await page.getByRole("group", { name: "Quick mine count" }).getByRole("button", { name: "1", exact: true }).click();

  const balanceStart = await readBalance(page);
  let attempts = 0;
  let gem = false;
  while (!gem && attempts < 5) {
    attempts++;
    await expect(primary).toHaveText("Start");
    await expect(primary).toBeEnabled({ timeout: 2000 }); // after a bust, the 500 ms cooldown ends
    const before = await readBalance(page);
    await primary.click({ clickCount: 3 });
    await expect(phase).toHaveAttribute("data-phase", "playing");
    await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(before - BET));
    await expect(primary).toBeDisabled(); // Cash out needs at least one gem

    const tile = page.locator('[data-testid="mine-tile"][data-state="hidden"]').first();
    await tile.click();
    await expect(phase).toHaveAttribute("data-phase", /^(playing|busted)$/);
    gem = (await phase.getAttribute("data-phase")) === "playing";
    if (!gem) {
      await expect(page.getByTestId("history-item")).toHaveCount(attempts);
      await expect(page.getByTestId("result")).toHaveAttribute("data-kind", "loss");
    }
  }
  expect(gem, "revealed a gem within 5 attempts").toBe(true);

  await expect(primary).toBeEnabled();
  await expect(primary).toHaveText(/^Cash out /);
  const beforeCash = await readBalance(page);
  await primary.click({ clickCount: 3 });
  await expect(phase).toHaveAttribute("data-phase", "cashed");
  await expect(page.getByTestId("history-item")).toHaveCount(attempts);
  // The end-of-round cooldown keeps the re-labelled Start disabled, so no new bet is taken.
  await expect(primary).toHaveText("Start");
  await expect(primary).toBeDisabled();
  await page.waitForTimeout(1000);
  await expect(phase).toHaveAttribute("data-phase", "cashed");
  await expect(page.getByTestId("history-item")).toHaveCount(attempts);

  const sums = await historySums(page);
  expect(sums.count).toBe(attempts);
  expect(sums.bet).toBe(BET * attempts);
  const after = await readBalance(page);
  expect(after).toBe(balanceStart - sums.bet + sums.payout);
  const lastPayout = Number(await page.getByTestId("result").getAttribute("data-payout-cents"));
  expect(lastPayout).toBe(Math.floor((BET * 103) / 100)); // 1 mine, 1 gem = 1.03x
  expect(after).toBe(beforeCash + lastPayout);
});

test("mines: Max bet → Start → gem → Cash out is enabled and credits once (Finding 1)", async ({ page }) => {
  await gotoGame(page, "/mines");
  const phase = page.getByTestId("mines-phase");
  const primary = page.getByTestId("play-button");
  const input = page.getByTestId("bet-input");
  const max = page.getByRole("button", { name: "Set bet to maximum" });

  let attempts = 0;
  let gem = false;
  let balanceBeforeStart = 0;
  let betCents = 0;
  while (!gem && attempts < 5) {
    attempts++;
    if ((await readBalance(page)) === 0) {
      await page.getByRole("button", { name: "Top up 1,000 demo credits" }).click();
      await expect(balanceLocator(page)).toHaveAttribute("data-cents", "100000");
    }
    await expect(primary).toHaveText("Start");
    await max.click();
    balanceBeforeStart = await readBalance(page);
    betCents = balanceBeforeStart;
    await expect(input).toHaveValue(`${Math.floor(betCents / 100)}.${String(betCents % 100).padStart(2, "0")}`);
    await expect(primary).toBeEnabled({ timeout: 2000 });
    await primary.click();
    await expect(phase).toHaveAttribute("data-phase", "playing");
    await expect(balanceLocator(page)).toHaveAttribute("data-cents", "0");

    await page.locator('[data-testid="mine-tile"][data-state="hidden"]').first().click();
    await expect(phase).toHaveAttribute("data-phase", /^(playing|busted)$/);
    gem = (await phase.getAttribute("data-phase")) === "playing";
  }
  expect(gem, "revealed a gem within 5 attempts").toBe(true);

  // The bet input now exceeds the (zero) balance, but Cash out must not depend on bet validity.
  await expect(primary).toHaveText(/^Cash out /);
  await expect(primary).toBeEnabled();
  await primary.click();
  await expect(phase).toHaveAttribute("data-phase", "cashed");

  const result = page.getByTestId("result");
  await expect(result).toHaveAttribute("data-kind", "win");
  expect(Number(await result.getAttribute("data-bet-cents"))).toBe(betCents);
  const payout = Number(await result.getAttribute("data-payout-cents"));
  expect(payout).toBeGreaterThan(betCents);
  await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(balanceBeforeStart - betCents + payout));
});

// ---------------------------------------------------------------------------------------------
// Plinko

test("plinko: 3 quick drops land in 3 buckets and each pays its bucket multiplier", async ({ page }) => {
  await gotoGame(page, "/plinko");
  const buckets = page.getByTestId("plinko-bucket");
  await expect(buckets).toHaveCount(13);
  const readCounts = () => buckets.evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-hit-count"))));
  const countsBefore = await readCounts();
  const balanceBefore = await readBalance(page);

  const drop = page.getByTestId("play-button");
  await drop.click();
  await drop.click();
  await drop.click();
  await expect(page.getByTestId("history-item")).toHaveCount(3, { timeout: 10_000 });
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("history-item")).toHaveCount(3);

  const sums = await historySums(page);
  expect(sums.bet).toBe(3 * BET);
  await expect(balanceLocator(page)).toHaveAttribute("data-cents", String(balanceBefore - sums.bet + sums.payout));

  const countsAfter = await readCounts();
  const deltas = countsAfter.map((c, i) => c - countsBefore[i]);
  expect(deltas.every((d) => d >= 0)).toBe(true);
  expect(deltas.reduce((s, d) => s + d, 0)).toBe(3);

  const table = PLINKO_X10[12].medium;
  const increased = deltas.map((d, k) => (d > 0 ? k : -1)).filter((k) => k >= 0);
  const payouts = await page
    .getByTestId("history-item")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-payout-cents"))));
  for (const p of payouts) {
    const match = increased.some((k) => Math.floor((BET * table[k]) / 10) === p);
    expect(match, `payout ${p} matches a bucket whose count increased (${increased.join(",")})`).toBe(true);
  }
});

// ---------------------------------------------------------------------------------------------
// Satta Matka

test("satta-matka: Single / Open / 5, one draw settles a valid result and adds one chart row", async ({ page }) => {
  await gotoGame(page, "/satta-matka");
  await expect(page.getByText("Loading chart…")).toHaveCount(0);
  const rows = page.getByTestId("matka-chart-row");
  const rowsBefore = await rows.count();

  await page.getByTestId("matka-type-single").click();
  await page.getByTestId("matka-side-open").click();
  await page.getByTestId("matka-digit-5").click();
  const result = page.getByTestId("matka-result");
  await expect(result).toHaveAttribute("data-settled", "false");
  await expect(result).toHaveText("???-??-???");

  await playOnce(page, tripleClick(page.getByTestId("play-button")));
  await expect(result).toHaveAttribute("data-settled", "true");
  const text = (await result.textContent())?.trim() ?? "";
  expect(text).toMatch(/^\d{3}-\d{2}-\d{3}$/);
  const [open, jodi, close] = text.split("-");
  expect(jodi).toBe(`${ankOf(open)}${ankOf(close)}`);
  await expect(rows).toHaveCount(rowsBefore + 1);
});
