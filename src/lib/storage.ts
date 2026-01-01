const STORAGE_KEY = "baseline-light:wallet:v1";

export type EncryptedPayload = {
  iv: string;
  salt: string;
  data: string;
  iterations: number;
};

const DEFAULT_ITERATIONS = 200_000;

function requireCrypto(): Crypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error("WebCrypto API unavailable in this environment");
  }
  return cryptoObj;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const cryptoObj = requireCrypto();
  const material = await cryptoObj.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return cryptoObj.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    material,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayload(passphrase: string, payload: object): Promise<EncryptedPayload> {
  const cryptoObj = requireCrypto();
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS);
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await cryptoObj.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    iv: toBase64(iv),
    salt: toBase64(salt),
    data: toBase64(cipher),
    iterations: DEFAULT_ITERATIONS,
  };
}

export async function decryptPayload<T>(passphrase: string, encrypted: EncryptedPayload): Promise<T> {
  const cryptoObj = requireCrypto();
  const iv = fromBase64(encrypted.iv);
  const salt = fromBase64(encrypted.salt);
  const key = await deriveKey(passphrase, salt, encrypted.iterations || DEFAULT_ITERATIONS);
  const cipherBytes = fromBase64(encrypted.data);
  const plain = await cryptoObj.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  const decoded = new TextDecoder().decode(plain);
  return JSON.parse(decoded) as T;
}

export function persistEncryptedWallet(payload: EncryptedPayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadEncryptedWallet(): EncryptedPayload | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EncryptedPayload;
  } catch {
    return null;
  }
}

export function clearStoredWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}
