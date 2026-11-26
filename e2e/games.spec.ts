import { expect, test } from "@playwright/test";
import { setDraws } from "./draws";

test("Teen Patti deals six cards and supports peeking, showing and folding", async ({ page }) => {
  await setDraws(page, [7, 0, 6, 0, 5, 0]);
  await page.goto("/teen-patti");
  await page.getByRole("button", { name: "Deal cards" }).click();
  const dealtCards = page.getByRole("img", { name: "Face-down card" });
  await expect(dealtCards).toHaveCount(6);
  await expect(page.getByRole("img", { name: "Jack of spades" })).toHaveCount(0);
  await page.getByRole("button", { name: "See cards" }).click();
  await expect(page.getByRole("img", { name: "Jack of spades" })).toBeVisible();
  await expect(dealtCards).toHaveCount(3);
  await page.getByRole("button", { name: "Show hands" }).click();
  await expect(page.getByRole("status")).toHaveText("You win");
  await expect(dealtCards).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Recent hands" })).toContainText("Pure sequence");
  await page.getByRole("button", { name: "Deal again" }).click();
  await page.getByRole("button", { name: "Fold" }).click();
  await expect(page.getByRole("status")).toHaveText("You folded");
  await expect(page.getByRole("region", { name: "Recent hands" })).toContainText("Blind fold");
});

test("roulette previews, spins and shows which predictions matched", async ({ page }) => {
  await setDraws(page, [1, 0]);
  await page.goto("/roulette");
  const spin = page.getByRole("button", { name: "Spin wheel" });
  const number = page.getByRole("button", { name: "Pick 32 red" });
  const red = page.getByRole("button", { name: "Pick Red", exact: true });
  const odd = page.getByRole("button", { name: "Pick Odd", exact: true });
  await expect(spin).toBeEnabled();
  await number.click();
  await red.click();
  await odd.click();
  await expect(red).toHaveAttribute("aria-pressed", "true");
  await spin.click();
  await expect(page.getByRole("button", { name: "Spinning…" })).toBeDisabled();
  await expect(number).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("2 of 3 picks matched");
  await expect(page.getByRole("status")).toContainText("red 32");
  await expect(number).toHaveAttribute("data-hit", "true");
  await expect(red).toHaveAttribute("data-hit", "true");
  await expect(odd).not.toHaveAttribute("data-hit", "true");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(red).toHaveAttribute("aria-pressed", "false");
  await expect(spin).toBeEnabled();
});
