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
  grid-template-columns: 52px 1fr auto auto;
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

.dg-cart-item-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--dg-radius-sm);
  background: transparent;
  color: var(--dg-muted);
  cursor: pointer;
  transition: color var(--dg-dur-fast) var(--dg-ease-out), background var(--dg-dur-fast) var(--dg-ease-out),
    border-color var(--dg-dur-fast) var(--dg-ease-out);
}

.dg-cart-item-remove:hover:not(:disabled) {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.3);
}

.dg-cart-item-remove:disabled {
  cursor: default;
  opacity: 0.6;
}

.dg-notify-btn {
  color: var(--dg-danger);
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.08);
}

.dg-notify-btn:hover {
  color: #fff;
  background: var(--dg-danger);
  border-color: var(--dg-danger);
  transform: translateY(-1px);
}

/* ---------- Notify-me-when-in-stock modal ---------- */

/*
 * position: fixed so this always covers the real viewport regardless of
 * where the triggering product card sits (floating corner panel or the
 * full-bleed hero) — same reasoning as .dg-payment-confirming-backdrop.
 */
.dg-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483005;
  background: rgba(6, 8, 11, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  animation: dg-modal-fade-in var(--dg-dur-base) var(--dg-ease-out);
}

@keyframes dg-modal-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dg-modal {
  position: relative;
  width: 100%;
  max-width: 26rem;
  max-height: min(88vh, 640px);
  overflow-y: auto;
  background: linear-gradient(165deg, var(--dg-surface-2) 0%, var(--dg-surface) 100%);
  border: 1px solid var(--dg-border-strong);
  border-radius: var(--dg-radius-lg);
  box-shadow: var(--dg-shadow-lg);
  padding: 1.75rem 1.5rem 1.5rem;
  animation: dg-modal-pop-in var(--dg-dur-slow) var(--dg-ease-spring);
}

@keyframes dg-modal-pop-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dg-modal-close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: var(--dg-radius-full);
  border: 1px solid var(--dg-border);
  background: var(--dg-surface);
  color: var(--dg-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color var(--dg-dur-fast) ease, border-color var(--dg-dur-fast) ease;
}

.dg-modal-close:hover {
  color: var(--dg-text);
  border-color: var(--dg-border-strong);
}

.dg-modal-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dg-danger-soft);
  color: var(--dg-danger);
  margin: 0 auto 0.9rem;
}

.dg-modal-title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--dg-text);
  text-align: center;
}

.dg-modal-subtitle {
  margin: 0 0 1.3rem;
  font-size: 0.83rem;
  color: var(--dg-text-secondary);
  text-align: center;
  line-height: 1.5;
}

.dg-modal-subtitle strong {
  color: var(--dg-text);
}

.dg-modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.dg-modal-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.dg-modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--dg-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.dg-modal-field input,
.dg-modal-field textarea {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  color: var(--dg-text);
  background: var(--dg-bg-soft);
  border: 1px solid var(--dg-border-strong);
  border-radius: var(--dg-radius-sm);
  padding: 0.6rem 0.7rem;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  transition: border-color var(--dg-dur-fast) ease, box-shadow var(--dg-dur-fast) ease;
}

.dg-modal-field input::placeholder,
.dg-modal-field textarea::placeholder {
  color: var(--dg-muted);
}

.dg-modal-field input:focus,
.dg-modal-field textarea:focus {
  outline: none;
  border-color: var(--dg-accent);
  box-shadow: 0 0 0 3px var(--dg-accent-soft);
}

.dg-modal-submit {
  width: 100%;
  justify-content: center;
  margin-top: 0.3rem;
}

.dg-modal-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.dg-modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0 0.25rem;
}

.dg-modal-success h3 {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--dg-text);
}

.dg-modal-success p {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  color: var(--dg-text-secondary);
}

@media (max-width: 480px) {
  .dg-modal-field-row {
    grid-template-columns: 1fr;
  }
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
  align-items: center;
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

/*
 * Was width: 100% — stretched into a very wide but still ~2.15rem-tall
 * bar (the .dg-btn default height), which read as an oddly thin banner
 * rather than a normal button. A compact, centered secondary button matches
 * every other button in the cart view instead of visually dominating it.
 */
.dg-cart-checkout-link {
  width: auto;
}

.dg-cart-view-note {
  margin: 0;
  font-size: 0.68rem;
  text-align: center;
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
  /*
   * No scroll-behavior: smooth here on purpose. scrollIntoView({ behavior:
   * "auto" }) in ChatThread.tsx still respects this CSS property, so leaving
   * it "smooth" would keep animating (and re-queuing/colliding) every one of
   * the many auto-scrolls fired per second while a reply streams in — the
   * exact "vibrating" jitter that behavior: "auto" is meant to eliminate.
   */
  scroll-behavior: auto;
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

/*
 * Swaps into the send button's exact slot while a response streams (see
 * ChatThread.tsx) instead of the old full-width "Stop response" button below
 * the composer — same small square footprint as send, just a stop icon and
 * a danger tint so it doesn't read as another send action.
 */
.dg-stop-btn {
  background: var(--dg-danger-soft);
  color: var(--dg-danger);
}

.dg-stop-btn:hover {
  background: rgba(248, 113, 113, 0.24);
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

/* ---------- Hero (homepage inline chat) ---------- */

/*
 * Mounted in place of the old front-page slider (see index.tsx / HeroChat.tsx).
 * Unlike the floating corner panel, this fills whatever box Elementor gives
 * it — bounded to a fixed height so an expanding conversation scrolls inside
 * itself instead of growing the page, per the "only in that section" brief.
 *
 * The actual photo (public/dg-hero-bg.png, built from src/assests/background.png)
 * is set as an inline style from HeroChat.tsx, since it needs the per-site
 * apiBase to build its URL — this file only supplies the dark fallback color
 * (shown before the photo loads / if it's ever missing) plus the ::before
 * color-wash + edge vignette that sits on top of the photo for legibility.
 */
.dg-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  /*
   * Must be a hard, definite height — not min-height, and not 100% unless
   * every ancestor up the chain also has a definite height (which an
   * Elementor container usually doesn't unless a fixed height is explicitly
   * set, only "min-height: 100vh" or similar). Get either of those wrong and
   * flexbox no longer has a real height to divide up: .dg-messages's own
   * flex: 1; overflow-y: auto can't compute a bounded box to scroll inside,
   * so instead of scrolling internally the whole section (and the page
   * under it) just kept growing taller with every message — the composer
   * visibly sliding further down the page instead of staying pinned. A
   * fixed height here guarantees a real internal scroll area no matter what
   * wraps it.
   */
  height: min(88vh, 820px);
  overflow: hidden;
  color: var(--dg-text);
  background-color: #05070a;
}

/*
 * No dimming/tint in the idle state — the photo shows at full brightness
 * (headline/subtitle already carry their own text-shadow for legibility).
 * The darkening wash only kicks in once a conversation starts, via
 * .dg-hero-active::before below, since that's when a full column of message
 * text needs to sit on top of the photo and stay readable.
 */
.dg-hero-active::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  /*
   * Overall dark wash for message text legibility, a brand-color
   * (teal/amber) tint tying the photo to the rest of the widget, and a
   * left/right vignette, all layered here so it paints as one pass, below
   * the real expanded content.
   */
  background: linear-gradient(180deg, rgba(4, 6, 9, 0.32) 0%, rgba(5, 7, 10, 0.52) 45%, rgba(8, 6, 4, 0.72) 100%),
    radial-gradient(ellipse 65% 60% at 12% 16%, rgba(101, 210, 213, 0.16), transparent 62%),
    radial-gradient(ellipse 65% 60% at 88% 12%, rgba(101, 210, 213, 0.12), transparent 62%),
    radial-gradient(ellipse 90% 55% at 50% 78%, rgba(255, 159, 87, 0.2), transparent 68%),
    radial-gradient(ellipse 58% 95% at 2% 55%, rgba(0, 0, 0, 0.45), transparent 72%),
    radial-gradient(ellipse 58% 95% at 98% 55%, rgba(0, 0, 0, 0.45), transparent 72%);
}

.dg-hero-idle {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1.15rem;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1.25rem;
}

/*
 * Same "live"/pulsing signal-ring treatment as the corner launcher's icon
 * (.dg-launcher-icon-wrap::before + dg-ring-pulse) so the hero's idle icon
 * reads the same way — an actively listening assistant, not a static logo.
 */
.dg-hero-idle-icon {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid rgba(101, 210, 213, 0.45);
  box-shadow: 0 0 0 6px rgba(101, 210, 213, 0.1);
}

.dg-hero-idle-icon::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 1.5px solid var(--dg-accent);
  opacity: 0.55;
  animation: dg-ring-pulse 2.6s ease-out infinite;
  pointer-events: none;
}

.dg-hero-idle-icon img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dg-hero-idle-title {
  margin: 0;
  font-size: clamp(1.75rem, 4.2vw, 3rem);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
}

.dg-hero-idle-title span {
  color: var(--dg-accent);
}

.dg-hero-idle-subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--dg-text-secondary);
  max-width: 34rem;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
}

/*
 * Starts a touch smaller/tighter than its "resting" size (see :focus-within
 * below) and grows into full size the moment it's focused — a small bit of
 * interactivity that invites a click, rather than just sitting there static.
 * transform: scale (not just padding) so it visibly "expands" rather than
 * only nudging its own edges.
 */
.dg-hero-input-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  max-width: 34rem;
  padding: 0.4rem 0.4rem 0.4rem 1rem;
  border-radius: var(--dg-radius-full);
  background: rgba(13, 16, 19, 0.82);
  border: 1px solid var(--dg-border-strong);
  box-shadow: var(--dg-shadow-md);
  backdrop-filter: blur(10px);
  transform: scale(0.96);
  transform-origin: center;
  transition: transform var(--dg-dur-slow) var(--dg-ease-spring), padding var(--dg-dur-base) var(--dg-ease-out),
    border-color var(--dg-dur-fast) ease, box-shadow var(--dg-dur-base) ease;
}

.dg-hero-input-row:focus-within {
  transform: scale(1);
  padding: 0.45rem 0.45rem 0.45rem 1.1rem;
  border-color: var(--dg-accent);
  box-shadow: var(--dg-shadow-md), 0 0 0 3px var(--dg-accent-soft), 0 0 26px var(--dg-accent-glow);
}

.dg-hero-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--dg-text);
  font: inherit;
  font-size: 0.95rem;
  padding: 0.55rem 0;
}

.dg-hero-input::placeholder {
  color: var(--dg-muted);
}

/*
 * Overrides the generic .dg-root :focus-visible rule (a hard rectangular
 * outline, fine for most controls but visually jarring on this pill-shaped
 * input). .dg-hero-input-row:focus-within above already supplies an
 * intentional glow, so the input itself just needs its outline suppressed.
 */
.dg-hero-input:focus,
.dg-hero-input:focus-visible {
  outline: none;
}

.dg-hero-send {
  flex-shrink: 0;
}

.dg-hero-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.dg-hero-pill {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(13, 16, 19, 0.55);
  color: var(--dg-text-secondary);
  border-radius: var(--dg-radius-full);
  padding: 0.5rem 0.95rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: border-color var(--dg-dur-fast) ease, color var(--dg-dur-fast) ease, background var(--dg-dur-fast) ease,
    transform var(--dg-dur-fast) ease, box-shadow var(--dg-dur-fast) ease;
}

.dg-hero-pill:hover {
  border-color: var(--dg-accent);
  color: var(--dg-accent-light);
  background: rgba(101, 210, 213, 0.1);
  transform: translateY(-1px);
}

.dg-hero-pill:focus-visible {
  outline: none;
  border-color: var(--dg-accent);
  box-shadow: 0 0 0 3px var(--dg-accent-soft);
}

.dg-hero-pill-active {
  border-color: var(--dg-accent);
  color: #06282a;
  background: var(--dg-accent);
  box-shadow: 0 0 18px var(--dg-accent-glow);
}

.dg-hero-pill-active:hover {
  color: #06282a;
  background: var(--dg-accent);
}

/*
 * Rendered as a direct child of .dg-hero (not the idle/expanded boxes,
 * which only wrap their own centered content) so it always sits inset from
 * the true top-right corner of the whole section — in both idle and
 * expanded states — instead of pinning to the top of whatever small content
 * box happens to be showing. z-index above the idle/expanded panels (both
 * z-index: 1) since it's rendered before them in source order and would
 * otherwise paint underneath.
 */
.dg-hero-corner-actions {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dg-hero-cart-btn,
.dg-hero-close-btn {
  background: rgba(13, 16, 19, 0.65);
  border-color: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
}

.dg-hero-cart-btn:focus-visible,
.dg-hero-close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--dg-accent-soft);
}

/*
 * Only shown once the hero is expanded (see HeroChat.tsx) — closing takes
 * the user back to the idle "ask a question" screen without losing the
 * conversation, which resumes right where it left off on the next message.
 */
.dg-hero-close-btn:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.35);
}

/*
 * Full-bleed takeover of the hero box once a conversation starts — fills
 * 100% of .dg-hero's width/height edge to edge (no floating inset card,
 * no visible margins around it). Its own layers (messages/composer,
 * overridden below) stay translucent over .dg-hero's background instead of
 * painting flat opaque black over it, so the same gradient/glow shows
 * through — dimmed just enough to keep message text readable.
 */
.dg-hero-expanded {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: rgba(6, 8, 11, 0.4);
  backdrop-filter: blur(6px);
  animation: dg-hero-expand var(--dg-dur-slow) var(--dg-ease-out);
}

@keyframes dg-hero-expand {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/*
 * These normally paint an opaque background (right for the floating corner
 * panel); inside the hero's full-bleed takeover they're kept translucent so
 * .dg-hero's gradient/glow stays visible behind the conversation. Width is
 * capped and centered — full-bleed refers to the panel/background, not the
 * message line length, which would otherwise stretch edge-to-edge on a wide
 * screen with barely any breathing room from the left/right edges.
 */
.dg-hero-expanded .dg-messages {
  background: transparent;
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  padding-top: 3.5rem;
}

/*
 * Letting the cart view stay fully transparent (as messages/composer do)
 * left every row — item cards, address inputs, summary — floating directly
 * on whatever's behind the hero with no shared surface to unify them, which
 * read as unstyled plain HTML rather than part of the same interface. Cart
 * content also skews denser/more form-like than chat bubbles, so instead of
 * bleeding through it gets its own solid, centered glass panel — same
 * frosted-card language as .dg-hero-expanded .dg-composer below.
 */
.dg-hero-expanded .dg-cart-view {
  background: transparent;
  align-items: center;
}

.dg-hero-expanded .dg-cart-view-toolbar {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 1.1rem 0.5rem 0.75rem;
  border-bottom: none;
}

.dg-hero-expanded .dg-cart-view-body {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 0 0.5rem 1rem;
}

.dg-hero-expanded .dg-cart-item,
.dg-hero-expanded .dg-cart-shipping,
.dg-hero-expanded .dg-cart-summary,
.dg-hero-expanded .dg-payment-step {
  background: rgba(18, 21, 26, 0.72);
  backdrop-filter: blur(14px);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: var(--dg-shadow-sm);
}

.dg-hero-expanded .dg-cart-shipping-rate {
  background: rgba(21, 24, 29, 0.6);
}

.dg-hero-expanded .dg-cart-address-form input,
.dg-hero-expanded .dg-cart-address-form select {
  background: rgba(10, 12, 14, 0.55);
}

.dg-hero-expanded .dg-order-confirmation {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.dg-hero-expanded .dg-cart-view-footer {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 0.75rem 0.5rem 1.25rem;
  border-top: none;
  background: transparent;
}

/*
 * Centering this at a capped width (see .dg-messages above) turns it into a
 * free-floating card in the middle of the hero rather than a bar flush
 * against a container edge, so — unlike the corner panel's composer, which
 * is flush against that panel's own rounded shell — it needs its own
 * rounded corners, border and shadow or the hard rectangular edges look like
 * a stray, unstyled box sitting on top of the background photo.
 */
.dg-hero-expanded .dg-composer {
  width: 100%;
  max-width: 820px;
  margin: 0 auto 1.25rem;
  border-radius: var(--dg-radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(18, 21, 26, 0.68);
  box-shadow: var(--dg-shadow-md);
  backdrop-filter: blur(14px);
}

/*
 * The plain .dg-input textarea normally carries its own grey border + solid
 * fill (right for the floating corner panel), but nested inside this
 * already-bordered rounded card that reads as an ugly "box within a box".
 * Strip its border/fill so only the card's own rounded edge is visible —
 * same treatment the idle-state pill input already gets.
 */
.dg-hero-expanded .dg-input {
  border-color: transparent;
  background: transparent;
}

.dg-hero-expanded .dg-input:focus {
  border-color: transparent;
  box-shadow: none;
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

  .dg-hero {
    height: min(90vh, 640px);
  }

  .dg-hero-idle {
    padding: 1.5rem 1rem;
    gap: 0.9rem;
  }

  .dg-hero-cart-btn {
    top: -0.4rem;
    right: -0.2rem;
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
