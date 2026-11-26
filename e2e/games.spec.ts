import { expect, test } from "@playwright/test";
import { setDraws } from "./draws";

test("Teen Patti reveals a winning hand, then supports folding another hand", async ({ page }) => {
  await setDraws(page, [7, 0, 6, 0, 5, 0]);
  await page.goto("/teen-patti");
  const balance = page.getByTestId("balance");
  await expect(balance).toHaveAttribute("data-cents", "100000");
  await page.getByRole("button", { name: "25 chips" }).click();
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(balance).toHaveAttribute("data-cents", "97500");
  await page.getByRole("button", { name: "See cards" }).click();
  await expect(page.getByRole("img", { name: "Jack of spades" })).toBeVisible();
  await page.getByRole("button", { name: "Chaal" }).click();
  await expect(balance).toHaveAttribute("data-cents", "95000");
  await expect(page.getByRole("button", { name: "Raised" })).toBeDisabled();
  await page.getByRole("button", { name: "Show hands" }).click();
  await expect(page.getByRole("status").filter({ hasText: "You win" })).toBeVisible();
  await expect(balance).toHaveAttribute("data-cents", "105000");
  await page.getByRole("button", { name: "Deal again" }).click();
  await page.getByRole("button", { name: "Fold" }).click();
  await expect(page.getByRole("status").filter({ hasText: "You folded" })).toBeVisible();
  await expect(balance).toHaveAttribute("data-cents", "102500");
});

test("roulette stacks chips, allows undo, pays zero and retains the board", async ({ page }) => {
  await setDraws(page, [0]);
  await page.goto("/roulette");
  const spin = page.getByRole("button", { name: "Spin wheel" });
  const zero = page.getByRole("button", { name: /bet on 0 green/i });
  await expect(spin).toBeDisabled();
  await zero.click();
  await page.getByRole("button", { name: "Bet on Red", exact: true }).click();
  await zero.click();
  await page.getByRole("button", { name: "Undo chip" }).click();
  await expect(zero).toHaveAccessibleName("Bet on 0 green, 10.00 chips placed");
  await spin.click();
  await expect(page.getByRole("button", { name: "Spinning…" })).toBeDisabled();
  await expect(zero).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "green 0" })).toContainText("+340.00 chips net");
  await expect(page.getByTestId("balance")).toHaveAttribute("data-cents", "134000");
  await expect(zero).toHaveAttribute("data-hit", "true");
  await expect(zero).toHaveAccessibleName("Bet on 0 green, 10.00 chips placed");
  await page.getByRole("button", { name: "Clear bets" }).click();
  await expect(spin).toBeDisabled();
});
