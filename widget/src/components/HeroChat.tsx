import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { createNewSessionId, getOrCreateSessionId } from "../session";
import { loadStoredConversation, saveStoredConversation } from "../conversation-storage";
import { useStoreCart } from "../use-store-cart";
import { useMediaQuery } from "../use-media-query";
import { getAllProductsFromMessages } from "../get-products-from-messages";
import type { ChatUIMessage } from "../types";
import { CartReview } from "./CartReview";
import { BrandLogo } from "./BrandLogo";
import { ChatThread } from "./ChatThread";
import { ProductCardView } from "./ProductCard";
import {
  CartIcon,
  ChatBubbleIcon,
  ClipboardIcon,
  CloseIcon,
  DotsIcon,
  PlusIcon,
  SparkleIcon,
  ToolsIcon,
  TruckIcon,
  WrenchIcon,
} from "./Icons";

/** Desktop/laptop only — 3-column layout collapses back to the existing single-column experience below this. */
const DESKTOP_QUERY = "(min-width: 1024px)";

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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sessionId, setSessionId] = React.useState(() => getOrCreateSessionId());
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
  // Mobile/tablet: which full-screen view is showing (chat replaces cart and
  // vice versa — there's no room for both). Desktop ignores this and shows
  // chat permanently in the middle column; see desktopPanelTab below instead.
  const [view, setView] = React.useState<"chat" | "cart">("chat");
  // Desktop only: which tab is active in the right-hand panel that sits
  // alongside (not instead of) the chat column.
  const [desktopPanelTab, setDesktopPanelTab] = React.useState<"products" | "cart">("products");
  /*
   * Deliberately always starts collapsed, even when there's restored history
   * from an earlier visit — every page load (reload, or navigating here from
   * another page) should land on the idle "ask a question" screen, not
   * auto-reopen a stale conversation from hours ago. The restored messages
   * themselves are still loaded into useChat above, so nothing is lost:
   * clicking the input, a quick-action pill, or sending a new message
   * expands right back into the full prior conversation.
   */
  const [started, setStarted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const isExpanded = started || view === "cart";
  const storeCart = useStoreCart(isExpanded);
  /*
   * Mirrors ChatThread's per-message holdback: while the latest reply is
   * still being generated, its products (which usually resolve before the
   * text finishes streaming) are left out of the aggregate so the right
   * panel doesn't pop open/update ahead of the reply that's introducing
   * them. Everything from earlier, already-finished turns still shows
   * immediately.
   */
  const allProducts = useMemo(() => {
    const messagesForProducts = isBusy && messages.length > 0 ? messages.slice(0, -1) : messages;
    return getAllProductsFromMessages(messagesForProducts);
  }, [messages, isBusy]);
  /*
   * The right panel is only worth the screen space once there's something to
   * put in it — an empty "recommended products" placeholder sitting there
   * from the first message onward just eats width for nothing. It shows up
   * automatically the moment the assistant surfaces products or the cart
   * has items, and stays available (via the corner cart button below) so
   * "Cart" is never unreachable even with an empty cart and no products yet.
   */
  const hasCartItems = !!storeCart.cart && storeCart.cart.items_count > 0;
  const showSidePanel = isDesktop && isExpanded && (allProducts.length > 0 || hasCartItems || desktopPanelTab === "cart");

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

  function closeChat(): void {
    setStarted(false);
    setView("chat");
    setDesktopPanelTab("products");
  }

  /*
   * ChatGPT-style "New chat" — starts a clean conversation by swapping in a
   * fresh session id (useChat/the transport are both keyed by it, so this
   * resets their state too), rather than trying to clear messages in place.
   * There's no history list to switch back to yet — login-gated chat history
   * is planned separately — so this is a one-way reset for now, same as
   * starting a brand new browser session would already do.
   */
  function handleNewChat(): void {
    setSessionId(createNewSessionId());
    setInput("");
    setView("chat");
    setDesktopPanelTab("products");
  }

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
    storeCart.refresh();
    if (isDesktop) {
      setDesktopPanelTab("cart");
    } else {
      setView("cart");
    }
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
      <div className="dg-hero-corner-actions">
        {!(isDesktop && isExpanded) || !showSidePanel ? (
          <button
            type="button"
            className="dg-icon-btn dg-cart-btn dg-hero-cart-btn"
            onClick={openCartView}
            aria-label="View cart"
            aria-pressed={isDesktop ? desktopPanelTab === "cart" : view === "cart"}
          >
            <CartIcon size={16} />
            {storeCart.cart && storeCart.cart.items_count > 0 ? (
              <span className="dg-cart-badge">{storeCart.cart.items_count}</span>
            ) : null}
          </button>
        ) : null}

        {isExpanded ? (
          <button
            type="button"
            className="dg-icon-btn dg-hero-close-btn"
            onClick={closeChat}
            aria-label="Close chat"
          >
            <CloseIcon size={15} />
          </button>
        ) : null}
      </div>

      {isExpanded && isDesktop ? (
        <div className={`dg-hero-expanded dg-hero-3col${showSidePanel ? "" : " dg-hero-3col-no-panel"}`}>
          <aside className="dg-hero-sidebar">
            <button type="button" className="dg-hero-new-chat-btn" onClick={handleNewChat}>
              <PlusIcon size={14} />
              New chat
            </button>
            {/*
              History (multiple past conversations you can switch back to) is
              a separate, login-gated feature planned for later — this is a
              placeholder so the sidebar isn't just dead space until then,
              not a promise of what's already built.
            */}
            <p className="dg-hero-sidebar-note">
              <SparkleIcon size={13} />
              Sign in soon to save and revisit past conversations.
            </p>
          </aside>

          <div className="dg-hero-chat-col">
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
              hideInlineProducts
            />
          </div>

          {showSidePanel ? (
            <aside className="dg-hero-side-panel">
              <div className="dg-hero-panel-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={desktopPanelTab === "products"}
                  className={`dg-hero-panel-tab${desktopPanelTab === "products" ? " dg-hero-panel-tab-active" : ""}`}
                  onClick={() => setDesktopPanelTab("products")}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={desktopPanelTab === "cart"}
                  className={`dg-hero-panel-tab${desktopPanelTab === "cart" ? " dg-hero-panel-tab-active" : ""}`}
                  onClick={() => {
                    setDesktopPanelTab("cart");
                    storeCart.refresh();
                  }}
                >
                  Cart
                  {storeCart.cart && storeCart.cart.items_count > 0 ? (
                    <span className="dg-hero-panel-tab-badge">{storeCart.cart.items_count}</span>
                  ) : null}
                </button>
              </div>

              <div className="dg-hero-side-panel-body">
                {desktopPanelTab === "products" ? (
                  allProducts.length > 0 ? (
                    <div className="dg-hero-panel-products">
                      {allProducts.map((product) => (
                        <ProductCardView key={product.id} product={product} />
                      ))}
                    </div>
                  ) : (
                    <div className="dg-hero-panel-empty">
                      <SparkleIcon size={22} />
                      <p>Products the assistant finds will show up here as you chat.</p>
                    </div>
                  )
                ) : (
                  <CartReview
                    cart={storeCart.cart}
                    status={storeCart.status}
                    error={storeCart.error}
                    onRefresh={storeCart.refresh}
                    onBack={() => setDesktopPanelTab("products")}
                    onUpdateAddress={storeCart.updateShippingAddress}
                    onSelectRate={storeCart.selectShippingRate}
                    onRemoveItem={storeCart.decrementItem}
                    embedded
                  />
                )}
              </div>
            </aside>
          ) : null}
        </div>
      ) : isExpanded ? (
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
              onClick={() => {
                // Explicit "open chat" affordance — expands straight into
                // the conversation view (picking up any restored history)
                // rather than just focusing the idle input, since typing
                // isn't the only way someone should be able to get in.
                setStarted(true);
              }}
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
