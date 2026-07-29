import { describe, expect, it, beforeEach, vi } from "vitest";

import { loadStoredConversation, saveStoredConversation } from "./conversation-storage";
import type { ChatUIMessage } from "./types";

const SESSION_ID = "abc1234567890abcd";

function makeMessage(id: string, role: "user" | "assistant", text: string): ChatUIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("conversation storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  it("restores messages for the matching session id", () => {
    const messages = [makeMessage("m1", "user", "Need 4JJ1 injectors")];
    saveStoredConversation(SESSION_ID, messages);

    expect(loadStoredConversation(SESSION_ID)).toEqual(messages);
  });

  it("returns an empty array when the stored session id does not match", () => {
    saveStoredConversation(SESSION_ID, [makeMessage("m1", "user", "Hello")]);

    expect(loadStoredConversation("different-session-id")).toEqual([]);
  });

  it("clears storage when saving an empty conversation", () => {
    saveStoredConversation(SESSION_ID, [makeMessage("m1", "user", "Hello")]);
    saveStoredConversation(SESSION_ID, []);

    expect(localStorage.getItem("dg_chat_conversation")).toBeNull();
    expect(loadStoredConversation(SESSION_ID)).toEqual([]);
  });
});

