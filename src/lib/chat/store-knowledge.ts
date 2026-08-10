/**
 * Approved Diesel Geeks store facts for chat. Keep this curated — do not
 * scrape the website at runtime. Update here when phone/hours/address change.
 */

export interface StoreKnowledge {
  brandName: string;
  website: string;
  phoneDisplay: string;
  phoneTel: string;
  addressLine: string;
  hoursLine: string;
  contactUrl: string;
  whatsappUrl: string | null;
  services: string[];
  notes: string[];
}

export function getStoreKnowledge(contactUrl: string): StoreKnowledge {
  return {
    brandName: "Diesel Geeks",
    website: "https://dieselgeeks.com.au",
    phoneDisplay: "+61 02 8529 5003",
    phoneTel: "+610285295003",
    addressLine: "115-117 Auburn Street, Coniston, NSW 2500",
    hoursLine: "Monday–Friday 9:00am–5:00pm (closed Saturday and Sunday)",
    contactUrl,
    whatsappUrl: "https://wa.me/+61436419992",
    services: [
      "Sell diesel injector and fuel-system parts for utes, 4x4s, and commercial diesels (injectors, common-rail components, OEM/Bosch/Denso-style items) for the makes we support.",
      "Confirm fitment — help check parts against vehicle make, model, year, and engine code.",
      "Order support — help with order status and general order questions in chat.",
      "Product search and SKU/OEM lookups — find parts by part number, keyword, or vehicle filters.",
      "If we do not carry something or you need repairs/rebuilds, we can point you to a specialist via Contact us.",
    ],
    notes: [
      "We ship within Australia.",
      "For forms, maps, and the latest contact options, the Contact us page is also available.",
    ],
  };
}

/** Compact block injected into the system prompt. */
export function formatStoreKnowledgeForPrompt(knowledge: StoreKnowledge): string {
  const services = knowledge.services.map((line) => `- ${line}`).join("\n");
  const notes = knowledge.notes.map((line) => `- ${line}`).join("\n");
  const whatsapp = knowledge.whatsappUrl
    ? `- WhatsApp / live chat with an expert: ${knowledge.whatsappUrl}`
    : "";

  return `Brand: ${knowledge.brandName}
Website: ${knowledge.website}
Phone: ${knowledge.phoneDisplay} (tel:${knowledge.phoneTel})
Address: ${knowledge.addressLine}
Customer service hours (Australia): ${knowledge.hoursLine}
Contact page: ${knowledge.contactUrl}
${whatsapp}

What we do:
${services}

Other notes:
${notes}`;
}
