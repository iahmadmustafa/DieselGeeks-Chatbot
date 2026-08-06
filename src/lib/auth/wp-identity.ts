import { createHmac, timingSafeEqual } from "node:crypto";

import { getWpChatJwtSecret } from "@/lib/env/read-env";

export interface WpIdentity {
  wpUserId: number;
  email: string;
  displayName: string;
}

interface WpIdentityPayload {
  uid?: unknown;
  email?: unknown;
  name?: unknown;
  exp?: unknown;
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + padding, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Verifies a token issued by the WordPress site's
 * dieselgeeks-chat-identity.php (see wordpress/dieselgeeks-chat-identity.php
 * for the signing side). Token shape is `<base64url payload>.<hex hmac>`,
 * deliberately not a full JWT library — WordPress signs it with plain PHP
 * (hash_hmac), so this just has to speak the same simple format back.
 *
 * Returns null for anything that doesn't check out (missing secret,
 * malformed token, bad signature, expired) — callers should treat that
 * exactly like "no identity provided" rather than surfacing why, so a
 * tampered/expired token degrades to guest behavior instead of erroring.
 */
export function verifyWpIdentityToken(token: string | null | undefined): WpIdentity | null {
  if (!token) {
    return null;
  }

  const secret = getWpChatJwtSecret();
  if (!secret) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null;
  }

  const payloadB64 = token.slice(0, separatorIndex);
  const signatureHex = token.slice(separatorIndex + 1);

  const expectedSignature = createHmac("sha256", secret).update(payloadB64).digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signatureHex, "utf8");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  const payloadJson = base64UrlDecode(payloadB64);
  if (!payloadJson) {
    return null;
  }

  let payload: WpIdentityPayload;
  try {
    payload = JSON.parse(payloadJson) as WpIdentityPayload;
  } catch {
    return null;
  }

  const uid = payload.uid;
  const email = payload.email;
  const name = payload.name;
  const exp = payload.exp;

  if (typeof uid !== "number" || typeof email !== "string" || typeof name !== "string" || typeof exp !== "number") {
    return null;
  }

  if (Date.now() / 1000 > exp) {
    return null;
  }

  return { wpUserId: uid, email, displayName: name };
}
