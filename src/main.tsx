import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";

import App from "./App";
import "./styles/global.css";

// Polyfill Buffer/Process for bitcoinjs-lib in the browser.
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
if (!(globalThis as any).process) {
  (globalThis as any).process = { env: {} };
}

const updateSafeAreaInsets = () => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!viewport) {
    return;
  }

  const safeTop = Math.max(0, viewport.offsetTop);
  const safeBottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);

  root.style.setProperty("--safe-top-js", `${safeTop}px`);
  root.style.setProperty("--safe-bottom-js", `${safeBottom}px`);
};

updateSafeAreaInsets();
window.addEventListener("resize", updateSafeAreaInsets);
window.addEventListener("orientationchange", updateSafeAreaInsets);
window.visualViewport?.addEventListener("resize", updateSafeAreaInsets);
window.visualViewport?.addEventListener("scroll", updateSafeAreaInsets);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
