import type { StoreApiAddress } from "./store-api";

const STORAGE_KEY = "dg-chat-saved-addresses-v1";

export type AddressFields = Pick<
  StoreApiAddress,
  "first_name" | "last_name" | "address_1" | "address_2" | "city" | "state" | "postcode" | "country"
>;

export interface SavedCheckoutAddresses {
  shipping: AddressFields;
  billing: AddressFields;
  billingSameAsShipping: boolean;
  savedAt: number;
}

const EMPTY_ADDRESS: AddressFields = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "AU",
};

function asFields(address: Partial<StoreApiAddress> | null | undefined): AddressFields {
  return {
    first_name: address?.first_name?.trim() ?? "",
    last_name: address?.last_name?.trim() ?? "",
    address_1: address?.address_1?.trim() ?? "",
    address_2: address?.address_2?.trim() ?? "",
    city: address?.city?.trim() ?? "",
    state: address?.state?.trim() ?? "",
    postcode: address?.postcode?.trim() ?? "",
    country: address?.country?.trim() || "AU",
  };
}

export function addressHasStreet(address: Partial<StoreApiAddress> | null | undefined): boolean {
  return Boolean(address?.address_1?.trim());
}

/**
 * Prefers the live cart address (Woo session / logged-in customer), then
 * falls back to the last address this browser saved from chat checkout.
 */
export function pickAddressForForm(
  cartAddress: Partial<StoreApiAddress> | null | undefined,
  savedAddress: AddressFields | null | undefined,
): AddressFields {
  if (addressHasStreet(cartAddress)) {
    return asFields(cartAddress);
  }
  if (savedAddress && addressHasStreet(savedAddress)) {
    return { ...EMPTY_ADDRESS, ...savedAddress, country: savedAddress.country || "AU" };
  }
  return { ...EMPTY_ADDRESS };
}

export function loadSavedCheckoutAddresses(): SavedCheckoutAddresses | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SavedCheckoutAddresses>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      shipping: asFields(parsed.shipping),
      billing: asFields(parsed.billing),
      billingSameAsShipping: parsed.billingSameAsShipping !== false,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveCheckoutAddresses(options: {
  shipping: Partial<StoreApiAddress>;
  billing: Partial<StoreApiAddress>;
  billingSameAsShipping: boolean;
}): void {
  try {
    const payload: SavedCheckoutAddresses = {
      shipping: asFields(options.shipping),
      billing: asFields(options.billingSameAsShipping ? options.shipping : options.billing),
      billingSameAsShipping: options.billingSameAsShipping,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota — non-fatal; cart session still holds the address.
  }
}
