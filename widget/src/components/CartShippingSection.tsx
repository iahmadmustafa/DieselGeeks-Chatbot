import * as React from "react";

import { formatStoreApiMoney, type StoreApiAddress, type StoreApiCart } from "../store-api";
import type { StoreCartMutationResult } from "../use-store-cart";

// Diesel Geeks currently ships within Australia only, so the country is
// fixed rather than exposed as a form field — this keeps stage 2 focused and
// avoids sending state values WooCommerce would reject for other countries.
const FIXED_COUNTRY = "AU";

const AU_STATES = [
  { code: "NSW", label: "NSW" },
  { code: "VIC", label: "VIC" },
  { code: "QLD", label: "QLD" },
  { code: "WA", label: "WA" },
  { code: "SA", label: "SA" },
  { code: "TAS", label: "TAS" },
  { code: "ACT", label: "ACT" },
  { code: "NT", label: "NT" },
];

type AddressFormValues = Pick<
  StoreApiAddress,
  "first_name" | "last_name" | "address_1" | "address_2" | "city" | "state" | "postcode"
>;

function initialValuesFromCart(cart: StoreApiCart): AddressFormValues {
  const address = cart.shipping_address;
  return {
    first_name: address?.first_name ?? "",
    last_name: address?.last_name ?? "",
    address_1: address?.address_1 ?? "",
    address_2: address?.address_2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postcode: address?.postcode ?? "",
  };
}

interface CartShippingSectionProps {
  cart: StoreApiCart;
  onUpdateAddress: (address: Partial<StoreApiAddress>) => Promise<StoreCartMutationResult>;
  onSelectRate: (packageId: number | string, rateId: string) => Promise<StoreCartMutationResult>;
}

/**
 * Stage 2 of in-chat checkout: a shipping address form that triggers
 * WooCommerce's real shipping-zone calculation via the Store API, plus a
 * picker for the resulting rates. Deliberately still has no payment UI —
 * "Review & checkout" in the parent view remains the safe fallback path
 * until stage 3 lands.
 */
export function CartShippingSection({ cart, onUpdateAddress, onSelectRate }: CartShippingSectionProps) {
  const [values, setValues] = React.useState<AddressFormValues>(() => initialValuesFromCart(cart));
  const [addressStatus, setAddressStatus] = React.useState<"idle" | "saving" | "error">("idle");
  const [addressError, setAddressError] = React.useState<string | null>(null);
  const [savingRateId, setSavingRateId] = React.useState<string | null>(null);
  const [rateError, setRateError] = React.useState<string | null>(null);

  const canSubmit = Boolean(
    values.address_1.trim() && values.city.trim() && values.state.trim() && values.postcode.trim(),
  );

  function handleChange<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || addressStatus === "saving") {
      return;
    }

    setAddressStatus("saving");
    setAddressError(null);

    const result = await onUpdateAddress({ ...values, country: FIXED_COUNTRY });
    if (!result.ok) {
      setAddressStatus("error");
      setAddressError(result.error);
      return;
    }

    setAddressStatus("idle");
  }

  async function handleSelectRate(packageId: number | string, rateId: string): Promise<void> {
    setSavingRateId(rateId);
    setRateError(null);

    const result = await onSelectRate(packageId, rateId);
    if (!result.ok) {
      setRateError(result.error);
    }
    setSavingRateId(null);
  }

  return (
    <div className="dg-cart-shipping">
      <h4 className="dg-cart-shipping-title">Shipping address</h4>

      <form className="dg-cart-address-form" onSubmit={handleSubmit}>
        <div className="dg-cart-address-row">
          <input
            type="text"
            placeholder="First name"
            value={values.first_name}
            onChange={(event) => handleChange("first_name", event.target.value)}
          />
          <input
            type="text"
            placeholder="Last name"
            value={values.last_name}
            onChange={(event) => handleChange("last_name", event.target.value)}
          />
        </div>
        <input
          type="text"
          placeholder="Address"
          value={values.address_1}
          onChange={(event) => handleChange("address_1", event.target.value)}
        />
        <input
          type="text"
          placeholder="Apartment, suite, etc. (optional)"
          value={values.address_2}
          onChange={(event) => handleChange("address_2", event.target.value)}
        />
        <div className="dg-cart-address-row dg-cart-address-row-3">
          <input
            type="text"
            placeholder="Suburb"
            value={values.city}
            onChange={(event) => handleChange("city", event.target.value)}
          />
          <select value={values.state} onChange={(event) => handleChange("state", event.target.value)}>
            <option value="">State</option>
            {AU_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Postcode"
            inputMode="numeric"
            value={values.postcode}
            onChange={(event) => handleChange("postcode", event.target.value)}
          />
        </div>

        {addressError ? <p className="dg-cart-shipping-error">{addressError}</p> : null}

        <div className="dg-cart-shipping-submit-row">
          <button
            type="submit"
            className="dg-btn dg-btn-secondary dg-cart-shipping-submit"
            disabled={!canSubmit || addressStatus === "saving"}
          >
            {addressStatus === "saving" ? "Calculating…" : "Calculate shipping"}
          </button>
          {!canSubmit ? (
            <span className="dg-cart-shipping-hint">Address, suburb, state &amp; postcode are required</span>
          ) : null}
        </div>
      </form>

      {cart.has_calculated_shipping && cart.shipping_rates.length > 0 ? (
        <div className="dg-cart-shipping-rates">
          {cart.shipping_rates.map((pkg) => (
            <div key={pkg.package_id} className="dg-cart-shipping-package">
              {cart.shipping_rates.length > 1 ? (
                <p className="dg-cart-shipping-package-name">{pkg.name}</p>
              ) : null}
              {pkg.shipping_rates.map((rate) => (
                <label key={rate.rate_id} className="dg-cart-shipping-rate">
                  <input
                    type="radio"
                    name={`dg-shipping-package-${pkg.package_id}`}
                    checked={rate.selected}
                    disabled={savingRateId !== null}
                    onChange={() => void handleSelectRate(pkg.package_id, rate.rate_id)}
                  />
                  <span className="dg-cart-shipping-rate-name">
                    {rate.name}
                    {savingRateId === rate.rate_id ? " · updating…" : ""}
                  </span>
                  <span className="dg-cart-shipping-rate-price">
                    {Number(rate.price) === 0 ? "Free" : formatStoreApiMoney(rate.price, rate)}
                  </span>
                </label>
              ))}
            </div>
          ))}
          {rateError ? <p className="dg-cart-shipping-error">{rateError}</p> : null}
        </div>
      ) : cart.has_calculated_shipping ? (
        <p className="dg-cart-shipping-empty">No shipping options available for this address.</p>
      ) : null}
    </div>
  );
}
