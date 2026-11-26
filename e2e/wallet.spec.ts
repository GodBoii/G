import { expect, test } from "@playwright/test";
import { setDraws } from "./draws";

test("virtual chip refills survive navigation and reload", async ({ page }) => {
  await page.goto("/");
  const balance = page.getByTestId("balance");
  await expect(balance).toHaveAttribute("data-cents", "100000");
  await page.getByRole("button", { name: "Add 1,000 virtual chips" }).click();
  await expect(balance).toHaveAttribute("data-cents", "200000");
  await page.getByRole("navigation", { name: "Arcade" }).getByRole("link", { name: "Roulette" }).click();
  await page.reload();
  await expect(balance).toHaveAttribute("data-cents", "200000");
});

test("a roulette win settles once when leaving an active spin", async ({ page }) => {
  await setDraws(page, [0]);
  await page.goto("/roulette");
  const balance = page.getByTestId("balance");
  await expect(balance).toHaveAttribute("data-cents", "100000");
  await page.getByRole("button", { name: "Bet on 0 green", exact: true }).click();
  await page.getByRole("button", { name: "Spin wheel" }).click();
  await expect(page.getByRole("button", { name: "Spinning…" })).toBeDisabled();
  await page.goto("/");
  await expect(balance).toHaveAttribute("data-cents", "135000");
  await page.reload();
  await expect(balance).toHaveAttribute("data-cents", "135000");
});

test("a reduced-motion round plays from the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/roulette");
  const red = page.getByRole("button", { name: "Bet on Red", exact: true });
  await red.focus();
  await expect(red).toBeFocused();
  await red.press("Enter");
  const spin = page.getByRole("button", { name: "Spin wheel" });
  await spin.focus();
  await spin.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "chips net" })).toBeVisible();
  await expect(spin).toBeEnabled();
});
