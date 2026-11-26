import { expect, test } from "@playwright/test";

test("the lobby links to both tables and has no layout overflow", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your seat is at the table." })).toBeVisible();
  await expect(page.locator(".hero-image")).toHaveJSProperty("complete", true);
  const tables = page.getByRole("region", { name: "Pick your table" });
  await expect(tables.getByRole("link")).toHaveCount(2);
  await tables.getByRole("link", { name: /teen patti/i }).click();
  await expect(page.getByRole("heading", { name: "Teen Patti", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Arcade" }).getByRole("link", { name: "Teen Patti" }))
    .toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("navigation", { name: "Arcade" }).getByRole("link", { name: "Roulette" }).click();
  await expect(page.getByRole("heading", { name: "European roulette" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test("removed game routes show the new 404 and a working route to the lobby", async ({ page }) => {
  const response = await page.goto("/slots");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This table is closed." })).toBeVisible();
  await page.getByRole("link", { name: "Back to lobby" }).click();
  await expect(page).toHaveURL("/");
});
