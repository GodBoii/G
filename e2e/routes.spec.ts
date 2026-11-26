import { expect, test } from "@playwright/test";

test("the headerless lobby opens both tables with no currency interface or overflow", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "House 37" })).toBeVisible();
  await expect(page.locator(".salon-backdrop img")).toHaveJSProperty("complete", true);
  const tables = page.locator(".lobby-tables");
  await expect(tables.getByRole("link")).toHaveCount(2);
  await expect(page.locator("header, aside")).toHaveCount(0);
  await tables.getByRole("link", { name: /teen patti/i }).click();
  await expect(page.getByRole("heading", { name: "Teen Patti", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Lobby", exact: true }).click();
  await tables.getByRole("link", { name: /roulette/i }).click();
  await expect(page.getByRole("heading", { name: "European roulette" })).toBeVisible();
  await expect(page.locator("header, aside")).toHaveCount(0);
  await expect(page.getByText(/balance|virtual chips|payout/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test("removed game routes show a working route to the lobby", async ({ page }) => {
  const response = await page.goto("/slots");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This table is closed." })).toBeVisible();
  await page.getByRole("link", { name: "Back to lobby" }).click();
  await expect(page).toHaveURL("/");
});
