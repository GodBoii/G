import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { GAMES } from "../src/lib/games";

const HOME_H1 = `Play ${GAMES.length} arcade games with free demo credits`;
const FOOTER_TEXT = "Demo credits only. For entertainment. No real money.";
const SCREENSHOT_DIR = path.join(__dirname, "..", ".agents", "tasks", "gamess-site", "screenshots");

interface RouteCase {
  path: string;
  h1: string;
  slug: string;
}

const ROUTES: readonly RouteCase[] = [
  { path: "/", h1: HOME_H1, slug: "home" },
  ...GAMES.map((g) => ({ path: g.href, h1: g.name, slug: g.slug })),
];

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

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator("[data-testid=balance][data-cents]")).toBeVisible();
}

test.describe("raw server HTML", () => {
  for (const route of ROUTES) {
    test(`${route.path} has its h1 and the footer sentence without JavaScript`, async ({ request }) => {
      const res = await request.get(route.path);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const inner = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
      const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
      expect(text).toBe(route.h1);
      expect(html.match(/<h1[\s>]/g)?.length ?? 0).toBe(1);
      expect(html).toContain(FOOTER_TEXT);
    });
  }

  test("unknown route returns 404 with a link back to the lobby", async ({ request }) => {
    const res = await request.get("/does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain("Back to the lobby");
  });
});

test.describe("browser pass", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders cleanly, has no horizontal overflow, and links every game`, async ({ page }, testInfo) => {
      await page.goto(route.path);
      await waitForHydration(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.h1);
      await expect(page.locator("footer")).toContainText(FOOTER_TEXT);

      // Navbar links to all registered games (pill row on desktop, #mobile-nav grid on mobile).
      const navScope = testInfo.project.name === "mobile" ? "#mobile-nav" : 'header nav[aria-label="Games"]';
      for (const g of GAMES) {
        await expect(page.locator(`${navScope} a[href="${g.href}"]`)).toHaveCount(1);
      }

      const overflow = await page.evaluate(() => {
        const html = document.documentElement;
        const main = document.querySelector("main");
        return {
          html: { scroll: html.scrollWidth, client: html.clientWidth },
          main: main ? { scroll: main.scrollWidth, client: main.clientWidth } : null,
        };
      });
      expect(overflow.html.scroll, "html scrollWidth <= clientWidth").toBeLessThanOrEqual(overflow.html.client);
      expect(overflow.main, "<main> exists").not.toBeNull();
      expect(overflow.main!.scroll, "main scrollWidth <= clientWidth").toBeLessThanOrEqual(overflow.main!.client);

      // Let entry animations / fonts settle, then capture from the top.
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${testInfo.project.name}-${route.slug}.png`),
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});

test.describe("home", () => {
  test("lists all registered game cards with correct links and category tags", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    const cards = page.getByTestId("game-card");
    await expect(cards).toHaveCount(GAMES.length);
    const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs).toEqual(GAMES.map((g) => g.href));
    await expect(cards.filter({ hasText: "Instant Win" })).toHaveCount(GAMES.filter((game) => game.category === "Instant Win").length);
    await expect(cards.filter({ hasText: "Number Game" })).toHaveCount(GAMES.filter((game) => game.category === "Number Game").length);
  });
});

test.describe("mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "the menu toggle only exists below md");

  test("toggle opens and closes, Escape closes, link click closes, goBack leaves it closed", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    const toggle = page.locator('button[aria-controls="mobile-nav"]');
    const menu = page.locator("#mobile-nav");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await toggle.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await menu.locator('a[href="/dice"]').click();
    await expect(page).toHaveURL(/\/dice$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dice");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    // Open on /dice, then go back: the route change closes it.
    await toggle.click();
    await expect(menu).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
  });
});

test.describe("keyboard tab walk", () => {
  test.skip(({ isMobile }) => isMobile, "Tab walk runs in the desktop project");

  for (const route of ROUTES) {
    test(`${route.path}: every focusable control is reachable with Tab and shows a focus outline`, async ({ page }) => {
      await page.goto(route.path);
      await waitForHydration(page);

      const candidates = await page.evaluate(() => {
        const selector =
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        let i = 0;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          if (el.checkVisibility()) el.setAttribute("data-tab-i", String(i++));
        }
        (document.activeElement as HTMLElement | null)?.blur();
        document.body.focus();
        return i;
      });
      expect(candidates).toBeGreaterThan(0);

      const presses = Math.min(candidates + 5, 200);
      const seen = new Set<number>();
      const noOutline: string[] = [];
      for (let p = 0; p < presses; p++) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const idx = el.getAttribute("data-tab-i");
          if (idx === null) return null;
          return {
            idx: Number(idx),
            outline: getComputedStyle(el).outlineStyle,
            desc: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`,
          };
        });
        if (!state) continue;
        seen.add(state.idx);
        if (state.outline === "none") noOutline.push(state.desc);
      }

      const missing = Array.from({ length: candidates }, (_, i) => i).filter((i) => !seen.has(i));
      const missingDesc = await page.evaluate(
        (ids) =>
          ids.map((i) => {
            const el = document.querySelector(`[data-tab-i="${i}"]`);
            return el ? `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"` : String(i);
          }),
        missing,
      );
      expect(missingDesc, "candidates never reached by Tab").toEqual([]);
      expect(noOutline, "focused candidates without a visible outline").toEqual([]);
    });
  }
});
