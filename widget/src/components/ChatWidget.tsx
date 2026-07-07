import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { getOrCreateSessionId } from "../session";
import type { ChatUIMessage, ProductCard } from "../types";
import { ProductCardView } from "./ProductCard";
import { BrandLogo } from "./BrandLogo";
import { TypingIndicator } from "./TypingIndicator";

const MAX_MESSAGE_LENGTH = 500;

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

function linkifyText(text: string): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return (
        <a key={`link-${index}`} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
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
    transport,
  });

  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const isBusy = status === "submitted" || status === "streaming";

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) {
      return;
    }

    setInput("");
    await sendMessage({ text: trimmed.slice(0, MAX_MESSAGE_LENGTH) });
  }

  if (!isOpen) {
    return null;
  }

  const panelClass = isMobile ? "dg-panel dg-panel-mobile" : "dg-panel dg-panel-desktop";

  return (
    <section className={panelClass} role="dialog" aria-label="Dr Diesel assistant">
      <header className="dg-header">
        <div className="dg-header-brand">
          <div className="dg-header-logo">
            <BrandLogo className="dg-brand-logo" logoUrl={logoUrl} />
          </div>
          <div className="dg-header-copy">
            <h2 className="dg-header-title">Dr Diesel</h2>
            <p className="dg-header-subtitle">Diesel injector &amp; fuel system specialist</p>
          </div>
        </div>
        <button type="button" className="dg-icon-btn" onClick={onClose} aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="dg-messages">
        {messages.length === 0 ? (
          <div className="dg-empty">
            <h3>Find the right diesel part</h3>
            <p>
              Ask about injectors, pumps, fuel lines, or fitment for your ute or 4x4. I&apos;ll search
              our live catalog and show real products with prices and stock.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const text = getMessageText(message);
          const products = getProductsFromMessage(message);
          const isUser = message.role === "user";

          if (!text && products.length === 0) {
            return null;
          }

          return (
            <div
              key={message.id}
              className={`dg-message ${isUser ? "dg-message-user" : "dg-message-assistant"}`}
            >
              {text ? (
                <div className={`dg-bubble ${isUser ? "dg-bubble-user" : "dg-bubble-assistant"}`}>
                  {isUser ? text : linkifyText(text)}
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
          );
        })}

        {isBusy ? <TypingIndicator /> : null}
        <div ref={messagesEndRef} />
      </div>

      <form className="dg-composer" onSubmit={handleSubmit}>
        {error ? <p className="dg-error">Something went wrong. Please try again.</p> : null}
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
    </section>
  );
}
