/**
 * Bridges the WordPress site's own login session into the widget — see
 * wordpress/dieselgeeks-chat-identity.php. Email/password uses wp_signon;
 * Google uses Google Identity Services on this page (same Client ID as Site
 * Kit) and a WP AJAX verifier — never navigates to /my-account/.
 */

/** Theme-header fields from dieselgeeks-chat-identity.php after login. */
export interface StorefrontLoginUi {
  displayName: string;
  email: string;
  avatarUrl: string;
  accountUrl: string;
  editProfileUrl: string;
  logoutUrl: string;
}

export interface WpIdentityResult {
  loggedIn: boolean;
  /** Short-lived signed token to forward to our backend so it can trust this identity. Absent when logged out. */
  token: string | null;
  displayName: string | null;
  /** Present after a successful login/identity response that includes header sync data. */
  storefront?: StorefrontLoginUi | null;
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
  cancel: () => void;
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

function parseStorefront(value: unknown): StorefrontLoginUi | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const displayName = typeof data.displayName === "string" ? data.displayName : "";
  const email = typeof data.email === "string" ? data.email : "";
  const avatarUrl = typeof data.avatarUrl === "string" ? data.avatarUrl : "";
  const accountUrl = typeof data.accountUrl === "string" ? data.accountUrl : "";
  const editProfileUrl = typeof data.editProfileUrl === "string" ? data.editProfileUrl : "";
  const logoutUrl = typeof data.logoutUrl === "string" ? data.logoutUrl : "";

  if (!displayName || !accountUrl) {
    return null;
  }

  return { displayName, email, avatarUrl, accountUrl, editProfileUrl, logoutUrl };
}

function parseIdentityResponse(
  data: Partial<WpIdentityResult> & { loggedIn?: boolean; storefront?: unknown },
): WpIdentityResult {
  if (!data.loggedIn) {
    return LOGGED_OUT_RESULT;
  }

  return {
    loggedIn: true,
    token: typeof data.token === "string" ? data.token : null,
    displayName: typeof data.displayName === "string" ? data.displayName : null,
    storefront: parseStorefront(data.storefront),
  };
}

/**
 * Updates the Electron Theme header / mobile account chrome after AJAX login
 * so the site shows "My account" without a full reload. Uses textContent /
 * attribute updates only (no HTML injection). Safe no-op if selectors missing.
 */
export function syncStorefrontLoginUi(storefront: StorefrontLoginUi | null | undefined): void {
  if (!storefront || typeof document === "undefined") {
    return;
  }

  try {
    document.documentElement.classList.add("logged-in");
    document.body.classList.add("logged-in");

    document.querySelectorAll(".et-login .login-title").forEach((node) => {
      node.classList.remove("login");
    });

    const accountRoots = document.querySelectorAll<HTMLElement>(
      ".et-login .logged-in, .et-mobile-container-top .logged-in",
    );

    accountRoots.forEach((root) => {
      const infoSpans = root.querySelectorAll<HTMLElement>(".info > span");
      if (infoSpans[0]) {
        infoSpans[0].textContent = storefront.displayName;
      }
      if (infoSpans[1] && storefront.email) {
        infoSpans[1].textContent = storefront.email;
      }

      root.querySelectorAll("img.avatar").forEach((img) => {
        if (!(img instanceof HTMLImageElement) || !storefront.avatarUrl) {
          return;
        }
        img.src = storefront.avatarUrl;
        img.removeAttribute("srcset");
        img.alt = storefront.displayName;
      });

      root.querySelectorAll<HTMLAnchorElement>('a.et-button[href*="edit-account"]').forEach((link) => {
        if (storefront.editProfileUrl) {
          link.href = storefront.editProfileUrl;
        }
      });

      root.querySelectorAll<HTMLAnchorElement>("a.et-button").forEach((link) => {
        const label = (link.textContent ?? "").trim().toLowerCase();
        if (label === "dashboard" || label === "login") {
          link.href = storefront.accountUrl;
          if (label === "login") {
            link.textContent = "Dashboard";
          }
        }
      });
    });

    document.querySelectorAll<HTMLAnchorElement>('a[href*="action=logout"]').forEach((link) => {
      if (storefront.logoutUrl) {
        link.href = storefront.logoutUrl;
      }
    });

    document.querySelectorAll<HTMLAnchorElement>(".my-account-buttons a").forEach((link) => {
      const href = link.getAttribute("href") ?? "";
      if (href.includes("action=logout") && storefront.logoutUrl) {
        link.href = storefront.logoutUrl;
        return;
      }
      if (/\/my-account\/?$/.test(href.replace(/\/+$/, "") + "/") || href.endsWith("/my-account/")) {
        link.href = storefront.accountUrl;
      }
    });
  } catch (error) {
    console.warn("[dg-chat] storefront login UI sync skipped", error);
  }
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
 *
 * Pass an AbortSignal (from the login modal close button) so cancelling /
 * closing the modal doesn't leave the UI stuck on "Connecting to Google…".
 * GIS often does not call back when the user closes the Google window — we
 * also treat "window blurred then focused again without a credential" as cancel.
 */
export async function loginWithGoogle(options?: { signal?: AbortSignal }): Promise<WpLoginResult> {
  const config = getIdentityConfig();
  if (!config?.googleClientId) {
    return {
      ok: false,
      error: "Google sign-in isn’t configured on this site yet.",
    };
  }

  if (options?.signal?.aborted) {
    return { ok: false, error: "Google sign-in was cancelled." };
  }

  let googleId: GoogleAccountsId;
  try {
    googleId = await loadGoogleIdentityServices();
  } catch {
    return { ok: false, error: "Could not load Google Sign-In. Please try again." };
  }

  return new Promise((resolve) => {
    let settled = false;
    let sawBlur = false;
    let focusTimer: number | null = null;
    let timeoutId: number | null = null;

    // Light DOM only — Google Identity Services cannot mount inside Shadow DOM.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:240px;height:44px;overflow:hidden;";
    document.body.appendChild(host);

    const cleanup = () => {
      if (focusTimer !== null) {
        window.clearTimeout(focusTimer);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      options?.signal?.removeEventListener("abort", onAbort);
      try {
        googleId.cancel();
      } catch {
        // GIS may throw if nothing is prompting — safe to ignore.
      }
      host.remove();
    };

    const finish = (result: WpLoginResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const onAbort = () => {
      finish({ ok: false, error: "Google sign-in was cancelled." });
    };

    const onBlur = () => {
      sawBlur = true;
    };

    /*
     * When the Google popup/account UI closes, focus usually returns to this
     * tab without GIS invoking the credential callback — that's what left
     * the modal spinning forever. Wait a beat after focus so a successful
     * credential callback (which often races with focus) can win first.
     */
    const onFocus = () => {
      if (!sawBlur || settled) {
        return;
      }
      if (focusTimer !== null) {
        window.clearTimeout(focusTimer);
      }
      focusTimer = window.setTimeout(() => {
        if (!settled) {
          finish({ ok: false, error: "Google sign-in was cancelled." });
        }
      }, 700);
    };

    options?.signal?.addEventListener("abort", onAbort);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

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
          // Successful credential — don't treat the upcoming focus event as cancel.
          sawBlur = false;
          if (focusTimer !== null) {
            window.clearTimeout(focusTimer);
            focusTimer = null;
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
      if (settled) {
        return;
      }

      const button =
        host.querySelector<HTMLElement>('div[role="button"]') ??
        host.querySelector<HTMLElement>("div[tabindex='0']");

      if (!button) {
        // Avoid googleId.prompt() — Site Kit may already own One Tap on this
        // page, and prompting again is what produced duplicate "Sign in as …"
        // chips stacked on the storefront login UI.
        finish({
          ok: false,
          error: "Google sign-in didn’t open. Please allow popups and try again.",
        });
        return;
      }

      button.click();
    }, 80);

    timeoutId = window.setTimeout(() => {
      if (!settled) {
        finish({ ok: false, error: "Google sign-in timed out or was cancelled." });
      }
    }, 60_000);
  });
}
