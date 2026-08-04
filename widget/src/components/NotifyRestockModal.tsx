import * as React from "react";
import { createPortal } from "react-dom";

import { resolveApiBase } from "../config";
import type { ProductCard } from "../types";
import { CheckIcon, CloseIcon, HeartIcon } from "./Icons";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface NotifyRestockModalProps {
  product: ProductCard;
  onClose: () => void;
}

/**
 * "Notify me when back in stock" — shown from a heart button on out-of-stock
 * product cards (see ProductCard.tsx). Posts to our own Next.js API
 * (/api/notify-restock, not the WooCommerce store) which emails the
 * request to the team; see app/api/notify-restock/route.ts.
 */
export function NotifyRestockModal({ product, onClose }: NotifyRestockModalProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState(
    `Hi, please let me know when "${product.title}" is back in stock. Thanks!`,
  );
  const [status, setStatus] = React.useState<SubmitStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const markerRef = React.useRef<HTMLSpanElement | null>(null);
  const [portalTarget, setPortalTarget] = React.useState<Element | null>(null);

  /*
   * Product cards render deep inside containers that use backdrop-filter
   * (.dg-hero-expanded, .dg-panel, cart cards, etc.) — per spec, any
   * ancestor with a filter/backdrop-filter/transform becomes the
   * containing block for position: fixed descendants instead of the real
   * viewport. That's what caused the "moving up and down" glitch: the
   * modal was fixed to a growing/scrolling chat container, not the
   * screen. Rendering it via a portal straight onto the shadow root's own
   * top-level <div class="dg-root"> — a sibling of everything else, with
   * no filter/transform of its own — makes position: fixed anchor to the
   * actual viewport again.
   */
  React.useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }
    const root = marker.getRootNode();
    if (root instanceof ShadowRoot) {
      setPortalTarget(root.querySelector(".dg-root") ?? root.firstElementChild);
    } else {
      setPortalTarget(document.body);
    }
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const canSubmit = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || status === "submitting") {
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`${resolveApiBase()}/api/notify-restock`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          product: {
            id: product.id,
            title: product.title,
            sku: product.sku,
            permalink: product.permalink,
          },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setError("Network error — please check your connection and try again.");
    }
  }

  const modal = (
    <div className="dg-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dg-modal" role="dialog" aria-modal="true" aria-label="Notify me when back in stock" ref={dialogRef}>
        <button type="button" className="dg-modal-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={14} />
        </button>

        {status === "success" ? (
          <div className="dg-modal-success">
            <span className="dg-order-confirmation-icon" aria-hidden="true">
              <CheckIcon size={26} />
            </span>
            <h3>You&apos;re on the list!</h3>
            <p>We&apos;ll email you at {email} as soon as this is back in stock.</p>
            <button type="button" className="dg-btn dg-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="dg-modal-icon" aria-hidden="true">
              <HeartIcon size={20} filled />
            </div>
            <h3 className="dg-modal-title">Notify me when back in stock</h3>
            <p className="dg-modal-subtitle">
              We&apos;ll email you as soon as <strong>{product.title}</strong> is available again.
            </p>

            <form className="dg-modal-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="dg-modal-field-row">
                <label className="dg-modal-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="dg-modal-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
              </div>

              <label className="dg-modal-field">
                <span>Message (optional)</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
                  rows={3}
                />
              </label>

              {error ? <p className="dg-cart-shipping-error">{error}</p> : null}

              <button
                type="submit"
                className="dg-btn dg-btn-primary dg-modal-submit"
                disabled={!canSubmit || status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <span className="dg-spinner" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  <>
                    <HeartIcon className="dg-btn-icon" size={14} />
                    Notify me
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} aria-hidden="true" />
      {portalTarget ? createPortal(modal, portalTarget) : null}
    </>
  );
}
