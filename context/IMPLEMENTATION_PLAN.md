# Diesel Geeks AI Product Assistant - Implementation Plan

**Project:** Retrieval-grounded product chat assistant for dieselgeeks.com.au
**Site:** WordPress + WooCommerce (Mobex child theme), 76 published products, ~130 visitors/day
**Status:** Proposed - awaiting team lead sign-off before build
**Date:** July 2026

---

## 1. Executive Summary

We will build a custom, standalone chat assistant that lets a store visitor type a part number, vehicle (make/model/engine code), or general product question and get back an accurate answer with **real product cards** (correct price, stock, fitment, link to product page).

The core design rule: **the LLM never answers product questions from its own memory.** Every product fact shown to a user comes from our actual WooCommerce catalog, retrieved by our own search code at request time. The LLM's job is only to (a) understand what the user is asking for, (b) call our product search, and (c) phrase a reply around the real results.

**Stack in one line:** Node.js (TypeScript) service on Vercel + Vercel AI SDK calling GPT-5 mini (swappable) + Upstash Redis (product snapshot cache, rate limiting, budget counter) + a custom embeddable JS chat widget dropped into WordPress via a script tag/shortcode.

**Estimated running cost:** low single-digit dollars per month in LLM usage at current traffic; free tiers cover Vercel and Upstash. The main investment is build time, not infrastructure.

---

## 2. Background and Problem

- Products have a custom **Fitment tab** stored in a theme-level meta field (`mobex_child_fitment_info`) - free-text lines like `Make:`, `Models:`, `Engine Code:`, `Year Range:`. This field is pure custom theme code, not registered post meta, so no off-the-shelf plugin can see it.
- There is **no VIN/chassis-to-part database** - fitment data only maps product -> vehicles, not vehicle -> products via VIN decode.
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
        │   3. search_products runs against product snapshot       │
        │      in Redis (never against the LLM's memory)           │
        │   4. Stream reply + structured product card data         │
        │                                                          │
        │  Cron (every 30 min): GET /api/sync                      │
        │   WooCommerce REST -> parse/normalize fitment ->          │
        │   write snapshot to Redis                                │
        └───────┬──────────────────────────┬───────────────────────┘
                │                          │
                ▼                          ▼
        Upstash Redis               LLM provider (OpenAI GPT-5 mini
        - product snapshot          via Vercel AI SDK - swappable to
        - rate limit counters       Gemini / Groq-Qwen / self-hosted
        - daily budget counter      with a one-line config change)
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
- Search fields: part number/SKU, title, normalized fitment (make, models, engine codes, year ranges), category, description keywords.

### 4.4 Chat shape: single tool-calling loop, not a hardcoded two-call pipeline

- Instead of "Call 1: extract intent -> search -> Call 2: generate reply", the model gets one tool: `search_products({ part_number?, make?, model?, engine_code?, year?, keyword? })`.
- Same grounding guarantee (the model only ever sees real products our search returns) but multi-turn conversation - clarifying questions, "what about the 3.0L one", refinements - works naturally without hand-written state-machine logic.
- All providers we may swap to support the same tool-calling interface.

### 4.5 State: Upstash Redis, because Vercel functions are stateless

- **No in-memory caching anywhere in the design.** Vercel functions have no persistent process: an in-memory cache is empty on every cold start, and an in-memory rate-limit counter resets per instance (i.e. is functionally not rate limiting).
- Product snapshot, rate-limit counters, daily budget counter, and conversation logs all live in Upstash Redis (free tier is ample at our traffic). Rate limiting uses `@upstash/ratelimit`.
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
   - **Flag products that fail to parse** into a review list we hand to the client/content team. This is expected: free-text fields maintained by hand over years will have typos, missing lines, and inconsistent year formats. **This normalization pass is where the real answer quality of the bot is decided** - budget real time for a one-time audit of all 76 records.
   - Write snapshot to Redis under a versioned key; chat requests read the latest snapshot (fast, consistent across function instances).
3. **Deliverable / checkpoint:** a dump of all 76 normalized fitment records reviewed by a human before Phase 2 starts.

### Phase 2 - Chat backend

**Goal:** `POST /api/chat` that answers product questions grounded in the snapshot.

1. Chat loop with the Vercel AI SDK: system prompt + conversation history + `search_products` tool.
2. `search_products` implementation: normalized structured matching over the snapshot (case/whitespace-insensitive; part-number match wins outright; make/model/engine-code filters combine; keyword fallback over title/description). Returns top N matches with real price/stock/permalink/image.
3. **System prompt grounding rules (the accuracy contract):**
   - Only state product names, prices, stock, and fitment that appear in tool results. Never estimate or recall prices/fitment from general knowledge.
   - VIN/chassis number given but no direct match possible -> ask a clarifying question (engine code or build year), never guess. (We have no VIN decode database; see Future Upgrades.)
   - **Dead-end fallback:** if search finds nothing and one clarifying exchange does not resolve it, hand off - "we may still be able to help, contact us" with a link to the store's contact/enquiry page. Never invent an answer to avoid saying "not found".
   - Out-of-stock products are shown honestly as out of stock, never hidden or misrepresented.
   - Every fitment answer carries a short disclaimer: "please confirm fitment for your exact vehicle before ordering" (cheap liability insurance; also shown in the widget footer).
   - Stay on topic: diesel parts, fitment, orders, store info only. Politely refuse general-purpose requests (essay writing, coding, etc.).
4. Response contract to the widget: streamed text plus a structured `products` array (id, title, price, stock status, image, permalink) so the frontend renders real cards rather than parsing prose.
5. **Conversation logging from day one:** store transcripts in Redis (anonymized - session id, no PII), with searched terms and result counts. This is how we find retrieval failures after launch and how we show the client the bot is generating leads.

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

1. **Golden test set before launch:** ~20-30 real queries with known correct answers, including the failure case that killed AI Engine ("4JJ1 +30 injectors pre-DPF" must return $3,168 and 2007-2016), part-number lookups, model/year queries, a VIN query (must ask a clarifying question), an off-topic request (must refuse), and a no-match query (must hand off, not guess).
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
| Fitment free-text is inconsistent/dirty across the 76 products | Phase 1 normalization + parse-failure review list + human audit checkpoint before Phase 2. This is the highest-effort, highest-value item in the project. |
| Runaway LLM bill (abuse or bug) | Prepaid credits (hard stop) + daily budget breaker + rate limits + max_tokens. A runaway bill is architecturally impossible. |
| Endpoint abused as free ChatGPT | Rate limits, length caps, strict on-topic prompt, budget breaker; Turnstile as a ready escalation. |
| Bot states wrong price/fitment | Grounding contract: product facts only from tool results; golden test set includes the exact AI Engine failure case; dead-end fallback instead of guessing. |
| Snapshot goes stale (price change mid-window) | 30-min cron refresh; acceptable staleness for this catalog. Cards link to the live product page where checkout uses live price regardless. |
| Widget breaks or slows the client site | Async/deferred load, scoped styles, fully external service - worst case the widget fails silently; the store is unaffected. |
| Provider lock-in | Vercel AI SDK abstraction; model/provider are env config. Documented swap path to Gemini/Groq/self-hosted. |

---

## 8. Future Upgrades (considered, deliberately deferred)

- **VIN/chassis decode:** AU VIN decode APIs (NEVDIS-backed) exist but are paid and overkill at this scale. Current behavior (clarifying question: engine code or build year) is correct for now. Revisit if VIN queries show up frequently in logs.
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

---

## 10. Definition of Done

- All golden test set queries pass on staging, including the AI Engine failure case returning the correct $3,168 / 2007-2016.
- Widget live on desktop and mobile with no measurable impact on page-speed scores.
- Rate limiting and budget breaker verified by test (simulated flood + simulated budget exhaustion).
- Fitment parse-failure list delivered and resolved or explicitly accepted.
- Conversation logging visible and reviewable.
- Team lead sign-off on this document precedes any code.
