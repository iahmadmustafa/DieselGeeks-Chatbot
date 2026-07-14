import type { CatalogProduct } from "@/types/catalog";
import type {
  CatalogSearchResult,
  SearchProductsParams,
} from "@/types/chat";

export interface CatalogScope {
  makes: string[];
  models: string[];
  partCategories: string[];
  summary: string;
}

export interface ScopeAssessment {
  in_catalog_scope: boolean;
  reason: string | null;
}

const IN_SCOPE_PART_PATTERNS = [
  /\binjectors?\b/i,
  /\bnozzles?\b/i,
  /\bfuel\s*pumps?\b/i,
  /\bcommon\s*rail\b/i,
  /\bfuel\s*lines?\b/i,
  /\bfuel\s*rail\b/i,
  /\bscv\b/i,
  /\bsuction\s*control\s*valves?\b/i,
  /\bturbos?\b/i,
  /\blift\s*pumps?\b/i,
  /\bhpops?\b/i,
  /\bcrank\s*angle\s*sensors?\b/i,
  /\bdiesel\b/i,
  /\bt-?shirts?\b/i,
  /\bapparel\b/i,
  /\bmerch(?:andise)?\b/i,
  /\bbundles?\b/i,
  /\bkits?\b/i,
];

const OUT_OF_SCOPE_PART_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbrake\s*pads?\b/i, label: "brake pads" },
  { pattern: /\bbrake\s*rotors?\b/i, label: "brake rotors" },
  { pattern: /\bbrake\s*discs?\b/i, label: "brake discs" },
  { pattern: /\bbrake\s*calipers?\b/i, label: "brake calipers" },
  { pattern: /\bclutch(?:es| kits?)?\b/i, label: "clutch parts" },
  { pattern: /\bspark\s*plugs?\b/i, label: "spark plugs" },
  { pattern: /\bwiper\s*blades?\b/i, label: "wiper blades" },
  { pattern: /\bshock\s*absorbers?\b/i, label: "shock absorbers" },
  { pattern: /\bstruts?\b/i, label: "suspension struts" },
  { pattern: /\bsuspension\b/i, label: "suspension parts" },
  { pattern: /\bheadlights?\b/i, label: "headlights" },
  { pattern: /\btaillights?\b/i, label: "taillights" },
  { pattern: /\bbody\s*p(?:anels?)?\b/i, label: "body panels" },
  { pattern: /\bexhaust\s*systems?\b/i, label: "exhaust systems" },
  { pattern: /\bmufflers?\b/i, label: "mufflers" },
  { pattern: /\bair\s*filters?\b/i, label: "air filters" },
  { pattern: /\boil\s*filters?\b/i, label: "oil filters" },
  { pattern: /\bcabin\s*filters?\b/i, label: "cabin filters" },
  { pattern: /\btyres?\b/i, label: "tyres" },
  { pattern: /\btires?\b/i, label: "tires" },
  { pattern: /\bwheel\s*alignments?\b/i, label: "wheel alignment" },
  { pattern: /\bball\s*joints?\b/i, label: "ball joints" },
  { pattern: /\btie\s*rod\s*ends?\b/i, label: "tie rod ends" },
  { pattern: /\bcontrol\s*arms?\b/i, label: "control arms" },
  { pattern: /\bwindow\s*regulators?\b/i, label: "window regulators" },
  { pattern: /\bstarter\s*motors?\b/i, label: "starter motors" },
  { pattern: /\balternators?\b/i, label: "alternators" },
  { pattern: /\bradiators?\b/i, label: "radiators" },
  { pattern: /\bthermostats?\b/i, label: "thermostats" },
  { pattern: /\btransmission\b/i, label: "transmission parts" },
  { pattern: /\bgearbox\b/i, label: "gearbox parts" },
  { pattern: /\bcv\s*joints?\b/i, label: "CV joints" },
  { pattern: /\bdrive\s*shafts?\b/i, label: "drive shafts" },
];

const PASSENGER_VEHICLE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bcivics?\b/i, label: "Honda Civic" },
  { pattern: /\baccords?\b/i, label: "Honda Accord" },
  { pattern: /\bcorollas?\b/i, label: "Toyota Corolla" },
  { pattern: /\bcamrys?\b/i, label: "Toyota Camry" },
  { pattern: /\byaris\b/i, label: "Toyota Yaris" },
  { pattern: /\bvolkswagens?\b/i, label: "Volkswagen passenger models" },
  { pattern: /\bgolfs?\b/i, label: "VW Golf" },
  { pattern: /\bpolos?\b/i, label: "VW Polo" },
  { pattern: /\bmazda\s*3\b/i, label: "Mazda 3" },
  { pattern: /\bmazda\s*6\b/i, label: "Mazda 6" },
  { pattern: /\bfocus\b/i, label: "Ford Focus" },
  { pattern: /\bfiestas?\b/i, label: "Ford Fiesta" },
  { pattern: /\bcommodores?\b/i, label: "Holden Commodore" },
  { pattern: /\bastra\b/i, label: "Holden Astra" },
  { pattern: /\bi30\b/i, label: "Hyundai i30" },
  { pattern: /\bi20\b/i, label: "Hyundai i20" },
  { pattern: /\bceratos?\b/i, label: "Kia Cerato" },
  { pattern: /\brio\b/i, label: "Kia Rio" },
  { pattern: /\bwrx\b/i, label: "Subaru WRX" },
  { pattern: /\bimprezas?\b/i, label: "Subaru Impreza" },
  { pattern: /\blancers?\b/i, label: "Mitsubishi Lancer" },
  { pattern: /\bpassenger\s*cars?\b/i, label: "passenger cars" },
  { pattern: /\bsedans?\b/i, label: "sedans" },
  { pattern: /\bhatchbacks?\b/i, label: "hatchbacks" },
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokenMatches(candidate: string, query: string): boolean {
  const normalizedCandidate = normalizeToken(candidate);
  const normalizedQuery = normalizeToken(query);
  if (!normalizedCandidate || !normalizedQuery) {
    return false;
  }

  return (
    normalizedCandidate === normalizedQuery ||
    normalizedCandidate.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCandidate)
  );
}

function addUnique(target: Set<string>, value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    target.add(trimmed);
  }
}

/**
 * Distinct vehicle makes from parsed fitment only (`product.fitment.makes[]`).
 * Does not infer makes from titles, categories, or free text.
 */
export function extractFitmentMakes(products: CatalogProduct[]): string[] {
  const makesByKey = new Map<string, string>();

  for (const product of products) {
    for (const make of product.fitment.makes) {
      const trimmed = make.trim();
      if (!trimmed) {
        continue;
      }

      const key = trimmed.toLowerCase();
      if (!makesByKey.has(key)) {
        makesByKey.set(key, trimmed);
      }
    }
  }

  return [...makesByKey.values()].sort((left, right) => left.localeCompare(right));
}

function collectPartCategories(product: CatalogProduct, categories: Set<string>): void {
  for (const category of product.categories) {
    addUnique(categories, category);
  }

  const title = product.title.toLowerCase();
  for (const pattern of IN_SCOPE_PART_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      addUnique(categories, match[0].toLowerCase());
    }
  }
}

export function extractCatalogScope(products: CatalogProduct[]): CatalogScope {
  const models = new Set<string>();
  const partCategories = new Set<string>();

  for (const product of products) {
    for (const model of product.fitment.models) {
      addUnique(models, model);
    }
    for (const model of Object.keys(product.fitment.year_ranges)) {
      addUnique(models, model);
    }

    collectPartCategories(product, partCategories);
  }

  const sortedMakes = extractFitmentMakes(products);
  const sortedModels = [...models].sort((left, right) => left.localeCompare(right));
  const sortedCategories = [...partCategories].sort((left, right) => left.localeCompare(right));

  const summary = [
    "Diesel Geeks specialises in diesel injector and fuel system parts for utes, 4x4s, and commercial diesels.",
    `Vehicle makes in parsed fitment data: ${sortedMakes.join(", ") || "none indexed yet"}.`,
    `Representative part categories: ${sortedCategories.slice(0, 12).join(", ") || "injectors, fuel pumps, fuel lines, nozzles, SCV valves, kits"}.`,
    "We do NOT sell general workshop parts (brakes, clutches, suspension, filters, body panels, etc.) or parts for passenger cars outside our indexed makes.",
  ].join(" ");

  return {
    makes: sortedMakes,
    models: sortedModels,
    partCategories: sortedCategories,
    summary,
  };
}

function buildQueryText(params: SearchProductsParams): string {
  return [params.part_number, params.make, params.model, params.engine_code, params.keyword]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function hasInScopePartMention(queryText: string): boolean {
  return IN_SCOPE_PART_PATTERNS.some((pattern) => pattern.test(queryText));
}

function findOutOfScopePart(queryText: string): string | null {
  for (const entry of OUT_OF_SCOPE_PART_PATTERNS) {
    if (entry.pattern.test(queryText)) {
      return entry.label;
    }
  }
  return null;
}

function findPassengerVehicle(queryText: string): string | null {
  for (const entry of PASSENGER_VEHICLE_PATTERNS) {
    if (entry.pattern.test(queryText)) {
      return entry.label;
    }
  }
  return null;
}

function makeInCatalog(make: string, scope: CatalogScope): boolean {
  return scope.makes.some((catalogMake) => tokenMatches(catalogMake, make));
}

function modelInCatalog(model: string, scope: CatalogScope): boolean {
  return scope.models.some((catalogModel) => tokenMatches(catalogModel, model));
}

export function assessQueryScope(
  params: SearchProductsParams,
  scope: CatalogScope,
): ScopeAssessment {
  const queryText = buildQueryText(params);

  const outOfScopePart = findOutOfScopePart(queryText);
  if (outOfScopePart && !hasInScopePartMention(queryText)) {
    return {
      in_catalog_scope: false,
      reason: `We specialise in diesel injector and fuel system parts — we do not carry ${outOfScopePart}.`,
    };
  }

  if (params.make && !makeInCatalog(params.make, scope)) {
    return {
      in_catalog_scope: false,
      reason: `We do not carry parts for ${params.make} vehicles in our catalog.`,
    };
  }

  const passengerVehicle = findPassengerVehicle(queryText);
  if (passengerVehicle) {
    const makeMentioned = params.make ? makeInCatalog(params.make, scope) : false;
    const modelMentioned = params.model ? modelInCatalog(params.model, scope) : false;
    if (!makeMentioned && !modelMentioned) {
      return {
        in_catalog_scope: false,
        reason: `We do not carry parts for ${passengerVehicle} — our catalog focuses on diesel utes and 4x4s.`,
      };
    }
  }

  if (params.model && !modelInCatalog(params.model, scope)) {
    const makeMentioned = params.make ? makeInCatalog(params.make, scope) : false;
    if (!makeMentioned) {
      return {
        in_catalog_scope: false,
        reason: `We do not carry parts for the ${params.model} in our catalog.`,
      };
    }
  }

  return {
    in_catalog_scope: true,
    reason: null,
  };
}

export function enrichSearchResult(
  result: CatalogSearchResult,
  params: SearchProductsParams,
  scope: CatalogScope,
): CatalogSearchResult & {
  out_of_catalog_scope: boolean;
  out_of_scope_reason: string | null;
  clarifying_questions_allowed: boolean;
  catalog_scope_summary: string;
} {
  const assessment = assessQueryScope(params, scope);

  const outOfCatalogScope =
    !assessment.in_catalog_scope &&
    (assessment.reason !== null || result.match_type === "none");

  return {
    ...result,
    out_of_catalog_scope: outOfCatalogScope,
    out_of_scope_reason: assessment.reason,
    clarifying_questions_allowed: assessment.in_catalog_scope && result.result_count === 0,
    catalog_scope_summary: scope.summary,
  };
}
