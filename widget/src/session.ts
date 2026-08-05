const SESSION_STORAGE_KEY = "dg_chat_session_id";

/**
 * Starts a brand new conversation ("New chat", see HeroChat.tsx) by
 * generating a fresh id and making it the active session, so a page reload
 * right after continues the new conversation rather than snapping back to
 * the old one. There's no persisted history to switch back to yet (that's a
 * separate, login-gated feature planned for later) — this is a clean-slate
 * reset, not a save-and-switch.
 */
export function createNewSessionId(): string {
  const created = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, created);
  } catch {
    // Ignore storage failures (private mode, quota) — the in-memory id still works for this page view.
  }
  return created;
}

export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }

    const created = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  }
}
