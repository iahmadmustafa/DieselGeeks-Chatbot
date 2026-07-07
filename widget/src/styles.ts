export const WIDGET_CSS = `
:host, * {
  box-sizing: border-box;
}

.dg-root {
  --dg-bg: #111315;
  --dg-surface: #1c1f24;
  --dg-surface-2: #252a31;
  --dg-border: #343b45;
  --dg-text: #f3f4f6;
  --dg-muted: #9aa3af;
  --dg-accent: #65D2D5;
  --dg-accent-dark: #4bb8bb;
  --dg-accent-glow: rgba(101, 210, 213, 0.35);
  --dg-cta: #111111;
  --dg-cta-hover: #2a2a2a;
  --dg-success: #22c55e;
  --dg-danger: #ef4444;
  --dg-warning: #f59e0b;
  --dg-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--dg-text);
  line-height: 1.45;
}

.dg-launcher {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 2147483000;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(101, 210, 213, 0.45);
  background: linear-gradient(135deg, #1a1d22 0%, #111315 100%);
  color: var(--dg-text);
  border-radius: 999px;
  padding: 0.8rem 1.1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.dg-launcher:hover {
  transform: translateY(-2px);
  border-color: var(--dg-accent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.4), 0 0 24px var(--dg-accent-glow);
}

.dg-launcher-logo {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.dg-launcher-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
}

.dg-launcher-title {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.dg-launcher-subtitle {
  font-size: 0.72rem;
  color: var(--dg-muted);
}

.dg-panel {
  position: fixed;
  z-index: 2147483001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dg-bg);
  border: 1px solid var(--dg-border);
  box-shadow: var(--dg-shadow);
}

.dg-panel-desktop {
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(5.5rem, calc(1rem + env(safe-area-inset-bottom)));
  width: min(420px, calc(100vw - 2rem));
  height: min(680px, calc(100vh - 7rem));
  border-radius: 18px;
}

.dg-panel-mobile {
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.dg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1rem 0.85rem;
  background: linear-gradient(180deg, #1a2425 0%, #1c1f24 100%);
  border-bottom: 1px solid var(--dg-border);
}

.dg-header-brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.dg-header-logo {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(101, 210, 213, 0.35);
  flex-shrink: 0;
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
  font-size: 0.98rem;
  font-weight: 700;
}

.dg-header-subtitle {
  margin: 0.15rem 0 0;
  font-size: 0.74rem;
  color: var(--dg-muted);
}

.dg-icon-btn {
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--dg-border);
  border-radius: 10px;
  background: var(--dg-surface);
  color: var(--dg-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.dg-icon-btn:hover {
  color: var(--dg-text);
  border-color: #4b5563;
}

.dg-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background:
    radial-gradient(circle at top right, rgba(101, 210, 213, 0.08), transparent 45%),
    var(--dg-bg);
}

.dg-empty {
  margin: auto 0;
  text-align: center;
  color: var(--dg-muted);
  padding: 1rem 0.5rem;
}

.dg-empty h3 {
  margin: 0 0 0.45rem;
  color: var(--dg-text);
  font-size: 1rem;
}

.dg-empty p {
  margin: 0;
  font-size: 0.86rem;
}

.dg-message {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-width: 92%;
}

.dg-message-user {
  align-self: flex-end;
}

.dg-message-assistant {
  align-self: flex-start;
}

.dg-bubble {
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.dg-bubble-user {
  background: linear-gradient(135deg, #65D2D5, #4bb8bb);
  color: #0f1419;
  border-bottom-right-radius: 4px;
}

.dg-bubble-assistant {
  background: var(--dg-surface);
  border: 1px solid var(--dg-border);
  border-bottom-left-radius: 4px;
}

.dg-bubble a {
  color: #9ee8ea;
}

.dg-products {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.dg-product-card {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 0.7rem;
  padding: 0.7rem;
  border-radius: 12px;
  background: var(--dg-surface-2);
  border: 1px solid var(--dg-border);
}

.dg-product-image-wrap {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  background: #0f1114;
  border: 1px solid var(--dg-border);
}

.dg-product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dg-product-image-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--dg-muted);
  font-size: 0.65rem;
  text-align: center;
  padding: 0.25rem;
}

.dg-product-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dg-product-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.3;
}

.dg-product-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.dg-price {
  font-size: 0.95rem;
  font-weight: 700;
  color: #b8eef0;
}

.dg-price-sale {
  font-size: 0.75rem;
  color: var(--dg-muted);
  text-decoration: line-through;
}

.dg-stock {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
}

.dg-stock-instock {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.dg-stock-outofstock {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.dg-stock-onbackorder {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
}

.dg-fitment {
  margin: 0;
  font-size: 0.72rem;
  color: var(--dg-muted);
  line-height: 1.35;
}

.dg-product-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.dg-btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dg-btn-primary {
  background: var(--dg-cta);
  color: #ffffff;
}

.dg-btn-primary:hover {
  background: var(--dg-cta-hover);
}

.dg-btn-secondary {
  background: transparent;
  color: var(--dg-text);
  border: 1px solid var(--dg-border);
}

.dg-btn-secondary:hover {
  border-color: var(--dg-accent);
  color: var(--dg-accent);
}

.dg-typing {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--dg-muted);
  font-size: 0.8rem;
  padding: 0.35rem 0.1rem;
}

.dg-typing-dots {
  display: inline-flex;
  gap: 0.2rem;
}

.dg-typing-dots span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--dg-accent);
  animation: dg-bounce 1.2s infinite ease-in-out;
}

.dg-typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.dg-typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dg-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
  40% { transform: translateY(-4px); opacity: 1; }
}

.dg-composer {
  border-top: 1px solid var(--dg-border);
  background: var(--dg-surface);
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.dg-input-row {
  display: flex;
  gap: 0.55rem;
}

.dg-input {
  flex: 1;
  min-height: 2.6rem;
  max-height: 6rem;
  resize: none;
  border-radius: 12px;
  border: 1px solid var(--dg-border);
  background: var(--dg-bg);
  color: var(--dg-text);
  padding: 0.65rem 0.8rem;
  font: inherit;
  font-size: 0.88rem;
}

.dg-input:focus {
  outline: none;
  border-color: rgba(101, 210, 213, 0.65);
  box-shadow: 0 0 0 3px rgba(101, 210, 213, 0.15);
}

.dg-send {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 12px;
  border: none;
  background: var(--dg-cta);
  color: #ffffff;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.dg-send:hover:not(:disabled) {
  background: var(--dg-cta-hover);
}

.dg-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dg-disclaimer {
  margin: 0;
  font-size: 0.68rem;
  color: var(--dg-muted);
  line-height: 1.35;
}

.dg-error {
  margin: 0;
  font-size: 0.75rem;
  color: #fca5a5;
}

@media (max-width: 640px) {
  .dg-launcher-text {
    display: none;
  }

  .dg-launcher {
    width: 3.4rem;
    height: 3.4rem;
    padding: 0.35rem;
    justify-content: center;
    border-radius: 16px;
  }

  .dg-launcher-logo {
    width: 2.4rem;
    height: 2.4rem;
  }
}
`;
