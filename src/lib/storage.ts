// localStorage wrapper. Touches window only inside these functions, only when called.

let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn("[gamess] localStorage unavailable; progress will not persist");
}

export function safeRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    warnOnce();
    return null;
  }
}

export function safeWrite(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    warnOnce();
    return false;
  }
}
