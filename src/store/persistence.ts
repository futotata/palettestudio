import { get, set } from 'idb-keyval';

export async function loadPersisted<T>(key: string): Promise<T | null> {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const val = await get<T>(key);
    return val ?? null;
  } catch {
    return null;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function savePersistedDebounced<T>(key: string, value: T, delayMs = 250): void {
  if (typeof indexedDB === 'undefined') return;
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  const handle = setTimeout(() => {
    timers.delete(key);
    set(key, value).catch(() => {
      // Ignore storage quota / private mode errors
    });
  }, delayMs);
  timers.set(key, handle);
}
