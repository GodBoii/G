import { test as base, expect, type Page } from "@playwright/test";
import { WALLET_KEY } from "../src/lib/walletStore";

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

async function balanceCents(page: Page): Promise<number> {
  const balance = page.locator("[data-testid=balance][data-cents]");
  await expect(balance).toBeVisible();
  return Number(await balance.getAttribute("data-cents"));
}

async function expectBalance(page: Page, cents: number): Promise<void> {
  await expect(page.getByTestId("balance")).toHaveAttribute("data-cents", String(cents));
}

test("a fresh context starts with 1,000.00 demo credits", async ({ page }) => {
  await page.goto("/");
  await expectBalance(page, 100_000);
  await expect(page.getByTestId("balance")).toContainText("1,000.00");
});

test("the balance survives a reload after a coin flip", async ({ page }) => {
  await page.goto("/coinflip");
  const before = await balanceCents(page);
  const result = page.getByTestId("result");
  await page.getByTestId("play-button").click();
  await expect(result).toHaveAttribute("data-round", "1", { timeout: 10_000 });
  const bet = Number(await result.getAttribute("data-bet-cents"));
  const payout = Number(await result.getAttribute("data-payout-cents"));
  const after = before - bet + payout;
  expect(after).not.toBe(before); // coin flip either pays 1.98x or nothing
  await expectBalance(page, after);

  await page.reload();
  await expectBalance(page, after);
  expect(await page.evaluate((key) => localStorage.getItem(key), WALLET_KEY)).toBe(JSON.stringify({ v: 1, cents: after }));
});

test("Reset restores 1,000.00 and Top up adds 1,000.00", async ({ page }) => {
  await page.goto("/");
  await balanceCents(page);
  const topUp = page.getByRole("button", { name: "Top up 1,000 demo credits" });
  const reset = page.getByRole("button", { name: "Reset balance to 1,000" });

  await topUp.click();
  await expectBalance(page, 200_000);
  await topUp.click();
  await expectBalance(page, 300_000);
  await reset.click();
  await expectBalance(page, 100_000);
  await topUp.click();
  await expectBalance(page, 200_000);

  await page.reload();
  await expectBalance(page, 200_000);
});

for (const raw of ["abc", '{"v":1,"cents":-5}']) {
  test(`corrupt storage ${raw} falls back to 1,000.00 without errors`, async ({ page }) => {
    await page.goto("/");
    await balanceCents(page);
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [WALLET_KEY, raw] as const);
    await page.reload();
    await expectBalance(page, 100_000);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test.describe("bet validation", () => {
  const cases: readonly { text: string; error: string }[] = [
    { text: "", error: "Enter a bet amount" },
    { text: "0", error: "Minimum bet is 1.00" },
    { text: "-1", error: "Bet must be a positive number" },
    { text: "abc", error: "Bet must be a positive number" },
    { text: "1000.01", error: "Bet exceeds your balance" },
  ];

  test("invalid bets disable Play and show an inline error linked by aria-describedby", async ({ page }) => {
    await page.goto("/coinflip");
    await balanceCents(page);
    const input = page.getByTestId("bet-input");
    const play = page.getByTestId("play-button");
    await expect(play).toBeEnabled();

    for (const c of cases) {
      await input.fill(c.text);
      await expect(play, `play disabled for "${c.text}"`).toBeDisabled();
      const alert = page.getByRole("alert").filter({ hasText: c.error });
      await expect(alert).toBeVisible();
      const alertId = await alert.getAttribute("id");
      expect(alertId).toBeTruthy();
      const describedBy = (await input.getAttribute("aria-describedby")) ?? "";
      expect(describedBy.split(/\s+/)).toContain(alertId);
      await expect(input).toHaveAttribute("aria-invalid", "true");
    }

    await input.fill("10.00");
    await expect(play).toBeEnabled();
    // (Next.js renders an always-present, empty role="alert" route announcer; only bet errors count here.)
    for (const c of cases) await expect(page.getByRole("alert").filter({ hasText: c.error })).toHaveCount(0);
    await expect(input).not.toHaveAttribute("aria-describedby", /.+/);
    await expect(input).not.toHaveAttribute("aria-invalid", /.+/);
  });

  test("½, 2x and Max follow FR-4.5 (min floor, balance cap, max = balance)", async ({ page }) => {
    await page.goto("/coinflip");
    await balanceCents(page);
    const input = page.getByTestId("bet-input");
    const half = page.getByRole("button", { name: "Halve bet" });
    const double = page.getByRole("button", { name: "Double bet" });
    const max = page.getByRole("button", { name: "Set bet to maximum" });

    await expect(input).toHaveValue("10.00");
    await half.click();
    await expect(input).toHaveValue("5.00");
    await input.fill("1.50");
    await half.click();
    await expect(input).toHaveValue("1.00"); // never below the 1.00 minimum
    await half.click();
    await expect(input).toHaveValue("1.00");

    await input.fill("10.00");
    await double.click();
    await expect(input).toHaveValue("20.00");
    await input.fill("600.00");
    await double.click();
    await expect(input).toHaveValue("1000.00"); // capped at the balance

    await input.fill("12.34");
    await max.click();
    await expect(input).toHaveValue("1000.00");
    await expect(page.getByTestId("play-button")).toBeEnabled();

    await page.getByRole("button", { name: "Top up 1,000 demo credits" }).click();
    await expectBalance(page, 200_000);
    await max.click();
    await expect(input).toHaveValue("2000.00");
  });
});
