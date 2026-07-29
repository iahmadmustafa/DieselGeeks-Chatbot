import * as React from "react";

import {
  confirmCheckoutOrder,
  formatStoreApiMoney,
  readPaymentDetail,
  submitCheckout,
  type StoreApiAddress,
  type StoreApiCart,
  type StoreApiOrder,
  type StoreApiPaymentDataEntry,
} from "../store-api";
import { useStripeCardElement } from "../stripe-client";

const LOG_PREFIX = "[dieselgeeks-chat:payment]";

// WooCommerce Stripe Gateway's exact `payment_details` key for the
// PaymentIntent client secret needed to confirm a 3D Secure challenge isn't
// documented anywhere reliable (see investigation notes) — try the
// candidates real-world integrations use, in order, rather than betting on
// one guess.
const CLIENT_SECRET_KEYS = ["client_secret", "intent_secret", "payment_intent_client_secret"];

function extractClientSecret(order: StoreApiOrder): string | null {
  for (const key of CLIENT_SECRET_KEYS) {
    const value = readPaymentDetail(order.payment_result.payment_details, key);
    if (value) {
      return value;
    }
  }
  return null;
}

/** Splits a single "full name" input into WooCommerce's first/last name fields. */
function splitName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { first_name: trimmed, last_name: "" };
  }
  return { first_name: trimmed.slice(0, spaceIndex), last_name: trimmed.slice(spaceIndex + 1).trim() };
}

function addressFromShipping(shipping: StoreApiAddress, email: string, fullName: string): StoreApiAddress {
  return { ...shipping, ...splitName(fullName), email };
}

/**
 * Builds the full `payment_data` the Stripe gateway's Store API integration
 * expects for its modern "deferred intent" flow (confirmed directly by a
 * WooCommerce engineer: https://github.com/woocommerce/woocommerce/issues/50678#issuecomment-2343957702).
 *
 * We originally sent only `wc-stripe-payment-method`, which isn't enough on
 * its own — without `wc-stripe-new-payment-method` / `wc-stripe-is-deferred-intent`
 * telling the gateway this is a brand-new card (not a saved token lookup),
 * it silently fell back to an empty payment method internally. Confirmed via
 * the site's own Stripe gateway debug log: it logged a "prepared source"
 * object with every field — `token_id`, `source`, `payment_method` — empty,
 * which is exactly what produced the generic "Payment processing failed"
 * error despite a valid `pm_...` ID having been created client-side.
 */
function buildStripePaymentData(paymentMethodId: string, billingAddress: StoreApiAddress): StoreApiPaymentDataEntry[] {
  return [
    { key: "wc-stripe-payment-method", value: paymentMethodId },
    { key: "billing_email", value: billingAddress.email ?? "" },
    { key: "billing_first_name", value: billingAddress.first_name },
    { key: "billing_last_name", value: billingAddress.last_name },
    { key: "payment_method", value: "stripe" },
    { key: "paymentRequestType", value: "cc" },
    { key: "wc-stripe-new-payment-method", value: true },
    { key: "wc-stripe-is-deferred-intent", value: true },
    { key: "save_payment_method", value: "no" },
  ];
}

/**
 * Builds the (deliberately lighter) `payment_data` for the *second* request
 * — confirming an order after a 3D Secure challenge has already succeeded
 * client-side via `stripe.confirmCardPayment`.
 *
 * A live test surfaced a real bug from reusing `buildStripePaymentData` here:
 * `wc-stripe-new-payment-method` / `wc-stripe-is-deferred-intent` tell the
 * gateway to create a *brand-new* PaymentIntent from the given `pm_...` ID.
 * On this second call that's wrong — the order already has an intent that
 * was just 3DS-authenticated. Re-sending those flags caused the gateway to
 * spin up a second, separate intent (which happened to succeed on its own),
 * while the order's actual tracked intent was left unconfirmed — the order
 * itself got stuck on "Pending payment" instead of "Processing" even though
 * the widget correctly reported a successful `payment_status`. Omitting the
 * "treat as new" flags here lets the gateway look up and finalize the
 * existing, already-authenticated intent on the order instead.
 */
function buildStripeConfirmPaymentData(paymentMethodId: string, billingAddress: StoreApiAddress): StoreApiPaymentDataEntry[] {
  return [
    { key: "wc-stripe-payment-method", value: paymentMethodId },
    { key: "billing_email", value: billingAddress.email ?? "" },
    { key: "billing_first_name", value: billingAddress.first_name },
    { key: "billing_last_name", value: billingAddress.last_name },
    { key: "payment_method", value: "stripe" },
    { key: "paymentRequestType", value: "cc" },
  ];
}

type PaymentStatus = "idle" | "submitting" | "confirming" | "error";

interface PaymentStepProps {
  cart: StoreApiCart;
  onOrderComplete: (order: StoreApiOrder) => void;
}

/**
 * Stage 3 of in-chat checkout: collects contact details + card via a
 * same-origin-iframe-hosted Stripe Card Element, then submits the order
 * through the Store API's `/checkout` endpoint. Billing address is reused
 * from the shipping address already collected in stage 2 to keep the form
 * short — Diesel Geeks ships within Australia only, so this is a reasonable
 * default rather than a hidden assumption for most shoppers.
 */
export function PaymentStep({ cart, onOrderComplete }: PaymentStepProps) {
  const stripeCard = useStripeCardElement();
  const [email, setEmail] = React.useState(cart.billing_address?.email ?? "");
  const shippingAddress = cart.needs_shipping ? cart.shipping_address : undefined;
  const nameSource = shippingAddress ?? cart.billing_address;
  const initialName = [nameSource?.first_name, nameSource?.last_name].filter(Boolean).join(" ").trim();
  // A dedicated field, prefilled from the shipping address when available
  // but always independently editable/required here — the shipping form
  // only requires an address to calculate rates, not a name, so relying on
  // it alone left the Pay button silently and permanently disabled whenever
  // a shopper skipped those two optional-looking fields upstream.
  const [fullName, setFullName] = React.useState(initialName);
  const [status, setStatus] = React.useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const canSubmit =
    email.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !!nameSource &&
    stripeCard.status === "ready" &&
    stripeCard.cardComplete &&
    status === "idle";

  // Three prior rounds of fixes (hidden postal-code field, missing name
  // field, Stripe Element styling) each addressed a plausible cause of the
  // Pay button staying disabled, but reports of it still being unclickable
  // kept coming back without saying which condition was actually failing.
  // Surfacing the exact blocking reason(s) directly in the UI turns "still
  // doesn't work" into an actionable, specific report.
  const blockers: string[] = [];
  if (status === "idle") {
    if (!nameSource) blockers.push("finish the shipping address step above first");
    if (!fullName.trim()) blockers.push("enter the name on the card");
    if (!email.trim()) blockers.push("enter an email for your receipt");
    if (stripeCard.status === "loading") blockers.push("payment form is still loading");
    else if (stripeCard.status === "error" || stripeCard.status === "unavailable")
      blockers.push("payment form failed to load");
    else if (stripeCard.status === "ready" && !stripeCard.cardComplete)
      blockers.push("finish entering your card number, expiry & CVC");
  }

  React.useEffect(() => {
    // eslint-disable-next-line no-console -- intentional diagnostic aid for tracking down a persistently-disabled Pay button
    console.debug(`${LOG_PREFIX} pay button state`, {
      canSubmit,
      email: email.trim().length > 0,
      fullName: fullName.trim().length > 0,
      hasNameSource: !!nameSource,
      stripeStatus: stripeCard.status,
      cardComplete: stripeCard.cardComplete,
      stripeError: stripeCard.errorMessage,
      status,
    });
  }, [canSubmit, email, fullName, nameSource, stripeCard.status, stripeCard.cardComplete, stripeCard.errorMessage, status]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !nameSource) {
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    const billingAddress = addressFromShipping(nameSource, email.trim(), fullName);

    const paymentMethodResult = await stripeCard.createPaymentMethod({
      name: fullName,
      email: email.trim(),
      address: {
        line1: billingAddress.address_1,
        line2: billingAddress.address_2 || undefined,
        city: billingAddress.city,
        state: billingAddress.state,
        postal_code: billingAddress.postcode,
        country: billingAddress.country,
      },
    });

    if (!paymentMethodResult.ok) {
      setStatus("error");
      setErrorMessage(paymentMethodResult.error);
      return;
    }

    const checkoutResult = await submitCheckout({
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      payment_method: "stripe",
      payment_data: buildStripePaymentData(paymentMethodResult.paymentMethodId, billingAddress),
    });

    if (!checkoutResult.ok) {
      setStatus("error");
      setErrorMessage(checkoutResult.error);
      return;
    }

    const { order } = checkoutResult;

    if (order.payment_result.payment_status === "success") {
      onOrderComplete(order);
      return;
    }

    if (order.payment_result.payment_status === "requires_action") {
      const clientSecret = extractClientSecret(order);
      if (!clientSecret) {
        console.error(`${LOG_PREFIX} requires_action but no client secret found`, order.payment_result);
        setStatus("error");
        setErrorMessage(
          "Your bank requires extra verification for this card, which we couldn't complete here. Please use Review & checkout below instead.",
        );
        return;
      }

      setStatus("confirming");
      const confirmResult = await stripeCard.confirmCardPayment(clientSecret);
      if (!confirmResult.ok) {
        setStatus("error");
        setErrorMessage(confirmResult.error);
        return;
      }

      const finalizeResult = await confirmCheckoutOrder({
        order_id: order.order_id,
        order_key: order.order_key,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        payment_method: "stripe",
        payment_data: buildStripeConfirmPaymentData(paymentMethodResult.paymentMethodId, billingAddress),
      });

      if (!finalizeResult.ok) {
        setStatus("error");
        setErrorMessage(finalizeResult.error);
        return;
      }

      // A 200 response here only means the confirm *request* succeeded, not
      // that the payment did — a prior version of this code called
      // `onOrderComplete` unconditionally at this point, which told a
      // shopper their order was confirmed for an order WooCommerce had
      // actually recorded as "Failed". Only ever report success once the
      // gateway itself reports the payment as successful.
      if (finalizeResult.order.payment_result.payment_status === "success") {
        onOrderComplete(finalizeResult.order);
        return;
      }

      console.error(`${LOG_PREFIX} 3DS confirmation did not result in success`, finalizeResult.order.payment_result);
      setStatus("error");
      setErrorMessage(
        "Your bank's verification completed, but we couldn't confirm the payment. Please try again or use Review & checkout below.",
      );
      return;
    }

    console.warn(`${LOG_PREFIX} unexpected payment status`, order.payment_result);
    setStatus("error");
    setErrorMessage("Your payment couldn't be completed. Please try again or use Review & checkout below.");
  }

  const busy = status === "submitting" || status === "confirming";

  return (
    <div className="dg-payment-step">
      <h4 className="dg-cart-shipping-title">Payment</h4>

      <form className="dg-payment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Full name on card"
          value={fullName}
          autoComplete="cc-name"
          onChange={(event) => setFullName(event.target.value)}
        />
        <input
          type="email"
          placeholder="Email for your receipt"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="dg-payment-card-field">
          {stripeCard.status === "unavailable" ? (
            <p className="dg-cart-shipping-error">{stripeCard.errorMessage ?? "Card payment isn't available."}</p>
          ) : (
            <>
              <iframe ref={stripeCard.iframeRef} title="Card details" className="dg-payment-card-iframe" />
              {stripeCard.status === "loading" ? <p className="dg-cart-status-hint">Loading payment form…</p> : null}
            </>
          )}
        </div>

        {stripeCard.errorMessage && stripeCard.status === "ready" ? (
          <p className="dg-cart-shipping-error">{stripeCard.errorMessage}</p>
        ) : null}

        {errorMessage ? <p className="dg-cart-shipping-error">{errorMessage}</p> : null}

        <button type="submit" className="dg-btn dg-btn-primary dg-payment-submit" disabled={!canSubmit || busy}>
          {status === "confirming"
            ? "Confirming with your bank…"
            : status === "submitting"
              ? "Processing…"
              : `Pay ${formatStoreApiMoney(cart.totals.total_price, cart.totals)}`}
        </button>
        {!canSubmit && !busy && blockers.length > 0 ? (
          <p className="dg-cart-shipping-hint">Please {blockers.join(", ")} to continue.</p>
        ) : null}
        <p className="dg-payment-secure-note">Payments are processed securely by Stripe. Card details never touch our servers.</p>
      </form>
    </div>
  );
}
