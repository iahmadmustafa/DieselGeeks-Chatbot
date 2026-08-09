import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { getOrCreateSessionId } from "../session";
import { loadStoredConversation, saveStoredConversation } from "../conversation-storage";
import { useStoreCart } from "../use-store-cart";
import { getWpIdentity, type WpIdentityResult } from "../wp-identity";
import type { ChatUIMessage } from "../types";
import { CartReview } from "./CartReview";
import { BrandLogo } from "./BrandLogo";
import { ChatThread } from "./ChatThread";
import { CartIcon } from "./Icons";

const MAX_MESSAGE_LENGTH = 500;

interface ChatWidgetProps {
  apiBase: string;
  logoUrl: string;
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
}

export function ChatWidget({ apiBase, logoUrl, isOpen, isMobile, onClose }: ChatWidgetProps) {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const restoredMessages = useMemo(() => loadStoredConversation(sessionId), [sessionId]);
  const [wpIdentity, setWpIdentity] = React.useState<WpIdentityResult>({
    loggedIn: false,
    token: null,
    displayName: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    void getWpIdentity().then((identity) => {
      if (!cancelled) {
        setWpIdentity(identity);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `${apiBase}/api/chat`,
        credentials: "omit",
        body: { sessionId, wpIdentityToken: wpIdentity.token },
      }),
    [apiBase, sessionId, wpIdentity.token],
  );

  const { messages, sendMessage, status, error, stop } = useChat<ChatUIMessage>({
    id: sessionId,
    transport,
    messages: restoredMessages,
  });

  const [input, setInput] = React.useState("");
  const [view, setView] = React.useState<"chat" | "cart">("chat");
  const storeCart = useStoreCart(isOpen);
  const isBusy = status === "submitted" || status === "streaming";

  React.useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      return;
    }

    saveStoredConversation(sessionId, messages);
  }, [sessionId, messages, status]);

  React.useEffect(() => {
    return () => {
      saveStoredConversation(sessionId, messages);
    };
  }, [sessionId, messages]);

  async function submitText(rawText: string): Promise<void> {
    const trimmed = rawText.trim();
    if (!trimmed || isBusy) {
      return;
    }

    await sendMessage({ text: trimmed.slice(0, MAX_MESSAGE_LENGTH) });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) {
      return;
    }

    setInput("");
    await submitText(trimmed);
  }

  function openCartView(): void {
    setView("cart");
    storeCart.refresh();
  }

  const panelClass = isMobile ? "dg-panel dg-panel-mobile" : "dg-panel dg-panel-desktop";
  const panelStateClass = isOpen ? " dg-panel-open" : " dg-panel-closed";

  return (
    <section
      className={`${panelClass}${panelStateClass}`}
      role="dialog"
      aria-label="Dr Diesel assistant"
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="dg-panel-grabber" aria-hidden="true">
        <span />
      </div>

      <header className="dg-header">
        <div className="dg-header-brand">
          <div className="dg-header-logo">
            <BrandLogo className="dg-brand-logo" logoUrl={logoUrl} />
          </div>
          <div className="dg-header-copy">
            <h2 className="dg-header-title">Dr Diesel</h2>
            <p className="dg-header-status">
              <span className="dg-status-dot" aria-hidden="true" />
              Online now
            </p>
          </div>
        </div>
        <div className="dg-header-actions">
          <button
            type="button"
            className="dg-icon-btn dg-cart-btn"
            onClick={openCartView}
            aria-label="View cart"
            aria-pressed={view === "cart"}
          >
            <CartIcon size={16} />
            {storeCart.cart && storeCart.cart.items_count > 0 ? (
              <span className="dg-cart-badge">{storeCart.cart.items_count}</span>
            ) : null}
          </button>
          <button type="button" className="dg-icon-btn" onClick={onClose} aria-label="Close chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {view === "cart" ? (
        <CartReview
          cart={storeCart.cart}
          status={storeCart.status}
          error={storeCart.error}
          onRefresh={storeCart.refresh}
          onBack={() => setView("chat")}
          onUpdateAddresses={storeCart.updateCustomerAddresses}
          onSelectRate={storeCart.selectShippingRate}
          onRemoveItem={storeCart.decrementItem}
        />
      ) : (
        <ChatThread
          messages={messages}
          status={status}
          error={error}
          input={input}
          setInput={setInput}
          onSubmit={(event) => void handleSubmit(event)}
          onStop={() => void stop()}
          onSubmitText={(text) => void submitText(text)}
          logoUrl={logoUrl}
        />
      )}
    </section>
  );
}
