import { describe, it, expect, vi } from "vitest";
import {
  MATKA_KEY,
  createMatkaHistoryStore,
  sanitizeMatkaHistory,
  type MatkaChartItem,
} from "../src/lib/matkaHistoryStore";

function makeStore() {
  const persisted: (readonly MatkaChartItem[])[] = [];
  const store = createMatkaHistoryStore((items) => persisted.push(items));
  return { store, persisted };
}

const raw = (items: unknown, v: unknown = 1) => JSON.stringify({ v, items });
const item = (n: number, open = "137", close = "250", at = 1_759_000_000_000) => ({ n, open, close, at });

describe("MATKA_KEY", () => {
  it("is versioned", () => {
    expect(MATKA_KEY).toBe("gamess:matka-history:v1");
  });
});

describe("sanitize", () => {
  it("accepts a valid chart", () => {
    const items = [item(2), item(1, "000", "127")];
    expect(sanitizeMatkaHistory(raw(items))).toEqual(items);
  });

  it.each([
    ["null", null],
    ["non-JSON", "abc"],
    ["bad version", raw([item(1)], 2)],
    ["missing version", JSON.stringify({ items: [item(1)] })],
    ["items not an array", raw({})],
    ["non-canonical panna", raw([item(1, "721", "250")])],
    ["2-digit panna", raw([item(1, "13", "250")])],
    ["n zero", raw([item(0)])],
    ["n float", raw([item(1.5)])],
    ["at not finite", JSON.stringify({ v: 1, items: [{ n: 1, open: "137", close: "250", at: "x" }] })],
    ["item null", raw([null])],
    [">30 items", raw(Array.from({ length: 31 }, (_, i) => item(31 - i)))],
  ])("%s → []", (_label, input) => {
    expect(sanitizeMatkaHistory(input)).toEqual([]);
    const { store, persisted } = makeStore();
    store.hydrate(input);
    expect(store.getSnapshot()).toEqual([]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toEqual([]);
  });

  it("accepts exactly 30 items", () => {
    expect(sanitizeMatkaHistory(raw(Array.from({ length: 30 }, (_, i) => item(30 - i))))).toHaveLength(30);
  });
});

describe("store", () => {
  it("snapshot is null until hydrated; hydrate is idempotent", () => {
    const { store, persisted } = makeStore();
    expect(store.getSnapshot()).toBeNull();
    store.hydrate(raw([item(1)]));
    store.hydrate(raw([item(5), item(4)]));
    expect(store.getSnapshot()).toEqual([item(1)]);
    expect(persisted).toHaveLength(1);
  });

  it("getSnapshot returns the same reference until a mutation; mutations replace a frozen array", () => {
    const { store } = makeStore();
    store.hydrate(null);
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    expect(Object.isFrozen(a)).toBe(true);
    store.append({ open: "137", close: "250", at: 1 });
    const b = store.getSnapshot();
    expect(b).not.toBe(a);
    expect(store.getSnapshot()).toBe(b);
    expect(Object.isFrozen(b)).toBe(true);
    expect(a).toEqual([]);
    store.clear();
    const c = store.getSnapshot();
    expect(c).not.toBe(b);
    expect(Object.isFrozen(c)).toBe(true);
    expect(b).toHaveLength(1);
  });

  it("append numbers draws, prepends, trims to 30, emits, and persists", () => {
    const { store, persisted } = makeStore();
    store.hydrate(raw([item(7)]));
    const listener = vi.fn();
    store.subscribe(listener);
    store.append({ open: "127", close: "000", at: 2 });
    expect(store.getSnapshot()![0]).toEqual({ n: 8, open: "127", close: "000", at: 2 });
    expect(store.getSnapshot()![1].n).toBe(7);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted[persisted.length - 1]).toBe(store.getSnapshot());

    for (let i = 0; i < 40; i++) store.append({ open: "137", close: "250", at: 100 + i });
    const snap = store.getSnapshot()!;
    expect(snap).toHaveLength(30);
    expect(snap[0].n).toBe(48);
    expect(snap[29].n).toBe(19);
    expect(snap[0].at).toBe(139);
  });

  it("numbers from 1 on an empty chart", () => {
    const { store } = makeStore();
    store.hydrate(null);
    store.append({ open: "137", close: "250", at: 5 });
    expect(store.getSnapshot()).toEqual([{ n: 1, open: "137", close: "250", at: 5 }]);
  });

  it("append before hydration is ignored", () => {
    const { store, persisted } = makeStore();
    store.append({ open: "137", close: "250", at: 1 });
    expect(store.getSnapshot()).toBeNull();
    expect(persisted).toHaveLength(0);
    store.hydrate(null);
    expect(store.getSnapshot()).toEqual([]);
  });

  it("clear empties, emits, and persists", () => {
    const { store, persisted } = makeStore();
    store.hydrate(raw([item(2), item(1)]));
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted[persisted.length - 1]).toEqual([]);
    unsub();
    store.append({ open: "137", close: "250", at: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()![0].n).toBe(1);
  });
});
