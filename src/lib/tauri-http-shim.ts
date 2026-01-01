// Browser shim so Vite dev doesn't fail when Tauri API isn't present.
// This is never used in the app because we only import the real module when running inside Tauri.

export enum ResponseType {
  JSON = 1,
}

export const Body = {
  json: (payload: unknown) => payload,
};

export async function fetch() {
  throw new Error("Tauri HTTP unavailable in browser");
}
