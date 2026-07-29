import * as React from "react";

import {
  confirmCheckoutOrder,
  formatStoreApiMoney,
  readPaymentDetail,
  submitCheckout,
  type StoreApiAddress,
  type StoreApiCart,
  type StoreApiOrder,
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
      payment_data: [{ key: "wc-stripe-payment-method", value: paymentMethodResult.paymentMethodId }],
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
        payment_data: [{ key: "wc-stripe-payment-method", value: paymentMethodResult.paymentMethodId }],
      });

      if (!finalizeResult.ok) {
        setStatus("error");
        setErrorMessage(finalizeResult.error);
        return;
      }

      onOrderComplete(finalizeResult.order);
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
        <p className="dg-payment-secure-note">Payments are processed securely by Stripe. Card details never touch our servers.</p>
      </form>
    </div>
  );
}
