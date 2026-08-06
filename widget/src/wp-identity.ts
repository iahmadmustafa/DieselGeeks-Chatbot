/**
 * Bridges the WordPress site's own login session into the widget — see
 * wordpress/dieselgeeks-chat-identity.php for the PHP side that issues the
 * token this reads. The widget itself never touches a password or session
 * cookie directly; it just asks "who, if anyone, is logged in on this page
 * right now" via an endpoint that only WordPress (running same-origin) can
 * answer for real.
 */

export interface WpIdentityResult {
  loggedIn: boolean;
  /** Short-lived signed token to forward to our backend (e.g. as a header on /api/chat) so it can trust this identity. Absent when logged out. */
  token: string | null;
  displayName: string | null;
}

interface DieselgeeksChatIdentityConfig {
  ajaxUrl: string;
  nonce: string;
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

let cachedResultPromise: Promise<WpIdentityResult> | null = null;

/**
 * Fetches (and caches for the page's lifetime) the current visitor's WP
 * identity. Cached rather than re-fetched per call since it's asked for
 * from multiple places (sidebar UI, chat send) and the underlying login
 * state can't change without a full page reload anyway (WP sets the auth
 * cookie via a real page navigation through wp-login.php / My Account).
 *
 * Fails closed to "logged out" on any error (missing config — e.g. running
 * against the local demo pages that don't load the WP embed script at all
 * — network failure, bad response) rather than throwing, since a visitor
 * simply not being recognized as logged in should never block chat.
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

      const data = (await response.json()) as Partial<WpIdentityResult> & { loggedIn?: boolean };
      if (!data.loggedIn) {
        return LOGGED_OUT_RESULT;
      }

      return {
        loggedIn: true,
        token: typeof data.token === "string" ? data.token : null,
        displayName: typeof data.displayName === "string" ? data.displayName : null,
      };
    } catch {
      return LOGGED_OUT_RESULT;
    }
  })();

  return cachedResultPromise;
}
