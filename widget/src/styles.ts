export const WIDGET_CSS = `
:host, * {
  box-sizing: border-box;
}

.dg-root {
  --dg-bg: #0a0c0e;
  --dg-bg-soft: #0d1013;
  --dg-surface: #15181d;
  --dg-surface-2: #1c2027;
  --dg-surface-3: #252b33;
  --dg-border: #262c34;
  --dg-border-strong: #3a4149;
  --dg-text: #f6f7f9;
  --dg-text-secondary: #cbd1da;
  --dg-muted: #8b93a1;
  --dg-accent: #65D2D5;
  --dg-accent-light: #9ae6e8;
  --dg-accent-dark: #3fa9ac;
  --dg-accent-glow: rgba(101, 210, 213, 0.38);
  --dg-accent-soft: rgba(101, 210, 213, 0.12);
  --dg-cta: #0d0d0d;
  --dg-cta-hover: #1f1f1f;
  --dg-on-cta: #ffffff;
  --dg-success: #34d399;
  --dg-success-soft: rgba(52, 211, 153, 0.14);
  --dg-danger: #f87171;
  --dg-danger-soft: rgba(248, 113, 113, 0.14);
  --dg-warning: #fbbf24;
  --dg-warning-soft: rgba(251, 191, 36, 0.14);
  --dg-radius-sm: 8px;
  --dg-radius-md: 12px;
  --dg-radius-lg: 18px;
  --dg-radius-xl: 26px;
  --dg-radius-full: 999px;
  --dg-shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.28);
  --dg-shadow-md: 0 14px 34px rgba(0, 0, 0, 0.38);
  --dg-shadow-lg: 0 28px 70px rgba(0, 0, 0, 0.5);
  --dg-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dg-ease-in: cubic-bezier(0.6, 0, 0.9, 0.2);
  --dg-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dg-dur-fast: 130ms;
  --dg-dur-base: 220ms;
  --dg-dur-slow: 320ms;
  --dg-mobile-bottom-offset: 0px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--dg-text);
  line-height: 1.5;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

.dg-root button, .dg-root textarea, .dg-root input {
  font-family: inherit;
}

.dg-root :focus-visible {
  outline: 2px solid var(--dg-accent);
  outline-offset: 2px;
}

/* ---------- Launcher ---------- */

.dg-launcher {
  position: fixed;
  right: max(1.1rem, env(safe-area-inset-right));
  bottom: max(1.1rem, env(safe-area-inset-bottom));
  z-index: 2147483000;
  display: inline-flex;
  align-items: center;
  gap: 0;
  border: 1px solid rgba(101, 210, 213, 0.4);
  background: linear-gradient(150deg, #191d22 0%, #0e1013 100%);
  color: var(--dg-text);
  border-radius: var(--dg-radius-full);
  padding: 0.62rem;
  box-shadow: var(--dg-shadow-md), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  cursor: pointer;
  transition: transform var(--dg-dur-base) var(--dg-ease-spring), box-shadow var(--dg-dur-base) var(--dg-ease-out),
    border-color var(--dg-dur-base) var(--dg-ease-out), padding-right var(--dg-dur-slow) var(--dg-ease-out);
}

.dg-launcher:hover,
.dg-launcher:focus-visible {
  transform: translateY(-2px);
  border-color: var(--dg-accent);
  box-shadow: var(--dg-shadow-md), 0 0 28px var(--dg-accent-glow);
  padding-right: 1.15rem;
}

.dg-launcher:active {
  transform: translateY(-2px) scale(0.96);
}

.dg-launcher-icon-wrap {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--dg-radius-full);
}

.dg-launcher-icon-wrap::before {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 1.5px solid var(--dg-accent);
  opacity: 0.55;
  animation: dg-ring-pulse 2.6s ease-out infinite;
}

.dg-launcher-logo {
  width: 100%;
  height: 100%;
  border-radius: var(--dg-radius-full);
  object-fit: cover;
  display: block;
  position: relative;
  z-index: 1;
  transition: transform var(--dg-dur-base) var(--dg-ease-spring), opacity var(--dg-dur-fast) linear;
}

.dg-launcher-close-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--dg-bg);
  background: var(--dg-accent);
  border-radius: var(--dg-radius-full);
  z-index: 1;
  opacity: 0;
  transform: scale(0.6) rotate(-45deg);
  transition: transform var(--dg-dur-base) var(--dg-ease-spring), opacity var(--dg-dur-fast) linear;
  pointer-events: none;
}

.dg-launcher-status-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: var(--dg-success);
  border: 2px solid #14171b;
  z-index: 2;
  animation: dg-dot-pulse 2.4s ease-in-out infinite;
}

.dg-launcher-open .dg-launcher-logo {
  opacity: 0;
  transform: scale(0.6) rotate(45deg);
}

.dg-launcher-open .dg-launcher-close-icon {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}

.dg-launcher-open .dg-launcher-icon-wrap::before {
  animation: none;
  opacity: 0;
}

.dg-launcher-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.08rem;
  max-width: 0;
  margin-left: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transition: max-width var(--dg-dur-slow) var(--dg-ease-out), margin-left var(--dg-dur-slow) var(--dg-ease-out),
    opacity var(--dg-dur-fast) ease;
}

.dg-launcher:hover .dg-launcher-text,
.dg-launcher:focus-visible .dg-launcher-text {
  max-width: 13rem;
  margin-left: 0.7rem;
  opacity: 1;
  transition: max-width var(--dg-dur-slow) var(--dg-ease-out), margin-left var(--dg-dur-slow) var(--dg-ease-out),
    opacity var(--dg-dur-base) ease var(--dg-dur-fast);
}

.dg-launcher-title {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.dg-launcher-subtitle {
  font-size: 0.71rem;
  color: var(--dg-muted);
}

@keyframes dg-ring-pulse {
  0% { transform: scale(0.85); opacity: 0.6; }
  70% { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}

@keyframes dg-dot-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); }
  50% { box-shadow: 0 0 0 4px rgba(52, 211, 153, 0); }
}

/* ---------- Panel ---------- */

.dg-panel {
  position: fixed;
  z-index: 2147483001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dg-bg);
  border: 1px solid var(--dg-border-strong);
  box-shadow: var(--dg-shadow-lg);
  transition: opacity var(--dg-dur-base) var(--dg-ease-out), transform var(--dg-dur-base) var(--dg-ease-out),
    visibility 0s linear var(--dg-dur-base);
}

.dg-panel-desktop {
  right: max(1.1rem, env(safe-area-inset-right));
  bottom: max(5.75rem, calc(1.3rem + env(safe-area-inset-bottom)));
  width: min(408px, calc(100vw - 2rem));
  height: min(660px, calc(100vh - 7.5rem));
  border-radius: var(--dg-radius-xl);
  transform-origin: bottom right;
}

.dg-panel-mobile {
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  padding-top: env(safe-area-inset-top);
  padding-bottom: calc(var(--dg-mobile-bottom-offset) + env(safe-area-inset-bottom));
  transform-origin: bottom center;
}

.dg-panel-closed {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.dg-panel-desktop.dg-panel-closed {
  transform: translateY(14px) scale(0.94);
}

.dg-panel-mobile.dg-panel-closed {
  transform: translateY(24px);
}

.dg-panel-open {
  opacity: 1;
  transform: none;
  visibility: visible;
  transition: opacity var(--dg-dur-base) var(--dg-ease-out), transform var(--dg-dur-base) var(--dg-ease-out);
}

.dg-panel-grabber {
  display: none;
}

.dg-panel-mobile .dg-panel-grabber {
  display: flex;
  justify-content: center;
  padding: 0.55rem 0 0.15rem;
  flex-shrink: 0;
}

.dg-panel-grabber span {
  width: 2.25rem;
  height: 0.28rem;
  border-radius: var(--dg-radius-full);
  background: var(--dg-border-strong);
}

/* ---------- Header ---------- */

.dg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.95rem 1.05rem 0.9rem;
  background: linear-gradient(180deg, #172224 0%, #14181d 100%);
  border-bottom: 1px solid var(--dg-border);
  flex-shrink: 0;
}

.dg-header-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.dg-header-logo {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: var(--dg-radius-full);
  overflow: hidden;
  border: 1.5px solid rgba(101, 210, 213, 0.4);
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(101, 210, 213, 0.08);
}

.dg-brand-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dg-header-copy {
  min-width: 0;
}

.dg-header-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.dg-header-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: var(--dg-muted);
}

.dg-status-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: var(--dg-success);
  flex-shrink: 0;
  animation: dg-dot-pulse 2.4s ease-in-out infinite;
}

.dg-icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid var(--dg-border);
  border-radius: var(--dg-radius-md);
  background: var(--dg-surface);
  color: var(--dg-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--dg-dur-fast) ease, border-color var(--dg-dur-fast) ease, background var(--dg-dur-fast) ease,
    transform var(--dg-dur-fast) ease;
}

.dg-icon-btn:hover {
  color: var(--dg-text);
  border-color: var(--dg-border-strong);
  background: var(--dg-surface-2);
}

.dg-icon-btn:active {
  transform: scale(0.92);
}

.dg-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.dg-cart-btn {
  position: relative;
}

.dg-cart-btn[aria-pressed="true"] {
  color: var(--dg-accent);
  border-color: var(--dg-accent);
  background: var(--dg-accent-soft);
}

.dg-cart-badge {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.3rem;
  border-radius: var(--dg-radius-full);
  background: var(--dg-accent);
  color: #06282a;
  font-size: 0.64rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  border: 2px solid var(--dg-bg-soft);
}

/* ---------- Cart review ---------- */

.dg-cart-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background:
    radial-gradient(circle at 100% 0%, rgba(101, 210, 213, 0.09), transparent 45%),
    var(--dg-bg);
}

.dg-cart-view-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--dg-border);
  flex-shrink: 0;
}

.dg-cart-back {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dg-text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.4rem 0.25rem;
  transition: color var(--dg-dur-fast) ease;
}

.dg-cart-back:hover {
  color: var(--dg-accent);
}

.dg-cart-view-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dg-cart-status {
  margin: auto 0;
  text-align: center;
  color: var(--dg-muted);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.dg-cart-status p {
  margin: 0;
}

.dg-cart-status-hint {
  font-size: 0.78rem;
}

.dg-cart-status-error {
  color: #fca5a5;
}

.dg-cart-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dg-cart-item {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem;
  border-radius: var(--dg-radius-md);
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
}

.dg-cart-item-image {
  width: 52px;
  height: 52px;
  border-radius: var(--dg-radius-sm);
  overflow: hidden;
  background: #0c0e11;
  border: 1px solid var(--dg-border);
  flex-shrink: 0;
}

.dg-cart-item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dg-cart-item-image-fallback {
  width: 100%;
  height: 100%;
}

.dg-cart-item-body {
  min-width: 0;
}

.dg-cart-item-name {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--dg-text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.dg-cart-item-meta {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: var(--dg-muted);
}

.dg-cart-item-total {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--dg-accent-light);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ---------- Cart shipping (stage 2) ---------- */

.dg-cart-shipping {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 0.9rem;
  border-radius: var(--dg-radius-md);
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
}

.dg-cart-shipping-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--dg-text);
}

.dg-cart-address-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dg-cart-address-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.dg-cart-address-row-3 {
  grid-template-columns: 1.4fr 0.8fr 1fr;
}

.dg-cart-address-form input,
.dg-cart-address-form select {
  min-height: 2.4rem;
  border-radius: var(--dg-radius-sm);
  border: 1px solid var(--dg-border-strong);
  background: var(--dg-bg-soft);
  color: var(--dg-text);
  padding: 0.5rem 0.6rem;
  font: inherit;
  font-size: 0.8rem;
  width: 100%;
}

.dg-cart-address-form input::placeholder {
  color: var(--dg-muted);
}

.dg-cart-address-form input:focus,
.dg-cart-address-form select:focus {
  outline: none;
  border-color: var(--dg-accent);
  box-shadow: 0 0 0 3px var(--dg-accent-soft);
}

.dg-cart-shipping-submit-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.dg-cart-shipping-submit {
  align-self: flex-start;
  flex-shrink: 0;
}

.dg-cart-shipping-hint {
  font-size: 0.68rem;
  color: var(--dg-muted);
}

.dg-cart-shipping-error {
  margin: 0;
  font-size: 0.72rem;
  color: #fca5a5;
}

.dg-cart-shipping-empty {
  margin: 0;
  font-size: 0.75rem;
  color: var(--dg-muted);
}

.dg-cart-shipping-rates {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--dg-border);
}

.dg-cart-shipping-package-name {
  margin: 0 0 0.15rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--dg-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dg-cart-shipping-rate {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.6rem;
  border-radius: var(--dg-radius-sm);
  border: 1px solid var(--dg-border);
  background: var(--dg-surface);
  cursor: pointer;
  font-size: 0.8rem;
}

.dg-cart-shipping-rate:has(input:checked) {
  border-color: var(--dg-accent);
  background: var(--dg-accent-soft);
}

.dg-cart-shipping-rate input[type="radio"] {
  accent-color: var(--dg-accent);
  flex-shrink: 0;
}

.dg-cart-shipping-rate-name {
  flex: 1;
  color: var(--dg-text-secondary);
}

.dg-cart-shipping-rate-price {
  font-weight: 700;
  color: var(--dg-text);
  font-variant-numeric: tabular-nums;
}

.dg-cart-summary {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.85rem 0.9rem;
  border-radius: var(--dg-radius-md);
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
}

.dg-cart-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--dg-text-secondary);
}

.dg-cart-summary-row span:last-child {
  font-variant-numeric: tabular-nums;
}

.dg-cart-summary-fee-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.dg-cart-summary-total {
  padding-top: 0.5rem;
  margin-top: 0.15rem;
  border-top: 1px solid var(--dg-border);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--dg-text);
}

.dg-cart-view-footer {
  flex-shrink: 0;
  padding: 0.85rem;
  border-top: 1px solid var(--dg-border);
  background: var(--dg-surface);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dg-payment-step {
  padding: 0.9rem;
  border-radius: var(--dg-radius-lg);
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dg-payment-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.dg-payment-form input[type="email"],
.dg-payment-form input[type="text"] {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.7rem;
  border-radius: var(--dg-radius-sm);
  border: 1px solid var(--dg-border);
  background: var(--dg-surface);
  color: var(--dg-text);
  font-size: 0.85rem;
  font-family: inherit;
}

.dg-payment-form input[type="email"]:focus,
.dg-payment-form input[type="text"]:focus {
  outline: none;
  border-color: var(--dg-accent);
}

.dg-payment-card-field {
  padding: 0.2rem 0.7rem;
  border-radius: var(--dg-radius-sm);
  border: 1px solid var(--dg-border);
  background: var(--dg-surface);
}

.dg-payment-card-iframe {
  /*
   * A 24px iframe is too tight for Stripe's default Card Element at 15px
   * font — Stripe lays out card number / expiry / CVC as one row with its
   * own internal vertical padding, and a squeezed container clips part of
   * that row. That doesn't just look bad: it can make the expiry/CVC
   * portion effectively unclickable, so the card can never actually
   * satisfy Stripe's "complete" check no matter what's typed — which
   * presents as the Pay button being permanently stuck disabled. 48px
   * matches the height used in our own dev proof-of-concept (see
   * stripe-poc.tsx), which was confirmed working end-to-end.
   */
  width: 100%;
  height: 48px;
  border: none;
  display: block;
  color-scheme: dark;
}

/*
 * stripe.confirmCardPayment() renders its 3D Secure challenge UI inside
 * the very iframe document Stripe.js was loaded into — that's normally this
 * 48px-tall card-input strip. Left alone, the entire bank challenge (which
 * needs real modal-sized space, per Stripe's own docs) gets crushed into
 * that sliver, silently un-clickable, which presented as the widget hanging
 * forever on "Confirming with your bank…" even though the challenge's own
 * network calls completed fine. This blows the same iframe up into an
 * actual centered modal for the duration of the challenge; .dg-panel-open
 * sets transform: none on every ancestor while a chat panel is open, so
 * position: fixed here is guaranteed to anchor to the real viewport.
 */
.dg-payment-card-iframe--confirming {
  position: fixed !important;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, 92vw);
  height: min(620px, 85vh);
  z-index: 2147483010;
  border-radius: var(--dg-radius-lg);
  box-shadow: var(--dg-shadow-lg);
  background: #ffffff;
}

.dg-payment-confirming-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483009;
  background: rgba(8, 10, 14, 0.72);
  backdrop-filter: blur(2px);
}

.dg-payment-submit {
  width: 100%;
  justify-content: center;
}

.dg-payment-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.dg-payment-secure-note {
  margin: 0;
  font-size: 0.68rem;
  color: var(--dg-text-secondary);
  opacity: 0.8;
  text-align: center;
}

.dg-order-confirmation {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.6rem;
  padding: 2rem 1.25rem;
}

.dg-order-confirmation-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dg-success-soft);
  color: var(--dg-success);
}

.dg-order-confirmation h4 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--dg-text);
}

.dg-order-confirmation p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--dg-text-secondary);
  max-width: 26rem;
}

.dg-cart-checkout-link {
  width: 100%;
}

.dg-cart-view-note {
  margin: 0;
  font-size: 0.68rem;
  color: var(--dg-muted);
  line-height: 1.4;
  text-align: center;
}

/* ---------- Messages ---------- */

.dg-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(101, 210, 213, 0.09), transparent 45%),
    radial-gradient(circle at 0% 100%, rgba(101, 210, 213, 0.05), transparent 50%),
    var(--dg-bg);
  scroll-behavior: smooth;
}

.dg-messages::-webkit-scrollbar {
  width: 8px;
}

.dg-messages::-webkit-scrollbar-thumb {
  background: var(--dg-border-strong);
  border-radius: var(--dg-radius-full);
}

.dg-messages::-webkit-scrollbar-track {
  background: transparent;
}

/* ---------- Empty / welcome state ---------- */

.dg-empty {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--dg-muted);
  padding: 1.5rem 0.5rem;
  gap: 0.9rem;
  animation: dg-fade-up var(--dg-dur-slow) var(--dg-ease-out);
}

.dg-empty-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--dg-radius-lg);
  display: grid;
  place-items: center;
  background: linear-gradient(150deg, rgba(101, 210, 213, 0.18), rgba(101, 210, 213, 0.04));
  border: 1px solid rgba(101, 210, 213, 0.28);
  color: var(--dg-accent);
}

.dg-empty h3 {
  margin: 0;
  color: var(--dg-text);
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.dg-empty p {
  margin: 0;
  font-size: 0.87rem;
  max-width: 30ch;
  line-height: 1.5;
}

.dg-empty-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.dg-chip {
  appearance: none;
  border: 1px solid var(--dg-border-strong);
  background: var(--dg-surface);
  color: var(--dg-text-secondary);
  border-radius: var(--dg-radius-full);
  padding: 0.55rem 0.95rem;
  font-size: 0.79rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dg-dur-fast) ease, color var(--dg-dur-fast) ease, transform var(--dg-dur-fast) ease,
    background var(--dg-dur-fast) ease;
}

.dg-chip:hover {
  border-color: var(--dg-accent);
  color: var(--dg-accent-light);
  background: var(--dg-accent-soft);
  transform: translateY(-1px);
}

.dg-chip:active {
  transform: translateY(0) scale(0.97);
}

/* ---------- Message rows ---------- */

.dg-message-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 100%;
  animation: dg-fade-up var(--dg-dur-slow) var(--dg-ease-out);
}

.dg-message-row-user {
  flex-direction: row-reverse;
}

.dg-avatar {
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(101, 210, 213, 0.35);
  background: var(--dg-surface-2);
}

.dg-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dg-message {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-width: 84%;
  min-width: 0;
}

.dg-message-row-user .dg-message {
  align-items: flex-end;
}

.dg-bubble {
  padding: 0.68rem 0.9rem;
  border-radius: var(--dg-radius-lg);
  font-size: 0.9rem;
  word-break: break-word;
}

.dg-bubble-user {
  background: linear-gradient(135deg, var(--dg-accent), var(--dg-accent-dark));
  color: #0a1213;
  border-bottom-right-radius: 6px;
  box-shadow: 0 4px 14px rgba(101, 210, 213, 0.22);
}

.dg-bubble-assistant {
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
  border-bottom-left-radius: 6px;
  box-shadow: var(--dg-shadow-sm);
}

.dg-bubble a {
  color: #9ee8ea;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dg-bubble-user a {
  color: #05282a;
}

.dg-msg-line {
  margin: 0;
  white-space: pre-wrap;
}

.dg-msg-line + .dg-msg-line {
  margin-top: 0.3rem;
}

.dg-msg-spacer {
  height: 0.5rem;
}

.dg-msg-list {
  margin: 0.15rem 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dg-msg-list li {
  white-space: pre-wrap;
}

.dg-cursor {
  display: inline-block;
  width: 0.5em;
  height: 1em;
  vertical-align: text-bottom;
  background: currentColor;
  margin-left: 2px;
  animation: dg-caret-blink 0.9s step-end infinite;
  border-radius: 1px;
}

@keyframes dg-caret-blink {
  0%, 45% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

@keyframes dg-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Products ---------- */

.dg-products {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
}

.dg-product-card {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 0.8rem;
  padding: 0.75rem;
  border-radius: var(--dg-radius-lg);
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
  transition: transform var(--dg-dur-fast) var(--dg-ease-out), border-color var(--dg-dur-fast) ease,
    box-shadow var(--dg-dur-fast) ease;
}

.dg-product-card:hover {
  transform: translateY(-2px);
  border-color: var(--dg-border-strong);
  box-shadow: var(--dg-shadow-sm);
}

.dg-product-image-wrap {
  width: 84px;
  height: 84px;
  border-radius: var(--dg-radius-md);
  overflow: hidden;
  background: #0c0e11;
  border: 1px solid var(--dg-border);
  flex-shrink: 0;
}

.dg-product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dg-dur-slow) var(--dg-ease-out);
}

.dg-product-card:hover .dg-product-image {
  transform: scale(1.06);
}

.dg-product-image-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--dg-muted);
  font-size: 0.64rem;
  text-align: center;
  padding: 0.25rem;
}

.dg-product-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.dg-product-title {
  margin: 0;
  font-size: 0.83rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--dg-text);
}

.dg-product-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.dg-price-group {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}

.dg-price {
  font-size: 1rem;
  font-weight: 800;
  color: var(--dg-accent-light);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.dg-price-sale {
  font-size: 0.76rem;
  color: var(--dg-muted);
  text-decoration: line-through;
  font-variant-numeric: tabular-nums;
}

.dg-stock {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: var(--dg-radius-full);
  padding: 0.2rem 0.55rem 0.2rem 0.45rem;
}

.dg-stock::before {
  content: "";
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.dg-stock-instock {
  background: var(--dg-success-soft);
  color: #86efac;
}

.dg-stock-outofstock {
  background: var(--dg-danger-soft);
  color: #fca5a5;
}

.dg-stock-onbackorder {
  background: var(--dg-warning-soft);
  color: #fcd34d;
}

.dg-fitment {
  margin: 0;
  font-size: 0.73rem;
  color: var(--dg-muted);
  line-height: 1.4;
}

.dg-product-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.1rem;
}

.dg-product-error {
  margin: 0.3rem 0 0;
  font-size: 0.72rem;
  color: #fca5a5;
}

/* ---------- Buttons ---------- */

.dg-btn {
  appearance: none;
  border: none;
  border-radius: var(--dg-radius-md);
  padding: 0.5rem 0.8rem;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.15rem;
  transition: background var(--dg-dur-fast) ease, color var(--dg-dur-fast) ease, transform var(--dg-dur-fast) ease,
    border-color var(--dg-dur-fast) ease, box-shadow var(--dg-dur-fast) ease;
}

.dg-btn:active {
  transform: scale(0.96);
}

.dg-btn-icon {
  flex-shrink: 0;
}

.dg-btn-primary {
  background: var(--dg-cta);
  color: var(--dg-on-cta);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset;
}

.dg-btn-primary:hover:not(:disabled) {
  background: var(--dg-cta-hover);
}

.dg-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.dg-btn-success {
  background: var(--dg-success);
  color: #06281a;
  animation: dg-btn-pop var(--dg-dur-base) var(--dg-ease-spring);
}

@keyframes dg-btn-pop {
  0% { transform: scale(0.9); }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.dg-btn-secondary {
  background: transparent;
  color: var(--dg-text);
  border: 1px solid var(--dg-border-strong);
}

.dg-btn-secondary:hover:not(:disabled) {
  border-color: var(--dg-accent);
  color: var(--dg-accent);
}

.dg-btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.dg-spinner {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: currentColor;
  animation: dg-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes dg-spin {
  to { transform: rotate(360deg); }
}

/* ---------- Typing indicator ---------- */

.dg-typing-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  animation: dg-fade-up var(--dg-dur-slow) var(--dg-ease-out);
}

.dg-typing {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--dg-muted);
  font-size: 0.82rem;
  padding: 0.6rem 0.9rem;
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
  border-radius: var(--dg-radius-lg);
  border-bottom-left-radius: 6px;
}

.dg-typing-dots {
  display: inline-flex;
  gap: 0.22rem;
}

.dg-typing-dots span {
  width: 0.36rem;
  height: 0.36rem;
  border-radius: 50%;
  background: var(--dg-accent);
  animation: dg-bounce 1.1s infinite ease-in-out;
}

.dg-typing-dots span:nth-child(2) {
  animation-delay: 0.14s;
}

.dg-typing-dots span:nth-child(3) {
  animation-delay: 0.28s;
}

@keyframes dg-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}

/* ---------- Composer ---------- */

.dg-composer {
  border-top: 1px solid var(--dg-border);
  background: var(--dg-surface);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex-shrink: 0;
}

.dg-input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.55rem;
}

.dg-input {
  flex: 1;
  min-height: 2.75rem;
  max-height: 6.5rem;
  resize: none;
  border-radius: var(--dg-radius-md);
  border: 1px solid var(--dg-border-strong);
  background: var(--dg-bg-soft);
  color: var(--dg-text);
  padding: 0.7rem 0.85rem;
  font: inherit;
  font-size: 0.9rem;
  transition: border-color var(--dg-dur-fast) ease, box-shadow var(--dg-dur-fast) ease;
}

.dg-input::placeholder {
  color: var(--dg-muted);
}

.dg-input:focus {
  outline: none;
  border-color: var(--dg-accent);
  box-shadow: 0 0 0 3px var(--dg-accent-soft);
}

.dg-send {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--dg-radius-md);
  border: none;
  background: var(--dg-cta);
  color: var(--dg-on-cta);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dg-dur-fast) ease, transform var(--dg-dur-fast) ease;
}

.dg-send:hover:not(:disabled) {
  background: var(--dg-cta-hover);
}

.dg-send:active:not(:disabled) {
  transform: scale(0.92);
}

.dg-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dg-disclaimer {
  margin: 0;
  font-size: 0.68rem;
  color: var(--dg-muted);
  line-height: 1.4;
}

.dg-error {
  margin: 0;
  font-size: 0.75rem;
  color: #fca5a5;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* ---------- Cart toast ---------- */

.dg-cart-toast {
  position: fixed;
  right: max(1.1rem, env(safe-area-inset-right));
  bottom: max(5.75rem, calc(1.3rem + env(safe-area-inset-bottom)));
  z-index: 2147483002;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: min(320px, calc(100vw - 2rem));
  max-width: min(360px, calc(100vw - 2rem));
  padding: 0.9rem 1.05rem;
  border-radius: var(--dg-radius-lg);
  border: 1px solid rgba(52, 211, 153, 0.35);
  background: linear-gradient(135deg, #14261d 0%, #101215 100%);
  box-shadow: var(--dg-shadow-md);
  animation: dg-toast-in var(--dg-dur-base) var(--dg-ease-spring);
}

.dg-cart-toast-exiting {
  animation: dg-toast-out var(--dg-dur-fast) var(--dg-ease-in) forwards;
}

.dg-cart-toast-icon {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: var(--dg-success-soft);
  color: var(--dg-success);
  flex-shrink: 0;
}

.dg-cart-toast-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dg-cart-toast-copy strong {
  font-size: 0.84rem;
  color: var(--dg-text);
}

.dg-cart-toast-copy span:last-child {
  font-size: 0.75rem;
  color: var(--dg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes dg-toast-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes dg-toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.97); }
}

/* ---------- Mobile ---------- */

@media (max-width: 640px) {
  .dg-cart-toast {
    top: max(1rem, env(safe-area-inset-top));
    right: 1rem;
    left: 1rem;
    bottom: auto;
    max-width: none;
  }

  .dg-launcher-text {
    display: none;
  }

  .dg-launcher {
    width: 3.6rem;
    height: 3.6rem;
    padding: 0.5rem;
    justify-content: center;
    border-radius: var(--dg-radius-xl);
    bottom: calc(var(--dg-mobile-bottom-offset) + max(1.1rem, env(safe-area-inset-bottom)));
  }

  .dg-launcher-icon-wrap {
    width: 2.6rem;
    height: 2.6rem;
  }

  .dg-header {
    padding: 0.85rem 1rem 0.8rem;
  }

  .dg-messages {
    padding: 1rem 0.9rem;
  }

  .dg-message {
    max-width: 90%;
  }

  .dg-composer {
    padding-bottom: max(0.85rem, env(safe-area-inset-bottom));
  }

  .dg-btn,
  .dg-chip {
    min-height: 2.75rem;
  }
}

/* ---------- Reduced motion ---------- */

@media (prefers-reduced-motion: reduce) {
  .dg-root *,
  .dg-root *::before,
  .dg-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .dg-launcher-icon-wrap::before {
    display: none;
  }
}
`;
