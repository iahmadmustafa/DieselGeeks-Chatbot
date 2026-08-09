import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadSavedCheckoutAddresses,
  pickAddressForForm,
  saveCheckoutAddresses,
} from "./saved-addresses";

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });
}

describe("saved-addresses", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the cart address over a saved one", () => {
    const picked = pickAddressForForm(
      { address_1: "1 Cart St", city: "Sydney", state: "NSW", postcode: "2000", country: "AU" },
      {
        first_name: "Saved",
        last_name: "User",
        address_1: "9 Old St",
        address_2: "",
        city: "Melbourne",
        state: "VIC",
        postcode: "3000",
        country: "AU",
      },
    );
    expect(picked.address_1).toBe("1 Cart St");
    expect(picked.city).toBe("Sydney");
  });

  it("falls back to the saved address when cart is empty", () => {
    const picked = pickAddressForForm(
      { address_1: "", city: "", state: "", postcode: "", country: "AU" },
      {
        first_name: "Sam",
        last_name: "Diesel",
        address_1: "9 Old St",
        address_2: "",
        city: "Melbourne",
        state: "VIC",
        postcode: "3000",
        country: "AU",
      },
    );
    expect(picked.address_1).toBe("9 Old St");
    expect(picked.first_name).toBe("Sam");
  });

  it("round-trips addresses through localStorage", () => {
    saveCheckoutAddresses({
      shipping: {
        first_name: "Sam",
        last_name: "Diesel",
        address_1: "10 Harbor Rd",
        address_2: "",
        city: "Newcastle",
        state: "NSW",
        postcode: "2300",
        country: "AU",
      },
      billing: {
        first_name: "Biz",
        last_name: "Billing",
        address_1: "20 Invoice Ave",
        address_2: "Suite 2",
        city: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "AU",
      },
      billingSameAsShipping: false,
    });

    const loaded = loadSavedCheckoutAddresses();
    expect(loaded?.shipping.address_1).toBe("10 Harbor Rd");
    expect(loaded?.billing.address_1).toBe("20 Invoice Ave");
    expect(loaded?.billingSameAsShipping).toBe(false);
  });
});
