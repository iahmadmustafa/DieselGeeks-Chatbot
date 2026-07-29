import * as React from "react";
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from "@stripe/stripe-js";

/**
 * DEV-ONLY proof of concept for the in-chat checkout project.
 *
 * Question being answered: does Stripe Elements (an iframe-based, PCI-scope
 * card input) mount and behave correctly when injected into our chat
 * widget's Shadow DOM? This intentionally does nothing else — no order
 * creation, no charge, no dependency on the Store API cart work.
 *
 * It uses Stripe's own public documentation test key, which is NOT tied to
 * Diesel Geeks' Stripe account. That is deliberate: this stage only proves
 * the DOM/mounting mechanics, so it must not touch real payment
 * configuration. Stage 3 (actual payment capture) will swap in the store's
 * real test-mode publishable key from
 * WooCommerce → Settings → Payments → Stripe → Test API keys, and will only
 * ever be exercised with Stripe test-mode card numbers.
 *
 * Enable by visiting any page with the chat widget loaded and appending
 * `?dgStripePoc=1` to the URL.
 */
const STRIPE_DOCS_TEST_PUBLISHABLE_KEY = "pk_test_TYooMQauvdEDq54NiTphI7jx";

type PocStatus = "loading" | "ready" | "error";

export function StripeElementsPoc() {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = React.useState<PocStatus>("loading");
  const [message, setMessage] = React.useState("Loading Stripe.js…");
  const [cardComplete, setCardComplete] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let card: StripeCardElement | null = null;

    async function run() {
      let stripe: Stripe | null;
      try {
        stripe = await loadStripe(STRIPE_DOCS_TEST_PUBLISHABLE_KEY);
      } catch (loadError) {
        if (!cancelled) {
          setStatus("error");
          setMessage(loadError instanceof Error ? loadError.message : "Failed to load Stripe.js.");
        }
        return;
      }

      if (cancelled) {
        return;
      }

      if (!stripe) {
        setStatus("error");
        setMessage("Stripe.js failed to initialize (loadStripe returned null).");
        return;
      }

      if (!mountRef.current) {
        setStatus("error");
        setMessage("Mount node was not available (Shadow DOM ref issue).");
        return;
      }

      const elements: StripeElements = stripe.elements({
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#65D2D5",
            colorBackground: "#0d1013",
            colorText: "#f6f7f9",
            borderRadius: "10px",
          },
        },
      });

      card = elements.create("card", {
        style: {
          base: { color: "#f6f7f9", fontSize: "14px", "::placeholder": { color: "#8b93a1" } },
          invalid: { color: "#f87171" },
        },
      });

      card.mount(mountRef.current);

      card.on("ready", () => {
        if (!cancelled) {
          setStatus("ready");
          setMessage("Card Element mounted successfully inside the widget's Shadow DOM.");
        }
      });

      card.on("change", (event) => {
        if (!cancelled) {
          setCardComplete(event.complete);
        }
      });

      card.on("loaderror", (event) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(event.error?.message ?? "Card Element failed to load.");
        }
      });
    }

    void run();

    return () => {
      cancelled = true;
      card?.unmount();
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        left: "1rem",
        zIndex: 2147483647,
        width: "320px",
        padding: "1rem",
        borderRadius: "12px",
        background: "#15181d",
        border: "1px solid #3a4149",
        color: "#f6f7f9",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "13px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ margin: "0 0 0.15rem", fontWeight: 700 }}>Stripe Elements POC — Shadow DOM</p>
      <p style={{ margin: "0 0 0.6rem", color: "#8b93a1", fontSize: "11px" }}>
        Dev-only diagnostic. Uses Stripe&apos;s public test key, not this store&apos;s account.
      </p>
      <div
        ref={mountRef}
        style={{
          padding: "0.65rem 0.75rem",
          borderRadius: "8px",
          border: "1px solid #3a4149",
          background: "#0d1013",
          minHeight: "20px",
        }}
      />
      <p
        style={{
          margin: "0.6rem 0 0",
          color: status === "error" ? "#f87171" : status === "ready" ? "#34d399" : "#8b93a1",
        }}
      >
        {status === "loading" ? "⏳ " : status === "ready" ? "✅ " : "❌ "}
        {message}
      </p>
      {status === "ready" ? (
        <p style={{ margin: "0.35rem 0 0", color: "#8b93a1" }}>
          Try typing a test number (4242 4242 4242 4242, any future date, any CVC). Card input
          complete: {cardComplete ? "yes" : "no"}. No real charge or order is created here.
        </p>
      ) : null}
    </div>
  );
}
