import { createRoot } from "react-dom/client";

import { App } from "./App";
import { HeroChat } from "./components/HeroChat";
import { resolveApiBase } from "./config";
import { WIDGET_CSS } from "./styles";
import { StripeElementsPoc } from "./stripe-poc";

const HOST_ID = "dieselgeeks-chat-host";

/**
 * Elementor page placeholder for the homepage hero chat — see HeroChat.tsx.
 * A page author drops an empty `<div id="dg-hero-chat">` where the old
 * slider used to be; we detect it here and mount the inline hero interface
 * into it instead of (not in addition to) the floating corner launcher, so a
 * page never shows two chat entry points at once.
 */
const HERO_MOUNT_ID = "dg-hero-chat";

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

function attachShadowStyles(host: Element): { shadow: ShadowRoot; mountPoint: HTMLDivElement } {
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  return { shadow, mountPoint };
}

function mountFloatingWidget(apiBase: string): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const { shadow, mountPoint } = attachShadowStyles(host);
  createRoot(mountPoint).render(<App apiBase={apiBase} />);

  // Mounted into the same shadow root as the real widget so it exercises the
  // exact DOM isolation the real payment step will run inside.
  if (shouldShowStripePoc()) {
    const pocMountPoint = document.createElement("div");
    shadow.appendChild(pocMountPoint);
    createRoot(pocMountPoint).render(<StripeElementsPoc />);
  }
}

function mountHeroChat(apiBase: string, heroHost: HTMLElement): void {
  if (heroHost.dataset.dgMounted === "1") {
    return;
  }
  heroHost.dataset.dgMounted = "1";

  const { mountPoint } = attachShadowStyles(heroHost);
  mountPoint.className = "dg-root";
  createRoot(mountPoint).render(<HeroChat apiBase={apiBase} logoUrl={`${apiBase}/dr-diesel-logo.png`} />);
}

function mountWidget(): void {
  const apiBase = resolveApiBase();
  const heroHost = document.getElementById(HERO_MOUNT_ID);

  if (heroHost) {
    mountHeroChat(apiBase, heroHost);
    return;
  }

  mountFloatingWidget(apiBase);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
} else {
  mountWidget();
}
