import { describe, expect, it } from "vitest";

import { statusLabel, toOrderSummary, type WooOrderRaw } from "./orders";

describe("orders helpers", () => {
  it("maps Woo statuses to friendly labels", () => {
    expect(statusLabel("processing")).toBe("Processing");
    expect(statusLabel("on-hold")).toBe("On hold");
    expect(statusLabel("custom-ship")).toBe("custom ship");
  });

  it("sanitizes order summaries without addresses or payment URLs", () => {
    const raw = {
      id: 15956,
      status: "processing",
      currency: "AUD",
      total: "380.29",
      customer_id: 0,
      date_created: "2026-08-04T02:50:10",
      date_paid: "2026-08-04T02:50:15",
      date_completed: null,
      billing: {
        first_name: "bhai",
        last_name: "khan",
        email: "bhai@placentek.com",
        address_1: "115 Auburn Street",
        phone: "0400000000",
      },
      line_items: [
        {
          name: "Injector Fitting Kit",
          quantity: 1,
          sku: "IFK-1",
          total: "357.58",
        },
      ],
      shipping_lines: [{ method_title: "Flat Rate Shipping Fee" }],
      payment_url: "https://example.com/pay",
    } as WooOrderRaw & { payment_url: string };

    const summary = toOrderSummary(raw);
    const json = JSON.stringify(summary);

    expect(summary.order_id).toBe(15956);
    expect(summary.status_label).toBe("Processing");
    expect(summary.items[0]?.name).toBe("Injector Fitting Kit");
    expect(summary.shipping_method).toBe("Flat Rate Shipping Fee");
    expect(summary.customer_first_name).toBe("bhai");
    expect(json).not.toContain("Auburn");
    expect(json).not.toContain("0400000000");
    expect(json).not.toContain("payment_url");
    expect(json).not.toContain("bhai@placentek.com");
  });
});
