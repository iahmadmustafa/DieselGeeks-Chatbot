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

describe("add to cart url", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("location", { origin: "https://shop.example" });
  });

  it("uses wc_add_to_cart_params when available", async () => {
    vi.stubGlobal("window", {
      wc_add_to_cart_params: {
        wc_ajax_url: "https://shop.example/?wc-ajax=%%endpoint%%",
      },
      location: { origin: "https://shop.example" },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, fragments: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { addProductToCart } = await import("./add-to-cart");
    await addProductToCart(123);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://shop.example/?wc-ajax=add_to_cart",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
