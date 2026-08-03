import * as React from "react";

import { renderMessageBody } from "../format-message";
import type { ChatUIMessage, ProductCard } from "../types";
import { ProductCardView } from "./ProductCard";
import { BrandLogo } from "./BrandLogo";
import { TypingIndicator } from "./TypingIndicator";
import { FuelIcon } from "./Icons";

const MAX_MESSAGE_LENGTH = 500;

const STARTER_PROMPTS = ["Find injectors for my vehicle", "Ask about a part number", "Check fitment for my ute"];

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

interface ChatThreadProps {
  messages: ChatUIMessage[];
  status: string;
  error: unknown;
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onStop: () => void;
  onSubmitText: (text: string) => void;
  logoUrl: string;
  inputPlaceholder?: string;
}

/**
 * Message list + composer, shared by the floating corner widget (`ChatWidget`)
 * and the homepage hero widget (`HeroChat`) so both surfaces stay in sync —
 * they're just wrapped in different headers/containers.
 */
export function ChatThread({
  messages,
  status,
  error,
  input,
  setInput,
  onSubmit,
  onStop,
  onSubmitText,
  logoUrl,
  inputPlaceholder = "e.g. 4JJ1 injectors for a 2010 Isuzu D-Max",
}: ChatThreadProps) {
  const messagesContainerRef = React.useRef<HTMLDivElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  // Tracks whether the user was already scrolled to the bottom before this
  // render, so a reply streaming in doesn't yank the view back down if
  // they've scrolled up to reread something.
  const shouldAutoScrollRef = React.useRef(true);
  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const lastMessageId = lastMessage?.id;
  const lastMessageHasContent =
    lastMessage?.role === "assistant" &&
    (getMessageText(lastMessage).length > 0 || getProductsFromMessage(lastMessage).length > 0);
  const showTypingIndicator = status === "submitted" || (status === "streaming" && !lastMessageHasContent);

  function handleMessagesScroll(): void {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 96;
  }

  /*
   * A streamed reply fires this effect on every token — dozens of times a
   * second, and again whenever product cards pop in and shift the layout.
   * `scrollIntoView({ behavior: "smooth" })` on every one of those queues a
   * fresh scroll animation before the last one finishes, so the view keeps
   * getting yanked toward a target that's still moving — that's the
   * "vibrating" jitter. Jumping straight to position instead (no animation)
   * still keeps the latest content pinned in view, just without stacking
   * competing animations against each other.
   */
  React.useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, status]);

  return (
    <>
      <div className="dg-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
        {messages.length === 0 ? (
          <div className="dg-empty">
            <div className="dg-empty-icon">
              <FuelIcon />
            </div>
            <h3>Find the right diesel part</h3>
            <p>
              Ask about injectors, pumps, fuel lines, or fitment for your ute or 4x4 — I&apos;ll search our live
              catalog for real products with prices and stock.
            </p>
            <div className="dg-empty-chips">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="dg-chip"
                  onClick={() => onSubmitText(prompt)}
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

      <form className="dg-composer" onSubmit={onSubmit}>
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
            placeholder={inputPlaceholder}
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit(event);
              }
            }}
          />
          {isBusy ? (
            <button type="button" className="dg-send dg-stop-btn" onClick={onStop} aria-label="Stop response">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="12" height="12" rx="2.5" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button className="dg-send" type="submit" disabled={!input.trim()} aria-label="Send message">
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
          )}
        </div>
        <p className="dg-disclaimer">
          Please confirm fitment for your exact vehicle before ordering. Prices and stock are from our catalog
          snapshot and may change on the product page.
        </p>
      </form>
    </>
  );
}
