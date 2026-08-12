import * as React from "react";

import { renderMessageBody } from "../format-message";
import { getComparisonFromMessage } from "../get-comparison-from-messages";
import { getProductsFromMessage } from "../get-products-from-messages";
import type { ChatUIMessage } from "../types";
import { CompareTable } from "./CompareTable";
import { ProductCardView } from "./ProductCard";
import { BrandLogo } from "./BrandLogo";
import { ActivityStatus } from "./ActivityStatus";
import { FuelIcon } from "./Icons";

const MAX_MESSAGE_LENGTH = 500;

const STARTER_PROMPTS = ["Find injectors for my vehicle", "Ask about a part number", "Check fitment for my ute"];

function getMessageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
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
  /**
   * The desktop 3-column layout (see HeroChat.tsx) shows product cards in
   * their own dedicated right-hand panel instead of inline in the
   * conversation, so the middle column stays a clean, focused text thread.
   * Mobile/the floating corner widget don't set this — there's no separate
   * panel there, so cards stay inline as before.
   */
  hideInlineProducts?: boolean;
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
  hideInlineProducts = false,
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
  /*
   * Keep the activity trail up until reply *text* appears. Product tool
   * results often land 1–2s earlier, but cards are intentionally held back
   * until text starts (see products gating below) — treating products as
   * "content" here hid the activity and left a blank gap with only Stop.
   */
  const lastMessageHasVisibleReply =
    lastMessage?.role === "assistant" && getMessageText(lastMessage).length > 0;
  const showActivityStatus =
    status === "submitted" || (status === "streaming" && !lastMessageHasVisibleReply);
  const activityAssistantMessage =
    lastMessage?.role === "assistant" && showActivityStatus ? lastMessage : undefined;

  // Used to tell "user scrolled up" apart from "container grew taller"
  // (both change scrollTop's relationship to the bottom, but only the
  // former should ever cancel auto-follow — see handleMessagesScroll).
  const lastScrollTopRef = React.useRef(0);

  function handleMessagesScroll(): void {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const scrolledUp = container.scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = container.scrollTop;

    // A deliberate upward scroll should free the view immediately, even by
    // a few pixels — waiting for a 96px threshold made it feel like every
    // scroll-up attempt got snapped straight back to the bottom the instant
    // the next streamed token arrived. Coming back down still uses a
    // forgiving threshold so re-following doesn't require pixel precision.
    shouldAutoScrollRef.current = scrolledUp ? distanceFromBottom < 4 : distanceFromBottom < 96;
  }

  /*
   * A streamed reply fires this effect on every token — dozens of times a
   * second, and again whenever product cards pop in and shift the layout.
   * `scrollIntoView()` looks like the obvious tool here, but it walks up
   * every scrollable ancestor needed to bring the target into view — inside
   * the hero widget that includes the *page itself*, so it was fighting the
   * user for control of the whole site's scrollbar during every response,
   * not just the message list. Setting `scrollTop` directly only ever
   * touches this one container.
   */
  React.useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
    lastScrollTopRef.current = container.scrollTop;
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
              Ask about injectors, pumps, fuel lines, or fitment for your ute or 4x4. I&apos;ll search our live
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
          const isUser = message.role === "user";
          const isLastMessage = message.id === lastMessageId;
          /*
           * The product search tool call typically resolves before the
           * assistant's text reply starts streaming in — showing cards the
           * instant they're ready, while there's no reply text on screen
           * yet at all, made them "pop in first" with nothing to accompany.
           * Waiting for full completion instead over-corrected the other
           * way (a long, empty-feeling gap before anything shows up).
           * Holding back only until *this* message's first bit of text has
           * appeared — not until it's fully finished — lands them together
           * right as the reply starts forming, then lets both keep
           * streaming/animating in alongside each other.
           */
          const products = isLastMessage && isBusy && text.length === 0 ? [] : getProductsFromMessage(message);
          const comparison =
            isLastMessage && isBusy && text.length === 0 ? null : getComparisonFromMessage(message);
          const isStreamingThisMessage = !isUser && status === "streaming" && isLastMessage && text.length > 0;

          // A product-only reply (no accompanying text) would otherwise render
          // as an empty bubble-less row once its cards are hidden here in
          // favor of the desktop right panel — nothing left to show inline.
          // Compare tables always stay in the chat column, even on desktop.
          if (!text && !comparison && (hideInlineProducts || products.length === 0)) {
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

                {!isUser && comparison ? <CompareTable products={comparison.products} /> : null}

                {!isUser && !hideInlineProducts && products.length > 0 ? (
                  <div className="dg-products">
                    {products.map((product, index) => (
                      <ProductCardView
                        key={product.id}
                        product={product}
                        style={{ "--dg-stagger": index } as React.CSSProperties}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {showActivityStatus ? (
          <ActivityStatus logoUrl={logoUrl} status={status} assistantMessage={activityAssistantMessage} />
        ) : null}
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
