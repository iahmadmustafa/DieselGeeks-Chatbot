import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { getOrCreateSessionId } from "../session";
import { loadStoredConversation, saveStoredConversation } from "../conversation-storage";
import { useStoreCart } from "../use-store-cart";
import type { ChatUIMessage } from "../types";
import { CartReview } from "./CartReview";
import { BrandLogo } from "./BrandLogo";
import { ChatThread } from "./ChatThread";
import {
  CartIcon,
  ChatBubbleIcon,
  ClipboardIcon,
  DotsIcon,
  ToolsIcon,
  TruckIcon,
  WrenchIcon,
} from "./Icons";

const MAX_MESSAGE_LENGTH = 500;

const QUICK_ACTIONS: { label: string; prompt: string; icon: (props: { size?: number }) => React.ReactElement }[] = [
  { label: "Find Parts", prompt: "Help me find a part for my vehicle", icon: WrenchIcon },
  { label: "Services", prompt: "What services do you offer?", icon: ToolsIcon },
  { label: "Order Support", prompt: "I need help with an existing order", icon: ClipboardIcon },
  { label: "Shipping Info", prompt: "What are your shipping options and how much do they cost?", icon: TruckIcon },
  { label: "More", prompt: "What else can you help me with?", icon: DotsIcon },
];

interface HeroChatProps {
  apiBase: string;
  logoUrl: string;
}

/**
 * Inline hero-section chat, mounted in place of the old homepage slider (see
 * index.tsx). Shares the exact same backend, session storage, and chat/cart
 * logic as the floating corner widget (`ChatWidget`) via `ChatThread` and
 * `useStoreCart` — this file only differs in presentation: a ChatGPT/Gemini
 * style idle search box that expands, in place, into a bounded chat card
 * instead of a full-screen or floating panel.
 */
export function HeroChat({ apiBase, logoUrl }: HeroChatProps) {
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
  const [started, setStarted] = React.useState(restoredMessages.length > 0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const isExpanded = started || view === "cart";
  const storeCart = useStoreCart(isExpanded);

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

    setStarted(true);
    await sendMessage({ text: trimmed.slice(0, MAX_MESSAGE_LENGTH) });
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) {
      return;
    }

    setInput("");
    await submitText(trimmed);
  }

  function openCartView(): void {
    setStarted(true);
    setView("cart");
    storeCart.refresh();
  }

  // Built from apiBase (per-site, like logoUrl) rather than baked into
  // styles.ts, since the CSS bundle has no way to know which site's origin
  // to point at. See build.mjs (copies src/assests/background.png into
  // public/dg-hero-bg.png) and styles.ts's .dg-hero / .dg-hero::before for
  // the fallback color + legibility overlay this photo sits under.
  const heroBackgroundStyle: React.CSSProperties = {
    backgroundImage: `url(${apiBase}/dg-hero-bg.png)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div className={`dg-hero${isExpanded ? " dg-hero-active" : ""}`} style={heroBackgroundStyle}>
      {/*
        Positioned relative to the whole .dg-hero section (not the idle/
        expanded child boxes below, which only wrap their own centered
        content) so it always sits in the section's actual top-right corner
        instead of pinning to the top of whatever small content box happens
        to be showing.
      */}
      <button
        type="button"
        className="dg-icon-btn dg-cart-btn dg-hero-cart-btn"
        onClick={openCartView}
        aria-label="View cart"
        aria-pressed={view === "cart"}
      >
        <CartIcon size={16} />
        {storeCart.cart && storeCart.cart.items_count > 0 ? (
          <span className="dg-cart-badge">{storeCart.cart.items_count}</span>
        ) : null}
      </button>

      {isExpanded ? (
        <div className="dg-hero-expanded">
          {view === "cart" ? (
            <CartReview
              cart={storeCart.cart}
              status={storeCart.status}
              error={storeCart.error}
              onRefresh={storeCart.refresh}
              onBack={() => setView("chat")}
              onUpdateAddress={storeCart.updateShippingAddress}
              onSelectRate={storeCart.selectShippingRate}
              onRemoveItem={storeCart.removeItem}
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
              inputPlaceholder="Ask a question..."
            />
          )}
        </div>
      ) : (
        <div className="dg-hero-idle">
          <div className="dg-hero-idle-icon">
            <BrandLogo logoUrl={logoUrl} />
          </div>

          <h1 className="dg-hero-idle-title">
            HOW CAN WE <span>HELP YOU</span> TODAY?
          </h1>
          <p className="dg-hero-idle-subtitle">
            Ask anything about diesel parts, services, or solutions. We&apos;re here to help.
          </p>

          <form className="dg-hero-input-row" onSubmit={(event) => void handleSubmit(event)}>
            <input
              ref={inputRef}
              className="dg-hero-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="Ask a question..."
            />
            <button
              className="dg-send dg-hero-send"
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
            >
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
          </form>

          <div className="dg-hero-pills">
            <button
              type="button"
              className="dg-hero-pill dg-hero-pill-active"
              onClick={() => inputRef.current?.focus()}
            >
              <ChatBubbleIcon size={14} />
              Chat
            </button>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="dg-hero-pill"
                onClick={() => void submitText(action.prompt)}
              >
                <action.icon size={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
