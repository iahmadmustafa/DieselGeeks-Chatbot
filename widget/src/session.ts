const SESSION_STORAGE_KEY = "dg_chat_session_id";

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
