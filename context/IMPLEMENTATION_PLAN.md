# Diesel Geeks AI Product Assistant - Implementation Plan

**Project:** Retrieval-grounded product chat assistant for dieselgeeks.com.au
**Site:** WordPress + WooCommerce (Mobex child theme), 76 published products, ~130 visitors/day
**Status:** Phase 1 complete on staging; Phase 2–5 awaiting build; Phase 2.5 (vehicle lookup spreadsheets) scoped
**Date:** July 2026

---

## 1. Executive Summary

We will build a custom, standalone chat assistant that lets a store visitor type a part number, vehicle (make/model/engine code), or general product question and get back an accurate answer with **real product cards** (correct price, stock, fitment, link to product page).

The core design rule: **the LLM never answers product questions from its own memory.** Every product fact shown to a user comes from our actual WooCommerce catalog, retrieved by our own search code at request time. The LLM's job is only to (a) understand what the user is asking for, (b) call our product search, and (c) phrase a reply around the real results.

**Stack in one line:** Node.js (TypeScript) service on Vercel + Vercel AI SDK calling GPT-5 mini (swappable) + Upstash Redis (product snapshot cache, rate limiting, budget counter) + a custom embeddable JS chat widget dropped into WordPress via a script tag/shortcode.

**Estimated running cost:** low single-digit dollars per month in LLM usage at current traffic; free tiers cover Vercel and Upstash. The main investment is build time, not infrastructure.

---

## 2. Background and Problem

- Products have a custom **Fitment tab** stored in a theme-level meta field (`_product_fitment` on staging) - free-text lines like `Make:`, `Models:`, `Engine Code:`, `Year Range:`. 
- **Two complementary fitment data sources** (not redundant):
  - **WooCommerce product fitment (Phase 1):** Product → Vehicles — descriptive, good for general search and product cards.
  - **Client vehicle lookup spreadsheets (Phase 2.5):** Vehicle + Year + Engine → exact OEM part numbers — precise structured lookup for ~9 vehicle families (~300 rows total, granular by individual year).
- One website product (one SKU) often covers a **year range** (e.g. 2007–2016) sharing the same part number; lookup spreadsheet rows are granular per year until a change-over year changes the part number. ~300 spreadsheet rows correctly compress to ~75 WooCommerce products — expected, not a mismatch.
- Full **NEVDIS VIN decode** is still deferred, but spreadsheet **VIN lookup hints** plus make/model/engine/year often allow exact part resolution without a clarifying question for covered vehicles.
- Accuracy is a hard requirement. Wrong fitment or price on diesel injection parts means returns, safety risk, and liability.

### What was evaluated and ruled out (with evidence)

| Option | Verdict | Reason |
|---|---|---|
| Self-hosted open-source LLM on rented GPU | Ruled out | ~$300-800+/month for 24/7 GPU vs a few dollars/month of API usage at ~130 visitors/day. Not justified below roughly 10-100x current traffic. |
| Runware | Ruled out | Media (image/video/audio) generation only; no text/chat LLMs at all. |
| AI Engine plugin - Free tier | Ruled out | No access to store data; invents product names and prices. |
| AI Engine plugin - Pro tier ($59/yr) | Ruled out | Reads standard WooCommerce fields only; cannot see `mobex_child_fitment_info`. **Live test:** asked about "4JJ1 +30 Injectors (Pre-DPF)"; the bot returned price $1,250 (real: $3,168) and year range 2008-2013 (real: 2007-2016). It was guessing. Disqualifying for a parts store. |
| Custom WordPress PHP plugin (considered, not ruled out by the above) | Deliberately not chosen | Could read the meta directly with no sync, but: streaming responses are painful on typical WP hosting; a bug in it could degrade the client's live store (isolation matters on a client site); the OpenAI key would live on client infrastructure; JS/Node is the natural stack for the polished widget we want; a standalone service is reusable for future clients. |

**Decision: custom Node.js microservice with retrieval-grounded chat.** No plugin, no GPU, no vector database (see 4.3).

---

## 3. Architecture Overview

```
                     dieselgeeks.com.au (WordPress + WooCommerce)
                    ┌──────────────────────────────────────────────┐
                    │  Chat widget (our custom JS, loaded async     │
                    │  via script tag / shortcode)                  │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS (CORS locked to store domain)
                                    ▼
        ┌──────────────────────────────────────────────────────────┐
        │  Node.js service on Vercel (TypeScript)                  │
        │                                                          │
        │  POST /api/chat                                          │
        │   1. Guardrails: rate limit, message length, budget      │
        │   2. Chat loop (Vercel AI SDK, tool calling):            │
        │        model may call search_products(...)               │
        │   3. search_products runs against Redis:                   │
        │      vehicle lookup tables (Phase 2.5) then               │
        │      product snapshot (Phase 1) — never LLM memory          │
        │   4. Stream reply + structured product card data         │
        │                                                          │
        │  Cron (every 30 min): GET /api/sync                        │
        │   WooCommerce REST -> parse/normalize fitment ->            │
        │   write product snapshot to Redis                          │
        │                                                          │
        │  Cron (weekly / manual): GET /api/sync-vehicle-lookup      │
        │   9 client spreadsheets -> vehicle_lookup snapshot         │
        └───────┬──────────────────────────┬───────────────────────┘
                │                          │
                ▼                          ▼
        Upstash Redis               LLM provider (OpenAI GPT-5 mini
        - product snapshot          via Vercel AI SDK - swappable to
        - vehicle lookup snapshot   Gemini / Groq-Qwen / self-hosted
        - rate limit counters       with a one-line config change)
        - daily budget counter
        - conversation logs
```

One-time change on the WordPress side: a small `functions.php` snippet using `register_post_meta(..., ['show_in_rest' => true])` so the fitment field appears in the WooCommerce REST API response. This is the WordPress-supported mechanism and survives theme/WooCommerce updates (unlike manually filtering the response).

---

## 4. Key Technical Decisions and Rationale

### 4.1 Model: GPT-5 mini (mini-tier), not nano-tier

- GPT-4.1 Nano (originally proposed) is superseded. Current OpenAI cheap tier is the GPT-5 nano/mini line.
- At our volume the cost difference between nano and mini is **cents per month**, but mini-tier models are meaningfully better at instruction following and tool calling - which is exactly what our search-intent step depends on. A model that mis-parses "4JJ1 pre-DPF injectors" causes a failed retrieval, and failed retrieval is where hallucination pressure comes from.
- The model is a **config value** (env var), not code. Prototype on GPT-5 mini; downgrade to nano only if measured cost ever justifies it.

### 4.2 Provider abstraction: Vercel AI SDK

- Boss wants the option to later move to Gemini Flash, Qwen (via Groq/DeepInfra), or a self-hosted model. The Vercel AI SDK is exactly the thin wrapper we described: swapping `openai('gpt-5-mini')` for `google('gemini-flash')` is a one-line change; the tool-calling and streaming interfaces stay identical.
- We do not hand-roll a provider wrapper.

### 4.3 Retrieval: structured keyword/field search, NOT embeddings

- 76 products is tiny (whole compacted catalog is roughly 15-25k tokens). Queries are dominated by exact identifiers (part numbers, "4JJ1", "D-Max") where structured matching beats semantic search - fuzzy matching would add failure modes, not recall.
- **No vector database (no Pinecone/pgvector).** If this comes up in review: it is over-engineering at this catalog size and can be revisited if the catalog grows 50x.
- Search fields: part number/SKU, title, normalized fitment (make, models, engine codes, year ranges), category, short description keywords, and **stripped `fitment_raw` text** (see Phase 2 keyword fallback).
- **Fitment-required vs non-fitment products:** not every catalog item is a vehicle part. T-shirts, merch, and gift bundles (e.g. Xmas injector bundles sold as promotional packages) legitimately have **no** vehicle/engine compatibility and do not need fitment data. The system must distinguish:
  - **Fitment not expected** — searchable via title, short description, and category only; empty fitment is correct, never flagged as an error, never excluded from results for lacking fitment.
  - **Fitment expected but missing/malformed** — actual parts (injectors, fuel lines, valves, pumps, SCVs, etc.) where empty or unstructured fitment is a content gap worth flagging for the review list.
  - Phase 1 sync should derive a `fitment_expected` flag per product (from WooCommerce categories and title/category heuristics — e.g. apparel/merch categories, "T-shirt", "bundle", "Xmas Special" in title). Human review of the initial 76-product audit can correct misclassifications. This flag drives review-list filtering and Phase 2 search behaviour.
- **Vehicle lookup tables (Phase 2.5):** nine client spreadsheets provide **Vehicle + Year + Engine → OEM part number(s)** for covered makes/models. Used as the **first** retrieval path when a query includes enough vehicle specificity (make, model, year, engine code/capacity). Resolved OEM part numbers are cross-referenced against the WooCommerce catalog (SKU and any alternate part-number fields) to return real price/stock/links. If lookup misses, fall back to Phase 1 catalog search. No embeddings; both layers are structured field matching.

### 4.4 Chat shape: single tool-calling loop, not a hardcoded two-call pipeline

- Instead of "Call 1: extract intent -> search -> Call 2: generate reply", the model gets one tool: `search_products({ part_number?, make?, model?, engine_code?, year?, part_type?, keyword? })`. The `part_type` arg (injector, pump, scv, etc.) selects the correct column from vehicle lookup tables when Phase 2.5 is active.
- Same grounding guarantee (the model only ever sees real products our search returns) but multi-turn conversation - clarifying questions, "what about the 3.0L one", refinements - works naturally without hand-written state-machine logic.
- All providers we may swap to support the same tool-calling interface.

### 4.5 State: Upstash Redis, because Vercel functions are stateless

- **No in-memory caching anywhere in the design.** Vercel functions have no persistent process: an in-memory cache is empty on every cold start, and an in-memory rate-limit counter resets per instance (i.e. is functionally not rate limiting).
- Product snapshot, **vehicle lookup snapshot**, rate-limit counters, daily budget counter, and conversation logs all live in Upstash Redis (free tier is ample at our traffic). Rate limiting uses `@upstash/ratelimit`.
- Vehicle lookup data changes rarely (internal reference spreadsheets, not live store inventory). It uses a **separate Redis key namespace** (`vehicle_lookup:*`) and a **less frequent sync** (weekly cron + manual trigger), independent of the 30-minute WooCommerce product sync.
- Alternative acknowledged: a persistent Node host (Railway/Render/small VPS) would allow in-memory state; we prefer Vercel for company/deployment reasons, so the Redis pattern is the way.

### 4.6 Spend control: prepaid credits, NOT the OpenAI budget setting

- **Important:** OpenAI's monthly "budget" setting is notification-only - it emails and keeps serving (and billing) requests. It is not a hard stop.
- Our backstop is layered so a runaway bill is architecturally impossible:
  1. **Prepaid OpenAI credits ($20-50) with auto-recharge OFF** - you cannot spend a balance you do not have.
  2. **App-level daily budget circuit breaker** - a Redis counter of estimated daily spend; once exceeded, `/api/chat` returns a polite "assistant is unavailable, contact us" response instead of calling the LLM.
  3. **`max_tokens` cap on every LLM call** and a cap on conversation history length sent per request.

---

## 5. Build Phases

### Phase 1 - WooCommerce data layer and fitment normalization

**Goal:** an accurate, structured, always-fresh product snapshot in Redis.

1. **WordPress snippet (one-time):** `register_post_meta('product', 'mobex_child_fitment_info', ['show_in_rest' => true, 'single' => true, 'type' => 'string'])` in the child theme's `functions.php`. Verify the field appears in `GET /wp-json/wc/v3/products`.
2. **Sync job** (`/api/sync`, triggered by Vercel cron every 30 min + manual trigger):
   - Fetch all products via WooCommerce REST (read-only API key), **published only - the 35 drafts are excluded from the index**.
   - Capture: id, SKU, title, price, sale price, stock status, categories, permalink, image URL, short description, fitment raw text.
   - **Fitment normalization:** parse each `mobex_child_fitment_info` value into structured JSON (`{ makes: [], models: [], engine_codes: [], fuel_system, year_ranges: {model: [from, to]} , notes }`). Parsing strategy: deterministic parser for the known `Key: value` line format first; a cheap LLM call as fallback for entries the parser cannot handle (run only when a product's fitment text changes, cached by content hash - not on every sync).
   - **Flag products that fail to parse** into a review list we hand to the client/content team — **only where `fitment_expected` is true** (see Section 4.3). Merch, apparel, and gift bundles with empty fitment are not parse failures and must not appear on the review list. This is expected: free-text fields maintained by hand over years will have typos, missing lines, and inconsistent year formats on genuine parts. **This normalization pass is where the real answer quality of the bot is decided** - budget real time for a one-time audit of all 76 records.
   - Write snapshot to Redis under a versioned key; chat requests read the latest snapshot (fast, consistent across function instances).
3. **Deliverable / checkpoint:** a dump of all 76 normalized fitment records reviewed by a human before Phase 2 starts. Parse failures flagged for content-team cleanup are expected; they do not block Phase 2, because `search_products` will fall back to stripped `fitment_raw` keyword matching for retrieval.

### Phase 2 - Chat backend

**Goal:** `POST /api/chat` that answers product questions grounded in Redis data (product snapshot + vehicle lookup when Phase 2.5 is live).

1. Chat loop with the Vercel AI SDK: system prompt + conversation history + `search_products` tool.
2. **`search_products` implementation** — layered matching. Returns top N matches with real price/stock/permalink/image. **Full match priority (after Phase 2.5):**
   1. **Vehicle lookup exact match (Phase 2.5)** — when the query (or tool args) includes a specific **make + model + year** and optionally **engine / engine code / part type** (injector, pump, SCV, turbo, fuel rail, etc.): query `vehicle_lookup:*` for matching row(s), read exact OEM part number(s), then **resolve against the WooCommerce product snapshot** by SKU / alternate part numbers. Multiple spreadsheet rows may map to the same catalog SKU when a product covers a year range — that is correct.
   2. **SKU / part-number exact match** — wins when the user or lookup path supplies a part number directly.
   3. **Structured fitment filters** — make, model, engine code, and year against normalized WooCommerce `fitment` fields (Phase 1).
   4. **Keyword fallback** — search across **`title` + `short_description` + stripped `fitment_raw`** when structured paths miss.
   - **Phase 2 can ship steps 2–4 first** (catalog-only search) if spreadsheet ingestion is not ready; Phase 2.5 adds step 1 without changing the tool interface.
   - Products with `fitment_parse_error` set are **not** excluded from the search index; `fitment_raw` is always searchable.
   - **Non-fitment products** (`fitment_expected: false`): searchable via title, short description, and category only. Vehicle/engine fitment filters do not apply; empty fitment is not surfaced as an error in tool results or chat replies.
   - **Fitment-expected products** (`fitment_expected: true`): use the full layered search above.
   - Keyword matching is substring/token-based, not semantic embeddings.
3. **System prompt grounding rules (the accuracy contract):**
   - Only state product names, prices, stock, and fitment that appear in tool results. Never estimate or recall prices/fitment from general knowledge.
   - **VIN / chassis / year behaviour (updated with Phase 2.5):**
     - If **make + model + year** (and engine when needed) match a vehicle lookup row → return exact part(s) via lookup → catalog resolution. **Do not ask a clarifying question** when the lookup already resolves uniquely.
     - If user supplies a **VIN/chassis** and lookup tables include **VIN lookup hints** for that vehicle family that narrow year/engine → use hints to select the correct lookup row; only ask a clarifying question if hints are insufficient or ambiguous (e.g. change-over year boundary).
     - If vehicle is **not covered** by lookup tables, or year/engine remains ambiguous after one clarifying exchange → fall back to catalog fitment/keyword search, then hand off if still unresolved. Never guess part numbers.
     - Full third-party NEVDIS VIN decode remains a future upgrade (Section 8); spreadsheet hints are not full VIN decode.
   - **Dead-end fallback:** if search finds nothing and one clarifying exchange does not resolve it, hand off - "we may still be able to help, contact us" with a link to the store's contact/enquiry page. Never invent an answer to avoid saying "not found".
   - Out-of-stock products are shown honestly as out of stock, never hidden or misrepresented.
   - Every fitment answer carries a short disclaimer: "please confirm fitment for your exact vehicle before ordering" (cheap liability insurance; also shown in the widget footer). **Omit fitment disclaimer and fitment summary on non-fitment products** (merch, apparel, bundles) — show title/price/stock only.
   - Stay on topic: diesel parts, fitment, orders, store info only. Politely refuse general-purpose requests (essay writing, coding, etc.).
4. Response contract to the widget: streamed text plus a structured `products` array (id, title, price, stock status, image, permalink) so the frontend renders real cards rather than parsing prose.
5. **Conversation logging from day one:** store transcripts in Redis (anonymized - session id, no PII), with searched terms, lookup hits/misses, and result counts.

### Phase 2.5 - Vehicle lookup tables (spreadsheet ingestion)

**Goal:** ingest the client's nine internal Vehicle → Exact Parts spreadsheets into Redis and wire them into `search_products` as the primary precise retrieval path for covered vehicles.

**Source files (9 spreadsheets, ~17–48 rows each, ~300 rows total):**

| Spreadsheet | Vehicle family |
|---|---|
| Ford Ranger | Ford Ranger |
| Isuzu D-Max / MUX | Isuzu D-Max, MU-X |
| Nissan Navara D22 / D40 | Nissan Navara D22, D40 |
| Nissan Patrol TD42 / ZD30 | Nissan Patrol TD42, ZD30 |
| Toyota Hilux / Prado | Toyota Hilux, Prado |
| Toyota LandCruiser 1VD | Toyota LandCruiser (1VD) |
| Toyota LandCruiser pre-common-rail | Toyota LandCruiser (pre-CR) |

(Exact filenames and column variants to be confirmed when client provides files.)

**Relationship to WooCommerce fitment (complementary, not duplicate):**

| | WooCommerce fitment (Phase 1) | Vehicle lookup (Phase 2.5) |
|---|---|---|
| Direction | Product → Vehicles | Vehicle + Year + Engine → Part number(s) |
| Granularity | Year ranges per product | Individual years per row until change-over |
| Use in search | Descriptive fitment, keyword fallback | Exact OEM part resolution |
| Refresh | Every 30 min (store sync) | Weekly / manual (internal data, changes rarely) |

**Normalized row schema (`VehicleLookupRow`):**

```json
{
  "id": "ford-ranger:2015:p5at:injector",
  "source_file": "ford-ranger",
  "make": "Ford",
  "model": "Ranger",
  "model_designation": "PX MKII",
  "engine": "P5AT",
  "engine_capacity": "3.2L",
  "year": 2015,
  "changeover_year": false,
  "vin_lookup_hints": "optional free-text hints from spreadsheet",
  "parts": {
    "injector": "OEM part number or null",
    "injector_fitting_kit": null,
    "pump": null,
    "scv": null,
    "turbo": null,
    "fuel_rail": null,
    "leak_off_rail": null
  }
}
```

- One row = one vehicle-year-engine combination (plus part numbers for each component column present in that spreadsheet).
- `changeover_year: true` marks rows where the part number changes at that year boundary — search must match the correct year, not assume a single part across the whole range.
- Part-type keys in `parts` map to spreadsheet column headers (normalized snake_case). Not every row has every part type populated.

**Redis storage:**

| Key | Contents |
|---|---|
| `vehicle_lookup:snapshot:latest` | Array of all normalized `VehicleLookupRow` records (~300 rows) |
| `vehicle_lookup:meta` | `{ version, synced_at, row_count, source_files[] }` |
| Optional derived indexes | In-memory at request time or precomputed keys like `vehicle_lookup:index:{make}:{model}:{year}` if lookup latency needs optimization — start simple (linear scan over 300 rows is fine at this scale). |

**Ingestion:**

1. Client provides spreadsheets (CSV or XLSX exports) — stored in repo or uploaded to a secure ingest path (TBD with team lead; not in public WordPress).
2. **`GET /api/sync-vehicle-lookup`** (manual trigger + Vercel cron **weekly**, not tied to 30-min product sync): parse all 9 files → validate/normalize rows → write `vehicle_lookup:snapshot:latest`.
3. Parse failures (missing make/model/year, unparseable year) flagged in a small review report similar to Phase 1 fitment audit.
4. **Part-number → catalog link validation:** after ingest, cross-check that OEM part numbers in lookup rows resolve to at least one WooCommerce SKU (or log orphaned part numbers for client review). Orphaned numbers do not block ingest but are flagged.

**How `search_products` uses lookup tables:**

```
User/tool args: { make, model, year, engine_code?, part_type?, keyword?, part_number? }
        │
        ▼
[1] Enough vehicle specificity? (make + model + year minimum)
        │ yes
        ▼
[2] Query vehicle_lookup snapshot → matching row(s)
        │ match
        ▼
[3] Extract OEM part number(s) for requested part_type (or all if unspecified)
        │
        ▼
[4] Resolve part number(s) → WooCommerce product snapshot (SKU / alt part #)
        │ found
        ▼
[5] Return real product cards (price, stock, permalink)
        │
        │ no lookup match OR no catalog SKU match
        ▼
[6] Fall back to Phase 2 catalog search (SKU match → structured fitment → keyword)
        │
        │ still nothing
        ▼
[7] Clarifying question (year/engine/part type) OR dead-end handoff
```

**VIN / chassis impact:** for vehicles covered by these tables, a query that includes enough structured vehicle identity (from user message, VIN hints in spreadsheet, or one clarifying answer) should often **skip the clarifying-question step entirely** and return exact products. Clarifying questions remain for: vehicles outside the nine families, ambiguous change-over years, or when VIN hints do not narrow to a single row.

**Deliverable / checkpoint:** ingested snapshot reviewed; spot-check 10 vehicle+year queries against known spreadsheet rows → correct WooCommerce products returned with correct prices.

### Phase 3 - Guardrails

1. Per-IP and per-session rate limiting via `@upstash/ratelimit` (e.g. 10 messages/min per IP, 60/day per session - tune after launch).
2. Message length cap (e.g. 500 chars) and history cap per request.
3. Daily budget circuit breaker (Section 4.6) + prepaid credits configured on the OpenAI account.
4. CORS locked to `dieselgeeks.com.au` (+ staging domain). Note: CORS deters casual misuse, not scripts, which is why the rate limits and budget breaker above are the real protection. **The realistic cost risk is abuse (scripts using the endpoint as free ChatGPT), not genuine visitors.**
5. Deferred, deliberately: Cloudflare Turnstile bot challenge - only if the endpoint is ever actively farmed. Not built day one.

### Phase 4 - Frontend chat widget

1. Custom-designed widget (not a generic chat-bubble template): launcher button, panel with header, streaming message area, **product cards** (image, title, price, stock badge, fitment summary, Add to Cart / View Product linking to the real product page), typing indicator, fitment disclaimer in the footer.
2. Built as a single self-contained JS bundle; **loaded async/deferred so it cannot affect the store's page load speed**. Styles scoped (shadow DOM or hard prefixing) so the theme's CSS and ours cannot fight.
3. Mobile: full-screen sheet on small viewports, floating panel on desktop. Touch-friendly targets, safe-area handling.
4. WordPress integration: a script tag in the theme (or a 10-line shortcode/snippet) - no plugin dependency.
5. Session id persisted in localStorage for multi-turn history and rate limiting.

### Phase 5 - Testing and launch

1. **Golden test set before launch:** ~20-30 real queries with known correct answers, including the failure case that killed AI Engine ("4JJ1 +30 injectors pre-DPF" must return $3,168 and 2007-2016), part-number lookups, model/year queries, an off-topic request (must refuse), a no-match query (must hand off, not guess), **at least one query matching via stripped `fitment_raw` keyword fallback**, and **at least three Phase 2.5 vehicle-lookup queries** (make + model + year → correct OEM part → correct WooCommerce product with correct price; including one change-over-year boundary case and one query that should **not** ask a clarifying question because lookup resolves exactly).
2. Staging test on the existing staging site first; client walkthrough; then production.
3. Week-one review of conversation logs for retrieval failures; tune search and fitment data accordingly.

---

## 6. Cost Estimate (monthly, current traffic)

| Item | Est. cost | Notes |
|---|---|---|
| LLM usage (GPT-5 mini) | ~$1-5 | Assumes generous 10% of ~3,900 monthly visitors chat, ~5 messages each, ~3k tokens/exchange. Capped by prepaid credits regardless. |
| Vercel | $0 | Hobby/free tier is sufficient at this traffic; company plan later. |
| Upstash Redis | $0 | Free tier ample. |
| One-off fitment normalization LLM calls | < $1 | 76 products, run once per product change. |

Total infrastructure risk is bounded by the prepaid credit balance.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Fitment free-text is inconsistent/dirty across the 76 products | Phase 1 normalization + parse-failure review list ( **`fitment_expected` only** ) + human audit checkpoint before Phase 2. **`search_products` keyword fallback over stripped `fitment_raw`** keeps unstructured-but-real fitment parts findable until content cleanup. Merch/bundles excluded from fitment review flags. |
| Runaway LLM bill (abuse or bug) | Prepaid credits (hard stop) + daily budget breaker + rate limits + max_tokens. A runaway bill is architecturally impossible. |
| Endpoint abused as free ChatGPT | Rate limits, length caps, strict on-topic prompt, budget breaker; Turnstile as a ready escalation. |
| Bot states wrong price/fitment | Grounding contract: product facts only from tool results; golden test set includes the exact AI Engine failure case; dead-end fallback instead of guessing. |
| OEM part in lookup table not found in WooCommerce catalog | Ingest-time orphan report; search falls back to catalog fitment/keyword; never invent a product for a missing SKU. |
| Vehicle lookup tables go stale | Weekly/manual sync; data changes rarely. Product prices/stock still live from 30-min WooCommerce sync at card-render time. |
| Change-over year boundary returns wrong part | Golden test for change-over row; `search_products` must match exact year, not nearest range. |
| Snapshot goes stale (price change mid-window) | 30-min cron refresh; acceptable staleness for this catalog. Cards link to the live product page where checkout uses live price regardless. |
| Widget breaks or slows the client site | Async/deferred load, scoped styles, fully external service - worst case the widget fails silently; the store is unaffected. |
| Provider lock-in | Vercel AI SDK abstraction; model/provider are env config. Documented swap path to Gemini/Groq/self-hosted. |

---

## 8. Future Upgrades (considered, deliberately deferred)

- **Full NEVDIS VIN/chassis decode:** AU VIN decode APIs exist but are paid. **Phase 2.5 spreadsheet VIN hints** cover many cases for the nine vehicle families without full decode. Revisit NEVDIS if logs show frequent VIN queries outside lookup coverage.
- **Self-hosted / alternative model:** viable at 10-100x traffic; the AI SDK abstraction makes this a config change plus an eval run against the golden test set.
- **Webhook-driven sync** instead of cron: unnecessary at 76 products; revisit if catalog or update frequency grows.
- **Cloudflare Turnstile:** wired in only if abuse is observed.
- **Embeddings/vector search:** only if the catalog grows to thousands of products.

---

## 9. Open Items Before Build

1. WooCommerce REST API read-only key - who generates it, and confirm staging + production access.
2. Access to add the `register_post_meta` snippet to the child theme (staging first).
3. OpenAI account: purchase prepaid credits, **verify auto-recharge is OFF**.
4. Confirm the contact/enquiry URL for the dead-end fallback.
5. Widget design direction (colors/branding) - match dieselgeeks.com.au theme; mockup for client approval before Phase 4 build.
6. Where conversation logs may be stored per client's privacy expectations (proposed: anonymized, Redis, 90-day retention).
7. **Phase 2.5:** Client to provide the 9 vehicle lookup spreadsheets (format: CSV/XLSX); confirm column headers per file; confirm how alternate OEM part numbers map to WooCommerce SKUs; decide secure storage location for source files (repo `data/vehicle-lookup/` vs secure upload only).

---

## 10. Definition of Done

- All golden test set queries pass on staging, including the AI Engine failure case returning the correct $3,168 / 2007-2016.
- Widget live on desktop and mobile with no measurable impact on page-speed scores.
- Rate limiting and budget breaker verified by test (simulated flood + simulated budget exhaustion).
- Fitment parse-failure list delivered and resolved or explicitly accepted.
- Vehicle lookup snapshot ingested and spot-checked (Phase 2.5).
- Conversation logging visible and reviewable.
- Team lead sign-off on this document precedes any code.
