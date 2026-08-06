import { verifyWpIdentityToken, type WpIdentity } from "@/lib/auth/wp-identity";

/**
 * Reads the WP identity token from the preferred header, Authorization
 * Bearer, or an optional body field — same token the widget already gets
 * from dieselgeeks-chat-identity.php.
 */
export function getWpIdentityFromRequest(
  request: Request,
  bodyToken?: string | null,
): WpIdentity | null {
  const headerToken = request.headers.get("X-DG-Identity-Token");
  const auth = request.headers.get("Authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  return verifyWpIdentityToken(headerToken ?? bearer ?? bodyToken ?? null);
}
