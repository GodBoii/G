import { describe, it, expect, vi } from "vitest";
import { MAX_BALANCE, MAX_BET, START_BALANCE, TOP_UP_AMOUNT } from "../src/lib/money";
import { WALLET_KEY, createWalletStore, sanitizeStoredWallet } from "../src/lib/walletStore";
import { randomInt } from "../src/lib/rng";
import { seededRng } from "./helpers/fakeRng";

function makeStore() {
  const persisted: number[] = [];
  const store = createWalletStore((c) => persisted.push(c));
  return { store, persisted };
}

const enc = (cents: number) => JSON.stringify({ v: 1, cents });

describe("WALLET_KEY", () => {
  it("is versioned", () => {
    expect(WALLET_KEY).toBe("gamess:wallet:v1");
  });
});

describe("sanitize via hydrate", () => {
  it.each([
    [null, START_BALANCE],
    ["abc", START_BALANCE],
    ["-5", START_BALANCE],
    ["1e999", START_BALANCE],
    ['{"cents":-5}', START_BALANCE],
    ['{"v":1,"cents":-5}', START_BALANCE],
    ['{"v":1,"cents":12.5}', START_BALANCE],
    ['{"v":2,"cents":500}', START_BALANCE],
    ['{"v":1,"cents":"500"}', START_BALANCE],
    ["[1,2]", START_BALANCE],
    ["null", START_BALANCE],
    ['{"v":1}', START_BALANCE],
    [enc(MAX_BALANCE + 1), START_BALANCE],
    [enc(0), 0],
    [enc(123_456), 123_456],
    [enc(MAX_BALANCE), MAX_BALANCE],
  ])("%j → %d (and persisted)", (raw, expected) => {
    expect(sanitizeStoredWallet(raw)).toBe(expected);
    const { store, persisted } = makeStore();
    expect(store.getSnapshot()).toBeNull();
    store.hydrate(raw);
    expect(store.getSnapshot()).toBe(expected);
    expect(persisted).toEqual([expected]);
  });

  it("hydrate is idempotent and emits", () => {
    const { store, persisted } = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.hydrate(enc(5000));
    store.hydrate(enc(9999));
    expect(store.getSnapshot()).toBe(5000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual([5000]);
  });
});

describe("placeBet", () => {
  it("rejects before hydration", () => {
    const { store, persisted } = makeStore();
    expect(store.placeBet(100)).toBe(false);
    expect(store.getSnapshot()).toBeNull();
    expect(persisted).toEqual([]);
  });

  it("rejects invalid amounts and leaves the balance unchanged", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(1000));
    for (const bad of [1001, 99, 0, -100, 150.5, Number.NaN, MAX_BET + 1]) {
      expect(store.placeBet(bad)).toBe(false);
    }
    expect(store.getSnapshot()).toBe(1000);
    expect(persisted).toEqual([1000]);
  });

  it("rejects bets above MAX_BET even with a huge balance", () => {
    const { store } = makeStore();
    store.hydrate(enc(MAX_BALANCE));
    expect(store.placeBet(MAX_BET + 1)).toBe(false);
    expect(store.placeBet(MAX_BET)).toBe(true);
    expect(store.getSnapshot()).toBe(MAX_BALANCE - MAX_BET);
  });

  it("deducts synchronously, persists, and emits", () => {
    const { store, persisted } = makeStore();
    store.hydrate(null);
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    expect(store.placeBet(1000)).toBe(true);
    expect(store.getSnapshot()).toBe(START_BALANCE - 1000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual([START_BALANCE, START_BALANCE - 1000]);
    unsub();
    store.placeBet(1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("allows betting the whole balance", () => {
    const { store } = makeStore();
    store.hydrate(enc(500));
    expect(store.placeBet(500)).toBe(true);
    expect(store.getSnapshot()).toBe(0);
    expect(store.placeBet(100)).toBe(false);
  });
});

describe("credit", () => {
  it("adds, persists, and clamps to MAX_BALANCE", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(1000));
    store.credit(2500);
    expect(store.getSnapshot()).toBe(3500);
    store.credit(MAX_BALANCE);
    expect(store.getSnapshot()).toBe(MAX_BALANCE);
    expect(persisted).toEqual([1000, 3500, MAX_BALANCE]);
  });

  it("ignores invalid amounts (dev console.error)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, persisted } = makeStore();
    store.hydrate(enc(1000));
    store.credit(-5);
    store.credit(1.5);
    store.credit(Number.NaN);
    expect(store.getSnapshot()).toBe(1000);
    expect(persisted).toEqual([1000]);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});

describe("reset / topUp", () => {
  it("reset → START_BALANCE, topUp += TOP_UP_AMOUNT clamped", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(42));
    store.topUp();
    expect(store.getSnapshot()).toBe(42 + TOP_UP_AMOUNT);
    store.reset();
    expect(store.getSnapshot()).toBe(START_BALANCE);
    expect(persisted).toEqual([42, 42 + TOP_UP_AMOUNT, START_BALANCE]);

    const big = makeStore();
    big.store.hydrate(enc(MAX_BALANCE - 10));
    big.store.topUp();
    expect(big.store.getSnapshot()).toBe(MAX_BALANCE);
  });

  it("are no-ops before hydration", () => {
    const { store, persisted } = makeStore();
    store.reset();
    store.topUp();
    store.credit(500);
    expect(store.getSnapshot()).toBeNull();
    expect(persisted).toEqual([]);
  });
});

describe("adoptExternal", () => {
  it("valid raw → set + emit, no persist", () => {
    const { store, persisted } = makeStore();
    store.hydrate(null);
    const listener = vi.fn();
    store.subscribe(listener);
    store.adoptExternal(enc(777));
    expect(store.getSnapshot()).toBe(777);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual([START_BALANCE]);
  });

  it("garbage raw → START_BALANCE and persisted once", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(5));
    store.adoptExternal("garbage");
    expect(store.getSnapshot()).toBe(START_BALANCE);
    expect(persisted).toEqual([5, START_BALANCE]);
  });

  it("null raw (storage cleared) → START_BALANCE and persisted once", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(5));
    store.adoptExternal(null);
    expect(store.getSnapshot()).toBe(START_BALANCE);
    expect(persisted).toEqual([5, START_BALANCE]);
  });

  it("non-canonical encoding of a valid value is repaired", () => {
    const { store, persisted } = makeStore();
    store.hydrate(enc(5));
    store.adoptExternal('{"cents":900,"v":1}');
    expect(store.getSnapshot()).toBe(900);
    expect(persisted).toEqual([5, 900]);
  });
});

describe("invariants", () => {
  it("never goes negative or above MAX_BALANCE over 1,000 random operations", () => {
    const rng = seededRng(2024);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, persisted } = makeStore();
    store.hydrate(null);
    for (let i = 0; i < 1000; i++) {
      const op = randomInt(0, 4, rng);
      const amount = randomInt(-500, 300_000, rng);
      if (op === 0 || op === 1) store.placeBet(amount);
      else if (op === 2) store.credit(amount);
      else if (op === 3) store.topUp();
      else if (randomInt(0, 9, rng) === 0) store.reset();
      const c = store.getSnapshot();
      expect(c).not.toBeNull();
      expect(Number.isSafeInteger(c)).toBe(true);
      expect(c!).toBeGreaterThanOrEqual(0);
      expect(c!).toBeLessThanOrEqual(MAX_BALANCE);
      expect(persisted[persisted.length - 1]).toBe(c);
    }
    spy.mockRestore();
  });
});
