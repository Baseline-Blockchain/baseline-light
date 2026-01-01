import { webcrypto } from "node:crypto";
import { Buffer } from "buffer";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as unknown as Crypto;
}

if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

if (!(globalThis as any).process) {
  (globalThis as any).process = { env: {} };
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

if (!(globalThis as any).localStorage) {
  (globalThis as any).localStorage = new MemoryStorage();
}
