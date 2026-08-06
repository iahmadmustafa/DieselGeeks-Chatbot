/**
 * Bridges the WordPress site's own login session into the widget — see
 * wordpress/dieselgeeks-chat-identity.php for the PHP side that issues the
 * token this reads / handles in-widget password login. The widget never
 * invents a separate auth system; email/password goes through wp_signon on
 * the WordPress site, and Google Sign-In reuses Site Kit on My Account
 * inside a small popup.
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
  myAccountUrl?: string;
}

const LOGGED_OUT_RESULT: WpIdentityResult = { loggedIn: false, token: null, displayName: null };

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

/**
 * Drops the cached identity so the next getWpIdentity() hits WordPress
 * again — required after a successful in-widget login (or Google popup),
 * since the page-load cache would otherwise keep reporting "logged out".
 */
export function clearWpIdentityCache(): void {
  cachedResultPromise = null;
}

/**
 * Fetches (and caches for the page's lifetime) the current visitor's WP
 * identity. Fails closed to "logged out" on any error rather than throwing.
 */
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

/**
 * Email/password login against the WordPress site's real accounts
 * (admin-ajax → wp_signon). Stays on the current page — no /my-account/
 * redirect. On success, refreshes the identity cache.
 */
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

/**
 * Opens My Account in a small popup so Site Kit's Google button (and the
 * normal WP login form) can run there, then polls our identity endpoint
 * until the visitor is logged in or the popup closes. Keeps the chat page
 * underneath untouched.
 */
export async function loginWithGooglePopup(): Promise<WpLoginResult> {
  const config = getIdentityConfig();
  if (!config) {
    return {
      ok: false,
      error: "Sign-in isn’t available on this page yet. Please refresh and try again.",
    };
  }

  const accountUrl = config.myAccountUrl || `${window.location.origin}/my-account/`;
  const width = 480;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const popup = window.open(
    accountUrl,
    "dg-wp-login",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );

  if (!popup) {
    return {
      ok: false,
      error: "Popup blocked — please allow popups for this site, or sign in with email and password.",
    };
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: WpLoginResult) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearInterval(pollId);
      window.clearInterval(closedId);
      try {
        popup.close();
      } catch {
        // Ignore — popup may already be closed or cross-origin.
      }
      resolve(result);
    };

    const pollId = window.setInterval(() => {
      void (async () => {
        clearWpIdentityCache();
        const identity = await getWpIdentity();
        if (identity.loggedIn) {
          finish({ ok: true, identity });
        }
      })();
    }, 900);

    const closedId = window.setInterval(() => {
      if (popup.closed) {
        void (async () => {
          clearWpIdentityCache();
          const identity = await getWpIdentity();
          if (identity.loggedIn) {
            finish({ ok: true, identity });
            return;
          }
          finish({ ok: false, error: "Sign-in window was closed before finishing." });
        })();
      }
    }, 400);
  });
}
