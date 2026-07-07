import { createRoot } from "react-dom/client";

import { App } from "./App";
import { resolveApiBase } from "./config";
import { WIDGET_CSS } from "./styles";

const HOST_ID = "dieselgeeks-chat-host";

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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
} else {
  mountWidget();
}
