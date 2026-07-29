import * as React from "react";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";

import { resolveStripePublishableKey } from "./config";

const LOG_PREFIX = "[dieselgeeks-chat:stripe]";

/**
 * Stripe.js refuses to mount an Element inside a Shadow DOM (confirmed via
 * the stage-2 proof of concept — `IntegrationError: Elements cannot be
 * mounted in a ShadowRoot`). A same-origin, `src`-less `<iframe>` sidesteps
 * this: it's a real `document` (satisfies Stripe's check) that's still part
 * of this same window/script context (no CORS, no separate hosted page, no
 * postMessage plumbing needed) and gets full CSS isolation from the host
 * page as a bonus. This injects a minimal stylesheet so the mounted Card
 * Element isn't stuck with the browser's unstyled default `<iframe>` body.
 */
function prepareIframeDocument(iframe: HTMLIFrameElement): HTMLElement | null {
  const doc = iframe.contentDocument;
  if (!doc) {
    return null;
  }

  const style = doc.createElement("style");
  style.textContent = "html, body { margin: 0; padding: 0; background: transparent; height: 100%; }";
  doc.head.appendChild(style);

  const mount = doc.createElement("div");
  doc.body.appendChild(mount);
  return mount;
}

export type StripeCardStatus = "unavailable" | "loading" | "ready" | "error";

export interface StripeCardElementState {
  status: StripeCardStatus;
  errorMessage: string | null;
  cardComplete: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Resolves to a `pm_...` PaymentMethod ID, or an error if the card is invalid/declined at this step. */
  createPaymentMethod: (billingDetails: {
    name: string;
    email?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  }) => Promise<{ ok: true; paymentMethodId: string } | { ok: false; error: string }>;
  /** Completes a required 3D Secure / SCA challenge using the PaymentIntent client secret WooCommerce returns. */
  confirmCardPayment: (clientSecret: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

/**
 * Loads Stripe.js and mounts a Card Element inside a same-origin iframe
 * (attach `iframeRef` to a plain `<iframe>` in the tree). Returns everything
 * a payment form needs: mount status, live card-completeness for enabling
 * the submit button, and the two Stripe calls the checkout flow needs
 * (tokenize the card up front, then optionally confirm a 3DS challenge).
 */
export function useStripeCardElement(): StripeCardElementState {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const stripeRef = React.useRef<Stripe | null>(null);
  const cardRef = React.useRef<StripeCardElement | null>(null);
  const [status, setStatus] = React.useState<StripeCardStatus>("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [cardComplete, setCardComplete] = React.useState(false);

  React.useEffect(() => {
    const publishableKey = resolveStripePublishableKey();
    if (!publishableKey) {
      console.error(`${LOG_PREFIX} no publishable key configured — see resolveStripePublishableKey`);
      setStatus("unavailable");
      setErrorMessage("Card payment isn't available right now.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const stripe = await loadStripe(publishableKey as string);
        if (cancelled) {
          return;
        }
        if (!stripe) {
          setStatus("error");
          setErrorMessage("Could not initialize the payment form.");
          return;
        }
        stripeRef.current = stripe;

        const iframe = iframeRef.current;
        const mount = iframe ? prepareIframeDocument(iframe) : null;
        if (!mount) {
          setStatus("error");
          setErrorMessage("Could not prepare the payment form.");
          return;
        }

        const elements = stripe.elements();
        const card = elements.create("card", {
          // Stripe's Card Element includes a postal-code sub-field by
          // default, which stayed invisible in our compact, fixed-height
          // iframe layout but still counted toward "complete" — silently
          // keeping the card permanently incomplete (and the Pay button
          // disabled) no matter what the shopper typed. We already collect
          // the full billing address separately (reused from the shipping
          // step), so this field is redundant — disable it outright.
          hidePostalCode: true,
          // The widget is dark-themed (see design tokens in styles.ts) —
          // Stripe's Card Element defaults to black text, which is invisible
          // against our dark surface unless explicitly overridden here.
          style: {
            base: {
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: "15px",
              color: "#f6f7f9",
              iconColor: "#8b93a1",
              backgroundColor: "transparent",
              "::placeholder": { color: "#8b93a1" },
            },
            invalid: { color: "#f87171", iconColor: "#f87171" },
          },
        });

        // Mirrors the try/catch used in the stage-2 POC: mounting can throw
        // synchronously, and letting that escape would leave the form stuck
        // on "loading" forever instead of showing a clear error.
        card.mount(mount);
        cardRef.current = card;

        function markReady(): void {
          if (!cancelled) {
            setStatus((current) => (current === "loading" ? "ready" : current));
          }
        }

        card.on("ready", markReady);
        card.on("change", (event) => {
          if (cancelled) {
            return;
          }
          // Belt-and-braces: a `change` event firing at all is itself proof
          // the element is mounted and interactive, so treat it as "ready"
          // too. Real-world testing found `ready` didn't reliably fire once
          // the Card Element ended up nested inside our dynamically-created
          // iframe (as opposed to a normal document) — without this, the
          // form stayed stuck showing "Loading payment form…" and the Pay
          // button stayed disabled even though the card was fully typed in.
          markReady();
          setCardComplete(event.complete);
          setErrorMessage(event.error?.message ?? null);
        });

        // Final safety net: if neither event above has fired within a few
        // seconds, but mounting didn't throw, assume it's actually usable
        // rather than leaving the form stuck forever.
        window.setTimeout(markReady, 2500);
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Could not load the payment form.");
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      try {
        cardRef.current?.unmount();
      } catch {
        // Iframe/document may already be gone.
      }
    };
  }, []);

  const createPaymentMethod = React.useCallback<StripeCardElementState["createPaymentMethod"]>(
    async (billingDetails) => {
      const stripe = stripeRef.current;
      const card = cardRef.current;
      if (!stripe || !card) {
        return { ok: false, error: "Payment form isn't ready yet." };
      }

      try {
        const result = await stripe.createPaymentMethod({
          type: "card",
          card,
          billing_details: billingDetails,
        });

        if (result.error) {
          return { ok: false, error: result.error.message ?? "Your card could not be processed." };
        }

        return { ok: true, paymentMethodId: result.paymentMethod.id };
      } catch (error) {
        console.error(`${LOG_PREFIX} createPaymentMethod failed`, error);
        return { ok: false, error: "Your card could not be processed." };
      }
    },
    [],
  );

  const confirmCardPayment = React.useCallback<StripeCardElementState["confirmCardPayment"]>(async (clientSecret) => {
    const stripe = stripeRef.current;
    if (!stripe) {
      return { ok: false, error: "Payment form isn't ready yet." };
    }

    try {
      const result = await stripe.confirmCardPayment(clientSecret);
      if (result.error) {
        return { ok: false, error: result.error.message ?? "Payment could not be confirmed." };
      }
      return { ok: true };
    } catch (error) {
      console.error(`${LOG_PREFIX} confirmCardPayment failed`, error);
      return { ok: false, error: "Payment could not be confirmed." };
    }
  }, []);

  return { status, errorMessage, cardComplete, iframeRef, createPaymentMethod, confirmCardPayment };
}
