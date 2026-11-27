import { expect, test } from "@playwright/test";
import { setDraws } from "./draws";

declare global {
  interface Window {
    latestTableAudio?: { context: AudioContext; analyser: AnalyserNode };
  }
}

test("both tables produce audio and muting during a spin persists across tables and reloads", async ({ page }) => {
  await setDraws(page, [7, 0, 6, 0, 5, 0, 0, 6, 0, 5, 0, 4, 1]);
  await page.addInitScript(() => {
    window.AudioContext = class extends AudioContext {
      override createGain() {
        const gain = super.createGain();
        if (window.latestTableAudio?.context !== this) {
          const analyser = this.createAnalyser();
          gain.connect(analyser);
          window.latestTableAudio = { context: this, analyser };
        }
        return gain;
      }
    };
  });

  const audioState = () => page.evaluate(() => window.latestTableAudio?.context.state);
  const peak = (after = 0) => page.evaluate((after) => {
    const audio = window.latestTableAudio;
    if (audio?.context.state !== "running" || audio.context.currentTime < after) return 0;
    const samples = new Float32Array(audio.analyser.fftSize);
    audio.analyser.getFloatTimeDomainData(samples);
    return samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  }, after);
  const sound = page.getByRole("button", { name: "Sound", exact: true });

  await page.goto("/teen-patti");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  expect(await audioState()).toBeUndefined();
  for (const [deal, result] of [["Deal cards", "You win"], ["Deal again", "Dealer wins"]]) {
    await page.getByRole("button", { name: deal }).click();
    await expect.poll(peak, { intervals: [20, 30, 50] }).toBeGreaterThan(0.005);
    await page.getByRole("button", { name: "Show hands" }).click();
    await expect(page.getByRole("status")).toHaveText(result);
    await expect.poll(peak, { intervals: [20, 30, 50] }).toBeGreaterThan(0.005);
  }

  await page.getByRole("link", { name: "Lobby", exact: true }).click();
  await expect.poll(audioState).toBe("closed");
  await page.getByRole("link", { name: /roulette/i }).click();
  await page.getByRole("button", { name: "Spin wheel" }).click();
  await expect.poll(peak).toBeGreaterThan(0.005);
  await expect.poll(() => peak(2.58), { intervals: [15, 20, 25] }).toBeGreaterThan(0.065);
  await expect(page.getByRole("status")).toHaveText("Wheel spinning…");
  await sound.press("Space");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect.poll(audioState).toBe("closed");
  await expect(page.getByRole("status").getByText(/^(red|black|green) \d+$/)).toBeVisible();
  expect(await audioState()).toBe("closed");

  await page.getByRole("link", { name: "Lobby", exact: true }).click();
  await page.getByRole("link", { name: /teen patti/i }).click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.getByRole("button", { name: "Show hands" })).toBeEnabled();
  expect(await audioState()).toBeUndefined();
  await sound.press("Space");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect.poll(peak, { intervals: [20, 30, 50] }).toBeGreaterThan(0.005);
});
