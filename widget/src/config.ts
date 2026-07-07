export function resolveApiBase(): string {
  const globalConfig = (window as Window & { DIESELGEEKS_CHAT_API_URL?: string })
    .DIESELGEEKS_CHAT_API_URL;
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
