import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    latestTableAudio?: { context: AudioContext; analyser: AnalyserNode };
  }
}

test("both tables produce audio and muting during a spin persists across tables and reloads", async ({ page }) => {
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
  const peak = () => page.evaluate(() => {
    const audio = window.latestTableAudio;
    if (audio?.context.state !== "running") return 0;
    const samples = new Float32Array(audio.analyser.fftSize);
    audio.analyser.getFloatTimeDomainData(samples);
    return samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  });
  const sound = page.getByRole("button", { name: "Sound", exact: true });

  await page.goto("/teen-patti");
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  expect(await audioState()).toBeUndefined();
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect.poll(peak, { intervals: [20, 30, 50] }).toBeGreaterThan(0.005);

  await page.getByRole("link", { name: "Lobby", exact: true }).click();
  await expect.poll(audioState).toBe("closed");
  await page.getByRole("link", { name: /roulette/i }).click();
  await page.getByRole("button", { name: "Spin wheel" }).click();
  await expect.poll(peak).toBeGreaterThan(0.005);
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
