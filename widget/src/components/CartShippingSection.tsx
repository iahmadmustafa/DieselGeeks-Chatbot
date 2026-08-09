import * as React from "react";

import {
  loadSavedCheckoutAddresses,
  pickAddressForForm,
  saveCheckoutAddresses,
  type AddressFields,
} from "../saved-addresses";
import { formatStoreApiMoney, type StoreApiAddress, type StoreApiCart } from "../store-api";
import type { StoreCartMutationResult } from "../use-store-cart";

// Diesel Geeks currently ships within Australia only, so the country is
// fixed rather than exposed as a form field — this keeps checkout focused and
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

function withCountry(values: AddressFields): StoreApiAddress {
  return {
    ...values,
    company: "",
    country: FIXED_COUNTRY,
  };
}

function isAddressComplete(values: AddressFields): boolean {
  return Boolean(
    values.first_name.trim() &&
      values.last_name.trim() &&
      values.address_1.trim() &&
      values.city.trim() &&
      values.state.trim() &&
      values.postcode.trim(),
  );
}

interface CartShippingSectionProps {
  cart: StoreApiCart;
  onUpdateAddresses: (addresses: {
    shipping_address?: Partial<StoreApiAddress>;
    billing_address?: Partial<StoreApiAddress>;
  }) => Promise<StoreCartMutationResult>;
  onSelectRate: (packageId: number | string, rateId: string) => Promise<StoreCartMutationResult>;
}

/**
 * Stage 2 of in-chat checkout: shipping + billing (Woo-style "same as
 * shipping"), rate calculation, and local save so the next visit prefills.
 */
export function CartShippingSection({ cart, onUpdateAddresses, onSelectRate }: CartShippingSectionProps) {
  const saved = React.useMemo(() => loadSavedCheckoutAddresses(), []);

  const [shipping, setShipping] = React.useState<AddressFields>(() =>
    pickAddressForForm(cart.shipping_address, saved?.shipping),
  );
  const [billing, setBilling] = React.useState<AddressFields>(() =>
    pickAddressForForm(cart.billing_address, saved?.billing),
  );
  const [billingSameAsShipping, setBillingSameAsShipping] = React.useState(
    () => saved?.billingSameAsShipping ?? true,
  );
  const [addressStatus, setAddressStatus] = React.useState<"idle" | "saving" | "error">("idle");
  const [addressError, setAddressError] = React.useState<string | null>(null);
  const [savingRateId, setSavingRateId] = React.useState<string | null>(null);
  const [rateError, setRateError] = React.useState<string | null>(null);

  const effectiveBilling = billingSameAsShipping ? shipping : billing;
  const canSubmit = isAddressComplete(shipping) && isAddressComplete(effectiveBilling);

  function handleShippingChange<K extends keyof AddressFields>(key: K, value: AddressFields[K]): void {
    setShipping((prev) => ({ ...prev, [key]: value }));
  }

  function handleBillingChange<K extends keyof AddressFields>(key: K, value: AddressFields[K]): void {
    setBilling((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || addressStatus === "saving") {
      return;
    }

    setAddressStatus("saving");
    setAddressError(null);

    const shippingAddress = withCountry(shipping);
    const billingAddress = withCountry(effectiveBilling);

    const result = await onUpdateAddresses({
      shipping_address: shippingAddress,
      billing_address: billingAddress,
    });

    if (!result.ok) {
      setAddressStatus("error");
      setAddressError(result.error);
      return;
    }

    saveCheckoutAddresses({
      shipping: shippingAddress,
      billing: billingAddress,
      billingSameAsShipping,
    });

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
      <form className="dg-cart-address-form" onSubmit={(event) => void handleSubmit(event)}>
        <h4 className="dg-cart-shipping-title">Shipping address</h4>
        <p className="dg-cart-shipping-note">We’ll remember this on this device for next time.</p>

        <AddressFieldsInputs values={shipping} onChange={handleShippingChange} idPrefix="ship" />

        <label className="dg-cart-billing-same">
          <input
            type="checkbox"
            checked={billingSameAsShipping}
            onChange={(event) => {
              const checked = event.target.checked;
              setBillingSameAsShipping(checked);
              // Keep forms in sync when toggling so unchecking doesn't leave a blank billing form.
              setBilling(shipping);
            }}
          />
          <span>Billing address same as shipping</span>
        </label>

        {!billingSameAsShipping ? (
          <div className="dg-cart-billing-block">
            <h4 className="dg-cart-shipping-title">Billing address</h4>
            <AddressFieldsInputs values={billing} onChange={handleBillingChange} idPrefix="bill" />
          </div>
        ) : null}

        {addressError ? <p className="dg-cart-shipping-error">{addressError}</p> : null}

        <div className="dg-cart-shipping-submit-row">
          <button
            type="submit"
            className="dg-btn dg-btn-secondary dg-cart-shipping-submit"
            disabled={!canSubmit || addressStatus === "saving"}
          >
            {addressStatus === "saving" ? "Saving…" : "Calculate shipping"}
          </button>
          {!canSubmit ? (
            <span className="dg-cart-shipping-hint">Name, address, suburb, state &amp; postcode are required</span>
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

function AddressFieldsInputs({
  values,
  onChange,
  idPrefix,
}: {
  values: AddressFields;
  onChange: <K extends keyof AddressFields>(key: K, value: AddressFields[K]) => void;
  idPrefix: string;
}) {
  return (
    <>
      <div className="dg-cart-address-row">
        <input
          id={`${idPrefix}-first-name`}
          type="text"
          placeholder="First name"
          autoComplete="given-name"
          value={values.first_name}
          onChange={(event) => onChange("first_name", event.target.value)}
          required
        />
        <input
          id={`${idPrefix}-last-name`}
          type="text"
          placeholder="Last name"
          autoComplete="family-name"
          value={values.last_name}
          onChange={(event) => onChange("last_name", event.target.value)}
          required
        />
      </div>
      <input
        id={`${idPrefix}-address-1`}
        type="text"
        placeholder="Address"
        autoComplete="address-line1"
        value={values.address_1}
        onChange={(event) => onChange("address_1", event.target.value)}
        required
      />
      <input
        id={`${idPrefix}-address-2`}
        type="text"
        placeholder="Apartment, suite, etc. (optional)"
        autoComplete="address-line2"
        value={values.address_2}
        onChange={(event) => onChange("address_2", event.target.value)}
      />
      <div className="dg-cart-address-row dg-cart-address-row-3">
        <input
          id={`${idPrefix}-city`}
          type="text"
          placeholder="Suburb"
          autoComplete="address-level2"
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
          required
        />
        <select
          id={`${idPrefix}-state`}
          value={values.state}
          autoComplete="address-level1"
          onChange={(event) => onChange("state", event.target.value)}
          required
        >
          <option value="">State</option>
          {AU_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.label}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-postcode`}
          type="text"
          placeholder="Postcode"
          inputMode="numeric"
          autoComplete="postal-code"
          value={values.postcode}
          onChange={(event) => onChange("postcode", event.target.value)}
          required
        />
      </div>
    </>
  );
}
