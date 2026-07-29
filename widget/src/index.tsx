import { createRoot } from "react-dom/client";

import { App } from "./App";
import { resolveApiBase } from "./config";
import { WIDGET_CSS } from "./styles";
import { StripeElementsPoc } from "./stripe-poc";

const HOST_ID = "dieselgeeks-chat-host";

/**
 * Dev-only diagnostic gate — see stripe-poc.tsx for what this tests and why.
 * Never enabled by default; requires an explicit `?dgStripePoc=1` on the URL.
 */
function shouldShowStripePoc(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("dgStripePoc") === "1";
  } catch {
    return false;
  }
}

function mountWidget(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const apiBase = resolveApiBase();
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<App apiBase={apiBase} />);

  // Mounted into the same shadow root as the real widget so it exercises the
  // exact DOM isolation the real payment step will run inside.
  if (shouldShowStripePoc()) {
    const pocMountPoint = document.createElement("div");
    shadow.appendChild(pocMountPoint);
    createRoot(pocMountPoint).render(<StripeElementsPoc />);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
} else {
  mountWidget();
}
