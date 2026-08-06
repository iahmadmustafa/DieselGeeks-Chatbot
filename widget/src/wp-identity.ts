/**
 * Bridges the WordPress site's own login session into the widget — see
 * wordpress/dieselgeeks-chat-identity.php. Email/password uses wp_signon;
 * Google uses Google Identity Services on this page (same Client ID as Site
 * Kit) and a WP AJAX verifier — never navigates to /my-account/.
 */

export interface WpIdentityResult {
  loggedIn: boolean;
  /** Short-lived signed token to forward to our backend so it can trust this identity. Absent when logged out. */
  token: string | null;
  displayName: string | null;
}

interface DieselgeeksChatIdentityConfig {
  ajaxUrl: string;
  nonce: string;
  googleClientId?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: string;
    ux_mode?: "popup" | "redirect";
  }) => void;
  prompt: (momentListener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; isDismissedMoment: () => boolean }) => void) => void;
  renderButton: (
    parent: HTMLElement,
    options: { type?: string; theme?: string; size?: string; text?: string; shape?: string; width?: number },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const LOGGED_OUT_RESULT: WpIdentityResult = { loggedIn: false, token: null, displayName: null };
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function getIdentityConfig(): DieselgeeksChatIdentityConfig | null {
  const config = (window as Window & { DIESELGEEKS_CHAT_IDENTITY?: DieselgeeksChatIdentityConfig })
    .DIESELGEEKS_CHAT_IDENTITY;
  if (!config?.ajaxUrl || !config.nonce) {
    return null;
  }
  return config;
}

function parseIdentityResponse(data: Partial<WpIdentityResult> & { loggedIn?: boolean }): WpIdentityResult {
  if (!data.loggedIn) {
    return LOGGED_OUT_RESULT;
  }

  return {
    loggedIn: true,
    token: typeof data.token === "string" ? data.token : null,
    displayName: typeof data.displayName === "string" ? data.displayName : null,
  };
}

let cachedResultPromise: Promise<WpIdentityResult> | null = null;
let gsiScriptPromise: Promise<GoogleAccountsId> | null = null;

export function clearWpIdentityCache(): void {
  cachedResultPromise = null;
}

export function getWpIdentity(): Promise<WpIdentityResult> {
  if (cachedResultPromise) {
    return cachedResultPromise;
  }

  cachedResultPromise = (async () => {
    const config = getIdentityConfig();
    if (!config) {
      return LOGGED_OUT_RESULT;
    }

    try {
      const url = new URL(config.ajaxUrl);
      url.searchParams.set("action", "dieselgeeks_chat_identity");
      url.searchParams.set("nonce", config.nonce);

      const response = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return LOGGED_OUT_RESULT;
      }

      return parseIdentityResponse(
        (await response.json()) as Partial<WpIdentityResult> & { loggedIn?: boolean },
      );
    } catch {
      return LOGGED_OUT_RESULT;
    }
  })();

  return cachedResultPromise;
}

export type WpLoginResult =
  | { ok: true; identity: WpIdentityResult }
  | { ok: false; error: string };

export async function loginWithPassword(options: {
  username: string;
  password: string;
  remember: boolean;
}): Promise<WpLoginResult> {
  const config = getIdentityConfig();
  if (!config) {
    return {
      ok: false,
      error: "Sign-in isn’t available on this page yet. Please refresh and try again.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("action", "dieselgeeks_chat_login");
    body.set("nonce", config.nonce);
    body.set("username", options.username);
    body.set("password", options.password);
    if (options.remember) {
      body.set("remember", "1");
    }

    const response = await fetch(config.ajaxUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: body.toString(),
    });

    const data = (await response.json().catch(() => ({}))) as Partial<WpIdentityResult> & {
      loggedIn?: boolean;
      error?: string;
    };

    if (!response.ok || !data.loggedIn) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Could not sign in. Please try again.",
      };
    }

    const identity = parseIdentityResponse(data);
    clearWpIdentityCache();
    cachedResultPromise = Promise.resolve(identity);
    return { ok: true, identity };
  } catch {
    return { ok: false, error: "Network error — please check your connection and try again." };
  }
}

function loadGoogleIdentityServices(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }

  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.accounts?.id) {
          resolve(window.google.accounts.id);
        } else {
          reject(new Error("Google Identity Services failed to initialize."));
        }
      });
      existing.addEventListener("error", () => reject(new Error("Could not load Google Sign-In.")));
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
      } else {
        reject(new Error("Google Identity Services failed to initialize."));
      }
    };
    script.onerror = () => reject(new Error("Could not load Google Sign-In."));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/**
 * Exchanges a Google Identity Services ID token for a WordPress session via
 * our AJAX bridge (same accounts Site Kit would create/log into).
 */
export async function loginWithGoogleCredential(credential: string): Promise<WpLoginResult> {
  const config = getIdentityConfig();
  if (!config) {
    return {
      ok: false,
      error: "Sign-in isn’t available on this page yet. Please refresh and try again.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("action", "dieselgeeks_chat_google_login");
    body.set("nonce", config.nonce);
    body.set("credential", credential);

    const response = await fetch(config.ajaxUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: body.toString(),
    });

    const data = (await response.json().catch(() => ({}))) as Partial<WpIdentityResult> & {
      loggedIn?: boolean;
      error?: string;
    };

    if (!response.ok || !data.loggedIn) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Google sign-in failed. Please try again.",
      };
    }

    const identity = parseIdentityResponse(data);
    clearWpIdentityCache();
    cachedResultPromise = Promise.resolve(identity);
    return { ok: true, identity };
  } catch {
    return { ok: false, error: "Network error — please check your connection and try again." };
  }
}

/**
 * Opens Google's own account chooser (GIS) on this page — not My Account.
 * GIS buttons don't work reliably inside Shadow DOM, so we render Google's
 * button into a temporary light-DOM host and click it, which triggers the
 * normal Google popup over the chat page.
 */
export async function loginWithGoogle(): Promise<WpLoginResult> {
  const config = getIdentityConfig();
  if (!config?.googleClientId) {
    return {
      ok: false,
      error: "Google sign-in isn’t configured on this site yet.",
    };
  }

  let googleId: GoogleAccountsId;
  try {
    googleId = await loadGoogleIdentityServices();
  } catch {
    return { ok: false, error: "Could not load Google Sign-In. Please try again." };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: WpLoginResult) => {
      if (settled) {
        return;
      }
      settled = true;
      host.remove();
      resolve(result);
    };

    // Light DOM only — Google Identity Services cannot mount inside Shadow DOM.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:240px;height:44px;overflow:hidden;";
    document.body.appendChild(host);

    googleId.initialize({
      client_id: config.googleClientId!,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      callback: (response) => {
        void (async () => {
          if (!response.credential) {
            finish({ ok: false, error: "Google sign-in was cancelled." });
            return;
          }
          finish(await loginWithGoogleCredential(response.credential));
        })();
      },
    });

    googleId.renderButton(host, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 240,
    });

    window.setTimeout(() => {
      const button =
        host.querySelector<HTMLElement>('div[role="button"]') ??
        host.querySelector<HTMLElement>("div[tabindex='0']") ??
        host.querySelector<HTMLElement>("iframe");

      if (!button) {
        // One Tap / prompt as a fallback when renderButton markup differs.
        googleId.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
            finish({
              ok: false,
              error: "Google sign-in didn’t open. Please allow popups and try again.",
            });
          }
        });
        return;
      }

      button.click();
    }, 80);

    // If the user dismisses Google's UI without a credential callback.
    window.setTimeout(() => {
      if (!settled) {
        finish({ ok: false, error: "Google sign-in timed out or was cancelled." });
      }
    }, 120_000);
  });
}
