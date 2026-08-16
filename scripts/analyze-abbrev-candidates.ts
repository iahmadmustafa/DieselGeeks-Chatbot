import { readFileSync } from "node:fs";

interface Product {
  id: number;
  sku: string;
  title: string;
  short_description: string;
  fitment_raw: string;
  categories: string[];
}

const products = JSON.parse(readFileSync("tmp/catalog-snapshot.json", "utf8")).snapshot
  .products as Product[];

function textOf(product: Product): string {
  return [product.title, product.sku, product.short_description, product.fitment_raw].join(" ");
}

function countAbbr(abbr: string): number {
  const re = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return products.filter((product) => re.test(textOf(product))).length;
}

const checks: Array<{ abbr: string; full: RegExp; label: string }> = [
  { abbr: "SCV", full: /suction control valve/i, label: "suction control valve" },
  { abbr: "HPFP", full: /high.?pressure fuel pump|common rail (fuel )?pump/i, label: "common rail / high pressure fuel pump" },
  { abbr: "CR", full: /common rail/i, label: "common rail" },
  { abbr: "DPF", full: /\bdpf\b|diesel particulate/i, label: "DPF" },
  { abbr: "EGR", full: /\begr\b|exhaust gas recirculation/i, label: "EGR" },
  { abbr: "IMV", full: /inlet metering|\bimv\b/i, label: "IMV / inlet metering valve" },
  { abbr: "PRV", full: /pressure relief|pressure regulator|regulating valve/i, label: "pressure regulator / relief valve" },
  { abbr: "FPR", full: /fuel pressure regulator|regulating valve/i, label: "fuel pressure regulator" },
  { abbr: "VGT", full: /\bvgt\b|variable geometry/i, label: "VGT / variable geometry turbo" },
  { abbr: "CAS", full: /crank angle sensor/i, label: "crank angle sensor" },
  { abbr: "LOP", full: /leak.?off|leak off/i, label: "leak-off / leak off rail" },
  { abbr: "OEM", full: /\boem\b/i, label: "OEM" },
  { abbr: "NOS", full: /nozzle/i, label: "nozzle (weak)" },
];

console.log("=== candidate abbreviation analysis ===");
for (const check of checks) {
  const withFull = products.filter((product) => check.full.test(textOf(product)));
  console.log(
    JSON.stringify(
      {
        abbr: check.abbr,
        mapsTo: check.label,
        productsMatchingFullSense: withFull.length,
        productsMentioningAbbrLiteral: countAbbr(check.abbr),
        sampleTitles: withFull.slice(0, 4).map((product) => product.title),
      },
      null,
      2,
    ),
  );
}

const abbrLike = new Map<string, number>();
for (const product of products) {
  for (const match of product.title.match(/\b[A-Z]{2,6}\b/g) || []) {
    if (["FOR", "AND", "THE", "KIT", "SET", "WITH", "FROM", "SERIES", "DIESEL", "GENUINE"].includes(match)) {
      continue;
    }
    abbrLike.set(match, (abbrLike.get(match) || 0) + 1);
  }
}

console.log("=== uppercase tokens in titles (possible abbrevs already in catalog) ===");
console.log(
  [...abbrLike.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 50)
    .map(([key, value]) => `${key}:${value}`)
    .join(", "),
);

// Products with suction control valve but no SCV in text
const scvGap = products.filter(
  (product) =>
    /suction control valve/i.test(textOf(product)) && !/\bscv\b/i.test(textOf(product)),
);
console.log(
  "\nSCV gap (full name present, acronym missing):",
  scvGap.map((product) => `${product.id} | ${product.title}`),
);
