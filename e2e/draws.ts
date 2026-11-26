import type { Page } from "@playwright/test";

export async function setDraws(page: Page, draws: number[]) {
  await page.addInitScript((values) => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = <T extends ArrayBufferView>(buffer: T): T => {
      if (buffer instanceof Uint32Array && buffer.length === 64) {
        buffer.fill(0);
        buffer.set(values);
        return buffer;
      }
      return getRandomValues(buffer);
    };
  }, draws);
}
