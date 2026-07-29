import * as React from "react";
import { createPortal } from "react-dom";
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from "@stripe/stripe-js";

/**
 * DEV-ONLY proof of concept for the in-chat checkout project.
 *
 * CONFIRMED (via live testing on stage2): Stripe.js explicitly refuses to
 * mount an Element inside a Shadow DOM —
 * `IntegrationError: Elements cannot be mounted in a ShadowRoot. Please
 * mount in the Light DOM.` This is a hard restriction in Stripe's SDK, not
 * an environment/CSP issue. It means the real payment step cannot mount
 * directly inside this widget's shadow root the way the rest of the UI does.
 *
 * This renders three side-by-side mount attempts, to prove the failure and
 * evaluate two possible workarounds in one pass:
 *   1. Inside the widget's Shadow DOM — expected to fail with the error above.
 *   2. Via a React portal to `document.body` (Light DOM) — the workaround
 *      Stripe's own error message suggests. Simple, but exposes the mount
 *      point to the host page's global CSS.
 *   3. Inside a same-origin, `src`-less `<iframe>` created dynamically by
 *      this same bundle — an iframe has its own real `document`, so it
 *      satisfies Stripe's restriction, while staying fully isolated from the
 *      host page's CSS (like Shadow DOM) *and* same-origin (so Store API
 *      calls made from this bundle keep working exactly as they do today,
 *      with no CORS/cookie complications). This is the approach chosen for
 *      the real payment step.
 *
 * All three use Stripe's public documentation test key, not tied to this
 * store's account — this stage only proves DOM mounting mechanics. Stage 3
 * (real payment capture) will use the store's actual test-mode publishable
 * key.
 *
 * Enable by visiting any page with the chat widget loaded and appending
 * `?dgStripePoc=1` to the URL.
 */
const STRIPE_DOCS_TEST_PUBLISHABLE_KEY = "pk_test_TYooMQauvdEDq54NiTphI7jx";

type PocStatus = "loading" | "ready" | "error";

interface CardMountTest {
  status: PocStatus;
  message: string;
  cardComplete: boolean;
  mountRef: React.RefObject<HTMLDivElement | null>;
}

function useCardMountTest(): CardMountTest {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = React.useState<PocStatus>("loading");
  const [message, setMessage] = React.useState("Loading Stripe.js…");
  const [cardComplete, setCardComplete] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let card: StripeCardElement | null = null;

    async function run() {
      try {
        const stripe: Stripe | null = await loadStripe(STRIPE_DOCS_TEST_PUBLISHABLE_KEY);
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
          setMessage("Mount node was not available.");
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

        // Stripe.js can throw *synchronously* here (e.g. the ShadowRoot
        // restriction) rather than only via a rejected promise — this whole
        // block being inside the outer try/catch is what turns that into a
        // visible error state instead of an uncaught rejection that leaves
        // the panel stuck on "Loading..." forever.
        card.mount(mountRef.current);

        card.on("ready", () => {
          if (!cancelled) {
            setStatus("ready");
            setMessage("Mounted successfully.");
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
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Unknown error mounting Stripe Elements.");
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      try {
        card?.unmount();
      } catch {
        // Element's root node may already be gone — nothing to clean up.
      }
    };
  }, []);

  return { status, message, cardComplete, mountRef };
}

interface IframeCardMountTest {
  status: PocStatus;
  message: string;
  cardComplete: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

function useIframeCardMountTest(): IframeCardMountTest {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = React.useState<PocStatus>("loading");
  const [message, setMessage] = React.useState("Loading Stripe.js…");
  const [cardComplete, setCardComplete] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let card: StripeCardElement | null = null;

    async function run() {
      try {
        const iframe = iframeRef.current;
        const iframeDoc = iframe?.contentDocument;
        if (!iframe || !iframeDoc) {
          setStatus("error");
          setMessage("Could not access the iframe's document.");
          return;
        }

        // A src-less iframe is same-origin by default and gets its own real
        // (empty) document immediately — no navigation/load event needed.
        // We give it minimal styling since it doesn't inherit any page CSS.
        const style = iframeDoc.createElement("style");
        style.textContent =
          "body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }" +
          "#mount { padding: 10px 12px; border-radius: 8px; border: 1px solid #3a4149; background: #0d1013; }";
        iframeDoc.head.appendChild(style);

        const mountNode = iframeDoc.createElement("div");
        mountNode.id = "mount";
        iframeDoc.body.appendChild(mountNode);

        const stripe: Stripe | null = await loadStripe(STRIPE_DOCS_TEST_PUBLISHABLE_KEY);
        if (cancelled) {
          return;
        }

        if (!stripe) {
          setStatus("error");
          setMessage("Stripe.js failed to initialize (loadStripe returned null).");
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

        card.mount(mountNode);

        card.on("ready", () => {
          if (!cancelled) {
            setStatus("ready");
            setMessage("Mounted successfully inside a same-origin blank iframe.");
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
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Unknown error mounting Stripe Elements.");
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      try {
        card?.unmount();
      } catch {
        // Element's root node may already be gone — nothing to clean up.
      }
    };
  }, []);

  return { status, message, cardComplete, iframeRef };
}

function PocPanel({ title, hint, test }: { title: string; hint: string; test: CardMountTest }) {
  return (
    <div
      style={{
        width: "300px",
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
      <p style={{ margin: "0 0 0.15rem", fontWeight: 700 }}>{title}</p>
      <p style={{ margin: "0 0 0.6rem", color: "#8b93a1", fontSize: "11px" }}>{hint}</p>
      <div
        ref={test.mountRef}
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
          color: test.status === "error" ? "#f87171" : test.status === "ready" ? "#34d399" : "#8b93a1",
        }}
      >
        {test.status === "loading" ? "⏳ " : test.status === "ready" ? "✅ " : "❌ "}
        {test.message}
      </p>
      {test.status === "ready" ? (
        <p style={{ margin: "0.35rem 0 0", color: "#8b93a1" }}>
          Card input complete: {test.cardComplete ? "yes" : "no"}. Try 4242 4242 4242 4242, any
          future date, any CVC.
        </p>
      ) : null}
    </div>
  );
}

function IframePocPanel({ title, hint, test }: { title: string; hint: string; test: IframeCardMountTest }) {
  return (
    <div
      style={{
        width: "300px",
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
      <p style={{ margin: "0 0 0.15rem", fontWeight: 700 }}>{title}</p>
      <p style={{ margin: "0 0 0.6rem", color: "#8b93a1", fontSize: "11px" }}>{hint}</p>
      <iframe
        ref={test.iframeRef}
        title="Stripe Elements iframe mount test"
        style={{ width: "100%", height: "48px", border: "none", display: "block" }}
      />
      <p
        style={{
          margin: "0.6rem 0 0",
          color: test.status === "error" ? "#f87171" : test.status === "ready" ? "#34d399" : "#8b93a1",
        }}
      >
        {test.status === "loading" ? "⏳ " : test.status === "ready" ? "✅ " : "❌ "}
        {test.message}
      </p>
      {test.status === "ready" ? (
        <p style={{ margin: "0.35rem 0 0", color: "#8b93a1" }}>
          Card input complete: {test.cardComplete ? "yes" : "no"}. Try 4242 4242 4242 4242, any
          future date, any CVC.
        </p>
      ) : null}
    </div>
  );
}

export function StripeElementsPoc() {
  const shadowDomTest = useCardMountTest();
  const lightDomTest = useCardMountTest();
  const iframeTest = useIframeCardMountTest();

  return (
    <>
      <div style={{ position: "fixed", top: "1rem", left: "1rem", zIndex: 2147483647 }}>
        <PocPanel
          title="Attempt 1 — inside Shadow DOM"
          hint="Mounted inside the widget's shadow root, same place the rest of this widget's UI lives."
          test={shadowDomTest}
        />
      </div>
      {typeof document !== "undefined"
        ? createPortal(
            <div style={{ position: "fixed", top: "1rem", left: "21rem", zIndex: 2147483647 }}>
              <PocPanel
                title="Attempt 2 — Light DOM portal"
                hint="Mounted via a React portal straight to document.body, outside any Shadow DOM."
                test={lightDomTest}
              />
            </div>,
            document.body,
          )
        : null}
      <div style={{ position: "fixed", top: "1rem", left: "41rem", zIndex: 2147483647 }}>
        <IframePocPanel
          title="Attempt 3 — same-origin blank iframe"
          hint="Mounted inside a src-less <iframe> created by this bundle — the approach chosen for real payment."
          test={iframeTest}
        />
      </div>
    </>
  );
}
