import * as React from "react";
import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

import { createNewSessionId, getOrCreateSessionId } from "../session";
import { loadStoredConversation, saveStoredConversation } from "../conversation-storage";
import {
  deleteConversationApi,
  fetchConversation,
  fetchConversations,
  saveConversation,
  type ConversationSummary,
} from "../conversation-api";
import { useStoreCart } from "../use-store-cart";
import { useMediaQuery } from "../use-media-query";
import { getAllProductsFromMessages } from "../get-products-from-messages";
import { getWpIdentity, type WpIdentityResult } from "../wp-identity";
import type { ChatUIMessage } from "../types";
import { CartReview } from "./CartReview";
import { BrandLogo } from "./BrandLogo";
import { ChatThread } from "./ChatThread";
import { LoginModal } from "./LoginModal";
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
  TrashIcon,
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
  /*
   * Fetched once on mount from the WP site's own login session (see
   * wp-identity.ts) — not used for anything visible yet beyond the sidebar
   * "signed in as ..." line, but forwarding the token on every chat request
   * from day one means a future server-side chat history feature won't
   * need another round of widget changes to start associating
   * conversations with a WordPress account.
   */
  const [wpIdentity, setWpIdentity] = React.useState<WpIdentityResult>({
    loggedIn: false,
    token: null,
    displayName: null,
  });
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [openingId, setOpeningId] = React.useState<string | null>(null);

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

  const { messages, setMessages, sendMessage, status, error, stop } = useChat<ChatUIMessage>({
    id: sessionId,
    transport,
    messages: restoredMessages,
  });

  const refreshHistory = React.useCallback(async (token: string): Promise<void> => {
    setHistoryLoading(true);
    try {
      const list = await fetchConversations(token);
      setConversations(list);
    } catch {
      // Non-fatal — sidebar just stays empty / stale until the next save.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!wpIdentity.token) {
      setConversations([]);
      return;
    }
    void refreshHistory(wpIdentity.token);
  }, [wpIdentity.token, refreshHistory]);

  function handleLoginSuccess(identity: WpIdentityResult): void {
    setWpIdentity(identity);
    setShowLoginModal(false);
    // Guest chat sitting in this browser gets lifted into the account
    // immediately so nothing is lost the first time they sign in.
    if (identity.token && messages.length > 0) {
      void saveConversation({
        token: identity.token,
        conversationId: sessionId,
        messages,
      })
        .then(() => refreshHistory(identity.token!))
        .catch(() => void refreshHistory(identity.token!));
    } else if (identity.token) {
      void refreshHistory(identity.token);
    }
  }

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
   * Mirrors ChatThread's per-message holdback: a message's products are
   * left out of the aggregate only until *that* message's own text has
   * started appearing (not until the whole reply is fully done) — see the
   * matching comment in ChatThread.tsx for why. Everything from earlier,
   * already-finished turns always shows immediately regardless.
   */
  const allProducts = useMemo(() => {
    if (messages.length === 0) {
      return [];
    }
    const last = messages[messages.length - 1];
    const lastHasText = last.parts.some((part) => part.type === "text" && part.text.length > 0);
    const holdBackLast = isBusy && last.role === "assistant" && !lastHasText;
    return getAllProductsFromMessages(holdBackLast ? messages.slice(0, -1) : messages);
  }, [messages, isBusy]);

  React.useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      return;
    }

    saveStoredConversation(sessionId, messages);

    // Logged-in users also persist to Redis (ChatGPT-style history). Guests
    // stay on localStorage only — see conversation-api.ts / chat-history.ts.
    if (!wpIdentity.token || messages.length === 0) {
      return;
    }

    const token = wpIdentity.token;
    void saveConversation({
      token,
      conversationId: sessionId,
      messages,
    })
      .then((summary) => {
        setConversations((prev) => {
          const rest = prev.filter((item) => item.id !== summary.id);
          return [summary, ...rest];
        });
      })
      .catch(() => {
        // Ignore transient save failures — localStorage still has a copy.
      });
  }, [sessionId, messages, status, wpIdentity.token]);

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
    setMessages([]);
    setInput("");
    setView("chat");
    setDesktopPanelTab("products");
    setStarted(true);
  }

  async function handleOpenConversation(conversationId: string): Promise<void> {
    if (!wpIdentity.token || openingId || conversationId === sessionId) {
      if (conversationId === sessionId) {
        setStarted(true);
        setView("chat");
      }
      return;
    }

    setOpeningId(conversationId);
    try {
      const detail = await fetchConversation(wpIdentity.token, conversationId);
      if (!detail) {
        await refreshHistory(wpIdentity.token);
        return;
      }
      setSessionId(detail.id);
      setMessages(detail.messages);
      saveStoredConversation(detail.id, detail.messages);
      setInput("");
      setView("chat");
      setDesktopPanelTab("products");
      setStarted(true);
    } catch {
      // Leave the current chat alone if the load fails.
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDeleteConversation(
    event: React.MouseEvent,
    conversationId: string,
  ): Promise<void> {
    event.preventDefault();
    if (!wpIdentity.token || deletingId) {
      return;
    }

    setDeletingId(conversationId);
    try {
      await deleteConversationApi(wpIdentity.token, conversationId);
      setConversations((prev) => prev.filter((item) => item.id !== conversationId));
      if (conversationId === sessionId) {
        const nextId = createNewSessionId();
        setSessionId(nextId);
        setMessages([]);
        setInput("");
        saveStoredConversation(nextId, []);
      }
    } catch {
      // Keep the row if delete failed.
    } finally {
      setDeletingId(null);
    }
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
      {/*
        Idle (not chatting): no corner chrome — the cart icon used to sit
        alone in the top-right of the idle hero and read as clutter with
        nothing useful to do there yet. Cart only appears once chat is
        open on mobile/tablet (desktop uses the side-panel Cart tab).
      */}
      {isExpanded ? (
        <div className="dg-hero-corner-actions">
          {!isDesktop ? (
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
          ) : null}

          <button
            type="button"
            className="dg-icon-btn dg-hero-close-btn"
            onClick={closeChat}
            aria-label="Close chat"
          >
            <CloseIcon size={15} />
          </button>
        </div>
      ) : null}

      {isExpanded && isDesktop ? (
        <div className="dg-hero-expanded dg-hero-3col">
          <aside className="dg-hero-sidebar">
            <button type="button" className="dg-hero-new-chat-btn" onClick={handleNewChat}>
              <PlusIcon size={14} />
              New chat
            </button>

            {wpIdentity.loggedIn ? (
              <div className="dg-hero-history">
                <p className="dg-hero-history-label">Chats</p>
                {historyLoading && conversations.length === 0 ? (
                  <p className="dg-hero-history-empty">Loading…</p>
                ) : null}
                {!historyLoading && conversations.length === 0 ? (
                  <p className="dg-hero-history-empty">Your saved chats will show up here.</p>
                ) : null}
                <ul className="dg-hero-history-list">
                  {conversations.map((conversation) => {
                    const isActive = conversation.id === sessionId;
                    const isOpening = openingId === conversation.id;
                    const isDeleting = deletingId === conversation.id;
                    return (
                      <li
                        key={conversation.id}
                        className={`dg-hero-history-item${isActive ? " dg-hero-history-item-active" : ""}`}
                      >
                        <button
                          type="button"
                          className="dg-hero-history-item-open"
                          onClick={() => void handleOpenConversation(conversation.id)}
                          disabled={isOpening || isDeleting}
                          title={conversation.title}
                        >
                          {isOpening ? "Opening…" : conversation.title}
                        </button>
                        <button
                          type="button"
                          className="dg-hero-history-delete"
                          aria-label={`Delete ${conversation.title}`}
                          disabled={isOpening || isDeleting}
                          onClick={(event) => void handleDeleteConversation(event, conversation.id)}
                        >
                          {isDeleting ? (
                            <span className="dg-spinner" aria-hidden="true" />
                          ) : (
                            <TrashIcon size={12} />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {wpIdentity.loggedIn ? (
              <div className="dg-hero-sidebar-account">
                <span className="dg-hero-sidebar-avatar" aria-hidden="true">
                  {(wpIdentity.displayName ?? "U").trim().charAt(0).toUpperCase()}
                </span>
                <div className="dg-hero-sidebar-account-text">
                  <strong>{wpIdentity.displayName ?? "Signed in"}</strong>
                  <span>Chats saved to your account</span>
                </div>
              </div>
            ) : (
              <div className="dg-hero-sidebar-signin">
                <p className="dg-hero-sidebar-signin-copy">Sign in to save chats and revisit them anytime.</p>
                <button
                  type="button"
                  className="dg-btn dg-btn-primary dg-hero-signin-btn"
                  onClick={() => setShowLoginModal(true)}
                >
                  Sign in
                </button>
              </div>
            )}
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

            {/*
              key forces a fresh mount (and therefore its fade-in animation
              — see .dg-hero-panel-fade below) whenever the tab or the
              product list identity changes, so switching tabs or a fresh
              batch of products landing both get the same smooth crossfade
              instead of snapping in instantly.
            */}
            <div className="dg-hero-side-panel-body" key={desktopPanelTab === "products" ? "products" : "cart"}>
              {desktopPanelTab === "products" ? (
                allProducts.length > 0 ? (
                  <div className="dg-hero-panel-products dg-hero-panel-fade" key={allProducts.length}>
                    {allProducts.map((product, index) => (
                      <ProductCardView key={product.id} product={product} style={{ "--dg-stagger": index } as React.CSSProperties} />
                    ))}
                  </div>
                ) : (
                  <div className="dg-hero-panel-empty dg-hero-panel-fade">
                    <SparkleIcon size={22} />
                    <p>Products the assistant finds will show up here as you chat.</p>
                  </div>
                )
              ) : (
                <div className="dg-hero-panel-fade">
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
                </div>
              )}
            </div>
          </aside>
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

      {showLoginModal ? (
        <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      ) : null}
    </div>
  );
}
