export function resolveApiBase(): string {
  const globalConfig = (
    window as Window & { DIESELGEEKS_CHAT_API_URL?: string }
  ).DIESELGEEKS_CHAT_API_URL;
  if (globalConfig) {
    return globalConfig.replace(/\/$/, "");
  }

  const configured = document.querySelector<HTMLScriptElement>(
    'script[data-api-url][src*="dieselgeeks-chat"]',
  );

  const fromDataset = configured?.dataset.apiUrl?.trim();
  if (fromDataset) {
    return fromDataset.replace(/\/$/, "");
  }

  return window.location.origin.replace(/\/$/, "");
}

/**
 * Extra clearance (in px) to lift the launcher/panel above any fixed bottom
 * chrome the host site adds on mobile (e.g. an app-style bottom tab bar).
 * We can't detect that bar's height from the page, so this defaults to a
 * value that clears a typical mobile bottom nav and can be overridden per
 * site via `window.DIESELGEEKS_CHAT_MOBILE_BOTTOM_OFFSET` or a
 * `data-mobile-bottom-offset` attribute on the loader script tag.
 */
const DEFAULT_MOBILE_BOTTOM_OFFSET_PX = 64;

export function resolveMobileBottomOffsetPx(): number {
  const globalConfig = (
    window as Window & { DIESELGEEKS_CHAT_MOBILE_BOTTOM_OFFSET?: number }
  ).DIESELGEEKS_CHAT_MOBILE_BOTTOM_OFFSET;
  if (typeof globalConfig === "number" && Number.isFinite(globalConfig) && globalConfig >= 0) {
    return globalConfig;
  }

  const configured = document.querySelector<HTMLScriptElement>('script[src*="dieselgeeks-chat"]');
  const fromDataset = configured?.dataset.mobileBottomOffset?.trim();
  if (fromDataset) {
    const parsed = Number(fromDataset);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return DEFAULT_MOBILE_BOTTOM_OFFSET_PX;
}
