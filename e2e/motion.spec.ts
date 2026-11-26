import { expect, test } from "@playwright/test";
import { setDraws } from "./draws";

test("the wheel and ball visibly move before reporting the selected pocket", async ({ page }) => {
  await setDraws(page, [1]);
  await page.goto("/roulette");
  const wheel = page.locator(".wheel-plane");
  const rotor = wheel.locator(".wheel-rotor");
  const orbit = wheel.locator(".ball-orbit");
  await expect(wheel).toHaveCSS("transform-style", "preserve-3d");
  const firstRotor = await rotor.evaluate((node) => getComputedStyle(node).transform);
  const firstOrbit = await orbit.evaluate((node) => getComputedStyle(node).transform);
  await page.getByRole("button", { name: "Spin wheel" }).click();
  await expect.poll(() => rotor.evaluate((node) => getComputedStyle(node).transform)).not.toBe(firstRotor);
  await expect.poll(() => orbit.evaluate((node) => getComputedStyle(node).transform)).not.toBe(firstOrbit);
  await expect(page.getByRole("status")).toContainText("red 32");
});

test("reduced motion pauses the lobby and runs a keyboard spin without animating", async ({ page }) => {
  await setDraws(page, [0]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".lobby-card-fan")).toHaveCSS("animation-name", "none");
  const roulette = page.getByRole("link", { name: /roulette/i });
  await roulette.focus();
  await roulette.press("Enter");
  const zero = page.getByRole("button", { name: "Pick 0 green" });
  await zero.focus();
  await zero.press("Enter");
  await expect(zero).toHaveAttribute("aria-pressed", "true");
  const spin = page.getByRole("button", { name: "Spin wheel" });
  await spin.focus();
  await spin.press("Enter");
  await expect(page.getByRole("status")).toContainText("green 0");
  await expect(spin).toBeEnabled();
});
