import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { getOrCreateSessionId } from "../session";
import { loadStoredConversation, saveStoredConversation } from "../conversation-storage";
import { renderMessageBody } from "../format-message";
import { useStoreCart } from "../use-store-cart";
import type { ChatUIMessage, ProductCard } from "../types";
import { ProductCardView } from "./ProductCard";
import { CartReview } from "./CartReview";
import { BrandLogo } from "./BrandLogo";
import { TypingIndicator } from "./TypingIndicator";
import { CartIcon, FuelIcon } from "./Icons";

const MAX_MESSAGE_LENGTH = 500;

const STARTER_PROMPTS = [
  "Find injectors for my vehicle",
  "Ask about a part number",
  "Check fitment for my ute",
];

function getMessageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getProductsFromMessage(message: ChatUIMessage): ProductCard[] {
  const products: ProductCard[] = [];

  for (const part of message.parts) {
    if (part.type === "data-products" && Array.isArray(part.data)) {
      products.push(...part.data);
      continue;
    }

    if (
      part.type === "tool-search_products" &&
      part.state === "output-available" &&
      part.output &&
      typeof part.output === "object" &&
      "products" in part.output &&
      Array.isArray(part.output.products)
    ) {
      products.push(...(part.output.products as ProductCard[]));
    }
  }

  const seen = new Set<number>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

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
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `${apiBase}/api/chat`,
        credentials: "omit",
        body: { sessionId },
      }),
    [apiBase, sessionId],
  );

  const { messages, sendMessage, status, error, stop } = useChat<ChatUIMessage>({
    id: sessionId,
    transport,
    messages: restoredMessages,
  });

  const [input, setInput] = React.useState("");
  const [view, setView] = React.useState<"chat" | "cart">("chat");
  const storeCart = useStoreCart(isOpen);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const lastMessageId = lastMessage?.id;
  const lastMessageHasContent =
    lastMessage?.role === "assistant" &&
    (getMessageText(lastMessage).length > 0 || getProductsFromMessage(lastMessage).length > 0);
  const showTypingIndicator = status === "submitted" || (status === "streaming" && !lastMessageHasContent);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

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
        />
      ) : (
        <>
          <div className="dg-messages">
            {messages.length === 0 ? (
              <div className="dg-empty">
                <div className="dg-empty-icon">
                  <FuelIcon />
                </div>
                <h3>Find the right diesel part</h3>
                <p>
                  Ask about injectors, pumps, fuel lines, or fitment for your ute or 4x4 — I&apos;ll search
                  our live catalog for real products with prices and stock.
                </p>
                <div className="dg-empty-chips">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="dg-chip"
                      onClick={() => void submitText(prompt)}
                      disabled={isBusy}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => {
              const text = getMessageText(message);
              const products = getProductsFromMessage(message);
              const isUser = message.role === "user";
              const isStreamingThisMessage =
                !isUser && status === "streaming" && message.id === lastMessageId && text.length > 0;

              if (!text && products.length === 0) {
                return null;
              }

              return (
                <div
                  key={message.id}
                  className={`dg-message-row ${isUser ? "dg-message-row-user" : "dg-message-row-assistant"}`}
                >
                  {isUser ? null : (
                    <span className="dg-avatar" aria-hidden="true">
                      <BrandLogo logoUrl={logoUrl} />
                    </span>
                  )}

                  <div className="dg-message">
                    {text ? (
                      <div className={`dg-bubble ${isUser ? "dg-bubble-user" : "dg-bubble-assistant"}`}>
                        {isUser ? (
                          <p className="dg-msg-line">{text}</p>
                        ) : (
                          <>
                            {renderMessageBody(text)}
                            {isStreamingThisMessage ? <span className="dg-cursor" aria-hidden="true" /> : null}
                          </>
                        )}
                      </div>
                    ) : null}

                    {!isUser && products.length > 0 ? (
                      <div className="dg-products">
                        {products.map((product) => (
                          <ProductCardView key={product.id} product={product} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {showTypingIndicator ? <TypingIndicator logoUrl={logoUrl} /> : null}
            <div ref={messagesEndRef} />
          </div>

          <form className="dg-composer" onSubmit={handleSubmit}>
            {error ? (
              <p className="dg-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Something went wrong. Please try again.
              </p>
            ) : null}
            <div className="dg-input-row">
              <textarea
                className="dg-input"
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder="e.g. 4JJ1 injectors for a 2010 Isuzu D-Max"
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit(event);
                  }
                }}
              />
              <button className="dg-send" type="submit" disabled={isBusy || !input.trim()} aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M3 9h10M10 5l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="dg-disclaimer">
              Please confirm fitment for your exact vehicle before ordering. Prices and stock are from our
              catalog snapshot and may change on the product page.
            </p>
            {isBusy ? (
              <button type="button" className="dg-btn dg-btn-secondary" onClick={() => void stop()}>
                Stop response
              </button>
            ) : null}
          </form>
        </>
      )}
    </section>
  );
}
